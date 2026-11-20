#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod download;
mod renderer;

use tauri::{
    ipc::{InvokeBody, Request},
    Manager,
};

use renderer::Document;
use std::sync::atomic::{AtomicBool, Ordering};

static COMPILER: AtomicBool = AtomicBool::new(false);

struct Permit(&'static AtomicBool);
impl Permit {
    fn acquire(busy: &'static AtomicBool) -> Result<Self, String> {
        busy.compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed)
            .map(|_| Self(busy))
            .map_err(|_| "编译器正忙，请稍后重试".into())
    }
}
impl Drop for Permit {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

#[tauri::command]
async fn render_pdf(doc: Document) -> Result<Vec<u8>, String> {
    let permit = Permit::acquire(&COMPILER)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _permit = permit;
        renderer::render(&doc)
    })
    .await
    .map_err(|_| "编译任务中断".to_owned())?
}

#[tauri::command]
async fn download_pdf(
    app: tauri::AppHandle,
    request: Request<'_>,
) -> Result<download::Receipt, String> {
    let dir = app.path().download_dir().map_err(|_| "无法获取下载目录")?;
    let name = request
        .headers()
        .get("x-resume-name")
        .and_then(|v| v.to_str().ok())
        .filter(|v| v.len() <= 2048)
        .ok_or("缺少有效文件名")?;
    let name = percent_encoding::percent_decode_str(name)
        .decode_utf8()
        .map_err(|_| "无效文件名")?
        .into_owned();
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("需要 PDF 数据".into());
    };
    if bytes.len() > 8 * 1024 * 1024 {
        return Err("PDF 过大".into());
    }
    let bytes = bytes.clone();
    tauri::async_runtime::spawn_blocking(move || {
        download::save(&dir, &name, &bytes, download::reveal)
    })
    .await
    .map_err(|_| "下载任务中断".to_string())?
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![render_pdf, download_pdf])
        .run(tauri::generate_context!())
        .expect("could not run Resume Studio");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_parallel_jobs_and_releases_permit() {
        static BUSY: AtomicBool = AtomicBool::new(false);
        let permit = Permit::acquire(&BUSY).unwrap();
        assert!(Permit::acquire(&BUSY).is_err());
        drop(permit);
        assert!(Permit::acquire(&BUSY).is_ok());
    }
}
