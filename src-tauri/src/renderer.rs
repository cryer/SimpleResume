#[path = "renderer/art.rs"]
mod art;
use art::{extra_glyph, Icon};
mod lines;
use lines::Line;
mod marks;
use marks::Mark;
use serde::Deserialize;
use std::{
    collections::HashSet,
    env, fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Document {
    name: String,
    #[serde(default, rename = "nameMarks")]
    name_marks: Vec<Mark>,
    #[serde(default, rename = "nameLines")]
    name_lines: Vec<Line>,
    subtitle: String,
    #[serde(default, rename = "subtitleMarks")]
    subtitle_marks: Vec<Mark>,
    #[serde(default, rename = "subtitleLines")]
    subtitle_lines: Vec<Line>,
    #[serde(default)]
    font: Font,
    size: u8,
    bold: bool,
    divider: bool,
    sections: Vec<Section>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Section {
    id: String,
    title: String,
    #[serde(default, rename = "titleMarks")]
    title_marks: Vec<Mark>,
    #[serde(default, rename = "titleLines")]
    title_lines: Vec<Line>,
    body: String,
    #[serde(default, rename = "bodyMarks")]
    body_marks: Vec<Mark>,
    #[serde(default, rename = "bodyLines")]
    body_lines: Vec<Line>,
    #[serde(default)]
    icon: Icon,
}

#[derive(Default, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum Font {
    #[default]
    Serif,
    Sans,
    Kai,
}

impl Font {
    fn setup(self) -> &'static str {
        match self {
            Self::Serif => "",
            Self::Sans => r"\renewcommand{\familydefault}{\sfdefault}",
            Self::Kai => r"\setCJKmainfont[AutoFakeBold=2]{FandolKai-Regular.otf}",
        }
    }
}

const OUTPUT_LIMIT: u64 = 8 * 1024 * 1024;
const WORK_LIMIT: u64 = 24 * 1024 * 1024;

fn valid_text(s: &str, limit: usize) -> bool {
    s.len() <= limit * 4
        && s.encode_utf16().count() <= limit
        && !s
            .chars()
            .any(|c| c.is_control() && !matches!(c, '\t' | '\n' | '\r'))
}

fn validate(doc: &Document) -> Result<(), String> {
    if !(8..=20).contains(&doc.size)
        || doc.sections.len() > 64
        || !valid_text(&doc.name, 160)
        || !valid_text(&doc.subtitle, 512)
    {
        return Err("简历字段或字号无效".into());
    }
    let mut ids = HashSet::new();
    let mut bytes = doc.name.len() + doc.subtitle.len();
    for s in &doc.sections {
        if s.id.is_empty()
            || !valid_text(&s.id, 128)
            || !ids.insert(&s.id)
            || !valid_text(&s.title, 160)
            || !valid_text(&s.body, 20000)
        {
            return Err("章节字段无效或超出限制".into());
        }
        bytes += s.id.len() + s.title.len() + s.body.len();
    }
    if bytes > 512 * 1024 {
        return Err("简历文本超过 512 KiB".into());
    }
    Ok(())
}

fn escape(s: &str) -> String {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if let Some(g) = extra_glyph(c) {
            out.push_str(g);
            continue;
        }
        out.push_str(match c {
            '\\' => r"\textbackslash{}",
            '{' => r"\{",
            '}' => r"\}",
            '$' => r"\$",
            '&' => r"\&",
            '#' => r"\#",
            '_' => r"\_",
            '%' => r"\%",
            '^' => r"\textasciicircum{}",
            '~' => r"\textasciitilde{}",
            // Fixed glyph references, never user-supplied TeX. Keep their Unicode
            // mappings in the PDF regardless of the active text/heading family.
            '•' => r"\resumeGlyph\resumeMath{2022}",
            '→' => r"\resumeGlyph\resumeMath{2192}",
            '★' => r"\resumeGlyph\resumeShapes{2605}",
            '◆' => r"\resumeGlyph\resumeShapes{25C6}",
            '✓' => r"\resumeGlyph\resumeMath{2713}",
            '±' => r"\resumeGlyph\resumeMath{00B1}",
            // Explicit width with a legal break after it: neither TeX nor xeCJK
            // may collapse a user-entered gap, even between styled fragments.
            ' ' => r"\resumeGap{.33333em}",
            '\t' => r"\resumeGap{1.33333em}",
            '　' => r"\resumeGap{1em}",
            '\n' => "\\par\n",
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                }
                "\\par\n"
            }
            _ => {
                out.push(c);
                continue;
            }
        });
    }
    out
}

fn source(d: &Document) -> Result<String, String> {
    validate(d)?;
    let weight = if d.bold { r"\bfseries" } else { r"\mdseries" };
    let font_setup = d.font.setup();
    let mut tex = format!(
        r##"\documentclass[UTF8,a4paper,scheme=plain,fontset=fandol]{{ctexart}}
\usepackage[margin=20mm]{{geometry}}
\usepackage{{xcolor}}
\definecolor{{resumeMetric}}{{HTML}}{{165A73}}
\setCJKfamilyfont{{resumeKai}}{{FandolKai-Regular.otf}}[AutoFakeBold=2]
\newcommand\resumeKai{{\CJKfamily{{resumeKai}}}}
\definecolor{{resumeLink}}{{HTML}}{{235FA3}}
\newcommand\resumeBeginLink[1]{{\color{{resumeLink}}\leavevmode\special{{pdf:bann <</Type/Annot/Subtype/Link/Border[0 0 0]/A<</S/URI/URI <#1>>>>>}}}}
\newcommand\resumeEndLink{{\special{{pdf:eann}}}}
{font_setup}
\newfontfamily\resumeMath{{latinmodern-math.otf}}
\newfontfamily\resumeShapes{{FandolSong-Regular.otf}}
\newcommand\resumeGap[1]{{\leavevmode\hbox to #1{{\hfil}}\allowbreak}}
\newcommand\resumeGlyph[2]{{\mbox{{\mdseries#1\char"#2\relax}}}}
\newcommand\resumeIcon[1]{{\leavevmode\hbox to 15bp{{\rule{{0pt}}{{10bp}}\special{{pdf:content q 0.85 w 1 j #1 Q}}\hfil}}\nobreak}}
\XeTeXgenerateactualtext=1
\pagestyle{{empty}}
\setlength{{\parindent}}{{0pt}}
\makeatletter
% Preserve the gap before the first baseline; leading affects only soft wraps.
\newcommand\resumeLeading[1]{{\dimen@=\f@size pt\relax \dimen@=#1\dimen@
  \ifdim\prevdepth>-1000pt \prevdepth=\dimexpr\prevdepth+\dimen@-\baselineskip\relax\fi
  \baselineskip=\dimen@ \lineskiplimit=-1000pt\relax}}
\makeatother
\begin{{document}}
\fontsize{{{}}}{{{}}}\selectfont
{{\LARGE{weight} {}}}
{}
"##,
        d.size,
        f32::from(d.size) * 1.4,
        lines::render(&d.name, &d.name_marks, &d.name_lines, "")?,
        lines::render(&d.subtitle, &d.subtitle_marks, &d.subtitle_lines, "")?
    );
    for s in &d.sections {
        let icon = s
            .icon
            .path()
            .map_or_else(String::new, |path| format!(r"\resumeIcon{{{path}}}"));
        tex.push_str(&format!(
            "\\medskip\n{{\\large{weight} {}}}\n",
            lines::render(&s.title, &s.title_marks, &s.title_lines, &icon)?
        ));
        if d.divider {
            tex.push_str("\\hrule\\smallskip\n");
        }
        tex.push_str(&lines::render(&s.body, &s.body_marks, &s.body_lines, "")?);
    }
    tex.push_str("\\null\\end{document}\n");
    Ok(tex)
}

// Resolve trusted system tools before changing cwd. Never search a relative PATH entry.
fn executable(name: &str) -> Result<PathBuf, String> {
    let file = format!("{name}{}", env::consts::EXE_SUFFIX);
    env::split_paths(&env::var_os("PATH").unwrap_or_default())
        .filter(|dir| dir.is_absolute())
        .map(|dir| dir.join(&file))
        .find(|p| p.is_file())
        .ok_or_else(|| format!("未找到 {name}，请安装带 ctex 和 Fandol 字体的 TeX Live"))
}

fn command(exe: &Path, dir: &Path) -> Command {
    let mut cmd = Command::new(exe);
    cmd.current_dir(dir).env_clear();
    // System fonts and Windows runtime need these; do not inherit TEXINPUTS/TEXMFCNF etc.
    for key in [
        "SystemRoot",
        "WINDIR",
        "SystemDrive",
        "ProgramData",
        "LOCALAPPDATA",
        "APPDATA",
        "HOME",
        "USERPROFILE",
        "LANG",
    ] {
        if let Some(value) = env::var_os(key) {
            cmd.env(key, value);
        }
    }
    cmd.env("PATH", exe.parent().unwrap_or(dir))
        .env("openin_any", "p")
        .env("openout_any", "p")
        .env("shell_escape", "f")
        .env("MKTEXPK", "0")
        .env("MKTEXTFM", "0")
        .env("MKTEXFMT", "0")
        .env("TEXMFHOME", dir)
        .env("TMPDIR", dir)
        .env("TEMP", dir)
        .env("TMP", dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd
}

fn workspace_ok(dir: &Path) -> bool {
    let Ok(entries) = fs::read_dir(dir) else {
        return false;
    };
    let mut total = 0u64;
    for entry in entries {
        let Some(meta) = entry.ok().and_then(|e| fs::symlink_metadata(e.path()).ok()) else {
            return false;
        };
        if !meta.is_file() {
            return false;
        }
        total = total.saturating_add(meta.len());
        if total > WORK_LIMIT {
            return false;
        }
    }
    true
}

fn run(cmd: &mut Command, dir: &Path, deadline: Instant) -> Result<(), String> {
    let mut child = cmd.spawn().map_err(|_| "无法启动 TeX 工具")?;
    let err = loop {
        if Instant::now() >= deadline {
            break "编译超时";
        }
        if !workspace_ok(dir) {
            break "编译工作目录超出限制";
        }
        match child.try_wait() {
            Ok(Some(status)) if status.success() => return Ok(()),
            Ok(Some(_)) => {
                return Err("排版失败，请确认已安装完整 TeX Live、ctex 和 Fandol 字体".into())
            }
            Ok(None) => thread::sleep(Duration::from_millis(40)),
            Err(_) => break "无法读取编译状态",
        }
    };
    let _ = child.kill();
    let _ = child.wait();
    Err(err.into())
}

fn read_pdf(path: &Path) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    fs::File::open(path)
        .and_then(|f| f.take(OUTPUT_LIMIT + 1).read_to_end(&mut bytes))
        .map_err(|_| "无法读取 PDF")?;
    if bytes.len() as u64 > OUTPUT_LIMIT || !bytes.starts_with(b"%PDF-") {
        return Err("PDF 输出无效或超过 8 MiB".into());
    }
    Ok(bytes)
}

pub fn render(d: &Document) -> Result<Vec<u8>, String> {
    let tex = source(d)?;
    let tmp = tempfile::tempdir().map_err(|_| "无法创建临时目录")?;
    compile(&tex, tmp.path())
}

fn compile(tex: &str, dir: &Path) -> Result<Vec<u8>, String> {
    let engine = executable("xelatex")?;
    let driver = executable("xdvipdfmx")?;
    fs::write(dir.join("resume.tex"), tex).map_err(|_| "无法写入排版文件")?;
    let deadline = Instant::now() + Duration::from_secs(20);
    // Invoke the PDF driver separately so it also has a supervisor and deadline.
    run(
        command(&engine, dir).args([
            "-no-shell-escape",
            "-no-pdf",
            "-no-parse-first-line",
            "-interaction=batchmode",
            "-halt-on-error",
            "resume.tex",
        ]),
        dir,
        deadline,
    )?;
    run(
        command(&driver, dir).args(["-q", "-o", "resume.pdf", "resume.xdv"]),
        dir,
        deadline,
    )?;
    read_pdf(&dir.join("resume.pdf"))
}

#[cfg(test)]
mod tests;
