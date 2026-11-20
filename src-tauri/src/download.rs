use serde::Serialize;
use std::{
    fs,
    io::{self, Write},
    path::Path,
};

#[derive(Serialize)]
pub struct Receipt {
    path: String,
    revealed: bool,
}

fn safe_stem(name: &str) -> String {
    let stem: String = name.chars().take(64).map(|c| {
        if c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | '\u{202a}'..='\u{202e}' | '\u{2066}'..='\u{2069}') { '_' } else { c }
    }).collect();
    // Leave room for the collision suffix and extension on 255-byte filesystems.
    let mut stem = stem;
    while stem.len() > 240 {
        stem.pop();
    }
    let stem = stem.trim_matches(|c: char| c == '.' || c.is_whitespace());
    if stem.is_empty() {
        return "我的简历".into();
    }
    let base = stem
        .split('.')
        .next()
        .unwrap()
        .trim_end()
        .to_ascii_uppercase();
    if matches!(
        base.as_str(),
        "CON" | "AUX" | "PRN" | "NUL" | "CONIN$" | "CONOUT$"
    ) || ["COM", "LPT"].iter().any(|p| {
        base.strip_prefix(p).is_some_and(|n| {
            matches!(
                n,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
            )
        })
    }) {
        format!("_{stem}")
    } else {
        stem.to_owned()
    }
}

pub fn save(
    dir: &Path,
    filename: &str,
    bytes: &[u8],
    reveal: impl FnOnce(&Path) -> bool,
) -> Result<Receipt, String> {
    if !bytes.starts_with(b"%PDF-") || bytes.len() > 8 * 1024 * 1024 {
        return Err("PDF 数据无效或过大".into());
    }
    fs::create_dir_all(dir).map_err(|e| format!("无法创建下载目录：{e}"))?;
    let stem = safe_stem(filename);
    for i in 0..10000 {
        let name = if i == 0 {
            format!("{stem}.pdf")
        } else {
            format!("{stem} ({i}).pdf")
        };
        let path = dir.join(name);
        let mut file = match fs::File::create_new(&path) {
            Ok(f) => f,
            Err(e) if e.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(format!("无法创建 PDF：{e}")),
        };
        let written = file.write_all(bytes).and_then(|_| file.sync_all());
        drop(file);
        if let Err(e) = written {
            let _ = fs::remove_file(path);
            return Err(format!("写入 PDF 失败：{e}"));
        }
        return Ok(Receipt {
            revealed: reveal(&path),
            path: path.display().to_string(),
        });
    }
    Err("同名下载文件过多".into())
}

#[cfg(windows)]
pub fn reveal(path: &Path) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::PCWSTR,
        Win32::{
            System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
            UI::Shell::{ILCreateFromPathW, ILFree, SHOpenFolderAndSelectItems},
        },
    };
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    // Pass a shell item, not a command line: commas, spaces and Unicode are literal.
    unsafe {
        if CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_err() {
            return false;
        }
        let item = ILCreateFromPathW(PCWSTR(wide.as_ptr()));
        let ok = !item.is_null() && SHOpenFolderAndSelectItems(item, None, 0).is_ok();
        ILFree(Some(item));
        CoUninitialize();
        ok
    }
}

#[cfg(target_os = "macos")]
pub fn reveal(path: &Path) -> bool {
    std::process::Command::new("/usr/bin/open")
        .arg("-R")
        .arg(path)
        .status()
        .is_ok_and(|s| s.success())
}

#[cfg(not(any(windows, target_os = "macos")))]
pub fn reveal(path: &Path) -> bool {
    let Ok(uri) = tauri::Url::from_file_path(path) else {
        return false;
    };
    let uri = uri.as_str().replace('\'', "%27");
    std::process::Command::new("gdbus")
        .args([
            "call",
            "--session",
            "--dest",
            "org.freedesktop.FileManager1",
            "--object-path",
            "/org/freedesktop/FileManager1",
            "--method",
            "org.freedesktop.FileManager1.ShowItems",
            &format!("['{uri}']"),
            "",
        ])
        .status()
        .is_ok_and(|s| s.success())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn names_are_portable_single_components() {
        for (input, expected) in [
            (" .. ", "我的简历"),
            ("C:\\../a:b", "C__.._a_b"),
            ("CON.txt", "_CON.txt"),
            ("lpt²", "_lpt²"),
            (" .中文. ", "中文"),
            ("a\u{202e}b", "a_b"),
        ] {
            assert_eq!(safe_stem(input), expected);
        }
        assert_eq!(safe_stem(&"中".repeat(500)).chars().count(), 64);
    }
    #[test]
    fn selects_finished_unique_file_and_keeps_path_on_reveal_failure() {
        let dir = tempfile::tempdir_in(env!("CARGO_MANIFEST_DIR")).unwrap();
        let bytes = b"%PDF-proof";
        let existing = dir.path().join("样本.pdf");
        fs::write(&existing, b"original").unwrap();
        let receipt = save(dir.path(), "样本", bytes, |p| {
            assert_eq!(p, dir.path().join("样本 (1).pdf"));
            assert_eq!(fs::read(p).unwrap(), bytes);
            false
        })
        .unwrap();
        assert!(!receipt.revealed);
        assert_eq!(fs::read(receipt.path).unwrap(), bytes);
        assert_eq!(fs::read(existing).unwrap(), b"original");
        assert!(save(dir.path(), "../bad", b"not PDF", |_| panic!()).is_err());
    }
}
