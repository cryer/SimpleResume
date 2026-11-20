use super::*;

fn sample() -> Document {
    Document {
        name_marks: vec![],
        name_lines: vec![],
        name: "李明".into(),
        subtitle_marks: vec![],
        subtitle_lines: vec![],
        subtitle: "Rust 工程师".into(),
        font: Font::default(),
        size: 11,
        bold: true,
        divider: true,
        sections: vec![Section {
            id: "private-id".into(),
            icon: Icon::default(),
            title_marks: vec![],
            title_lines: vec![],
            title: "经验".into(),
            body_marks: vec![],
            body_lines: vec![],
            body: "a\r\nb".into(),
        }],
    }
}

#[test]
#[ignore = "requires XeLaTeX, xdvipdfmx, ctex and Fandol"]
fn real_xelatex_smoke() {
    let mut d = sample();
    d.sections = [
        Icon::None,
        Icon::Education,
        Icon::Work,
        Icon::Project,
        Icon::Skills,
    ]
    .into_iter()
    .enumerate()
    .map(|(i, icon)| Section {
        id: i.to_string(),
        icon,
        title_marks: vec![],
        title_lines: vec![],
        title: "学位与工作 •→★◆✓±".into(),
        body_marks: vec![],
        body_lines: vec![],
        body: r"中文 Latin •→★◆✓± 100% \{}".into(),
    })
    .collect();
    for (font, expected) in [
        (Font::Serif, "FandolSong"),
        (Font::Sans, "FandolHei"),
        (Font::Kai, "FandolKai"),
    ] {
        d.font = font;
        let dir = tempfile::tempdir().unwrap();
        // Error on missing glyphs, even though XeLaTeX normally exits successfully.
        let tex = source(&d)
            .unwrap()
            .replace(r"\begin{document}", r"\begin{document}\tracinglostchars=3 ");
        let pdf = compile(&tex, dir.path()).unwrap_or_else(|err| {
            panic!(
                "{err}: {}",
                fs::read_to_string(dir.path().join("resume.log")).unwrap_or_default()
            )
        });
        assert!(pdf.starts_with(b"%PDF-") && pdf.windows(5).any(|w| w == b"%%EOF"));
        // On hosts with a PDF text extractor, also check the final Unicode map,
        // not just the fact that XeTeX found a printable glyph.
        if let Ok(exe) = executable("pdftotext") {
            let text = Command::new(exe)
                .current_dir(dir.path())
                .args(["-enc", "UTF-8", "resume.pdf", "-"])
                .output()
                .unwrap();
            assert!(text.status.success());
            let compact: String = String::from_utf8(text.stdout)
                .unwrap()
                .split_whitespace()
                .collect();
            assert!(
                compact.contains("李明") && compact.contains("中文Latin"),
                "{compact}"
            );
            assert_eq!(
                compact.matches("•→★◆✓±").count(),
                d.sections.len() * 2,
                "{compact}"
            );
        }
        let xdv = fs::read(dir.path().join("resume.xdv")).unwrap();
        assert!(
            xdv.windows(expected.len())
                .any(|w| w == expected.as_bytes()),
            "missing {expected} in typeset page"
        );
    }
}

#[test]
fn strict_enums_and_legacy_defaults() {
    use serde_json::{from_value, json};
    let mut value = json!({"name":"", "subtitle":"", "size":11, "bold":true, "divider":false,
        "sections":[{"id":"s", "title":"", "body":""}]});
    let legacy: Document = from_value(value.clone()).unwrap();
    assert!(matches!(legacy.font, Font::Serif));
    assert!(matches!(legacy.sections[0].icon, Icon::None));
    for font in ["serif", "sans", "kai"] {
        value["font"] = json!(font);
        for icon in ["none", "education", "work", "project", "skills"] {
            value["sections"][0]["icon"] = json!(icon);
            let doc: Document = from_value(value.clone()).unwrap();
            let tex = source(&doc).unwrap();
            assert_eq!(tex.contains(r"\resumeIcon{"), icon != "none");
        }
    }
    value["font"] = json!(r"\input");
    assert!(from_value::<Document>(value.clone()).is_err());
    value["font"] = json!("serif");
    value["sections"][0]["icon"] = json!("untrusted");
    assert!(from_value::<Document>(value).is_err());
}

#[test]
fn literal_text_only() {
    assert_eq!(
        escape(r"中文\{}$&#_%^~"),
        r"中文\textbackslash{}\{\}\$\&\#\_\%\textasciicircum{}\textasciitilde{}"
    );
    let mut d = sample();
    d.name = r"\input{not-a-file}".into();
    d.sections[0].body = r"\end{document}".into();
    let tex = source(&d).unwrap();
    assert!(!tex.contains(r"\input"));
    assert_eq!(tex.matches(r"\end{document}").count(), 1);
    assert!(!tex.contains("private-id"));
}

#[test]
fn layout_flags_and_newlines() {
    let mut d = sample();
    let tex = source(&d).unwrap();
    for fragment in [
        "ctexart",
        "a\\par}\n{b",
        "\\hrule",
        "\\bfseries",
        "\\fontsize{11}",
        "李明",
    ] {
        assert!(tex.contains(fragment));
    }
    d.bold = false;
    d.divider = false;
    let tex = source(&d).unwrap();
    assert!(!tex.contains("\\bfseries") && !tex.contains("\\hrule"));
}

#[test]
fn rejects_invalid_fields_and_duplicate_ids() {
    let mut d = sample();
    d.size = 21;
    assert!(source(&d).is_err());
    d.size = 8;
    d.sections.push(sample().sections.pop().unwrap());
    assert!(source(&d).is_err());
    d.sections.pop();
    d.name = "😀".repeat(81);
    assert!(source(&d).is_err());
    d.name = "\0".into();
    assert!(source(&d).is_err());
}

#[test]
fn rejects_total_and_section_limits() {
    let mut d = sample();
    d.sections = (0..10)
        .map(|i| Section {
            id: i.to_string(),
            icon: Icon::default(),
            title_marks: vec![],
            title_lines: vec![],
            title: "".into(),
            body_marks: vec![],
            body_lines: vec![],
            body: "文".repeat(20000),
        })
        .collect();
    assert!(source(&d).is_err());
    d.sections.truncate(1);
    assert!(source(&d).is_ok());
    d.sections[0].body.push('x');
    assert!(source(&d).is_err());
}

#[test]
fn bounds_pdf_and_workspace() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("resume.pdf");
    fs::write(&path, b"not PDF").unwrap();
    assert!(read_pdf(&path).is_err());
    fs::write(&path, b"%PDF-1.7").unwrap();
    assert_eq!(read_pdf(&path).unwrap(), b"%PDF-1.7");
    let f = fs::OpenOptions::new().write(true).open(&path).unwrap();
    f.set_len(OUTPUT_LIMIT + 1).unwrap();
    assert!(read_pdf(&path).is_err());
    f.set_len(WORK_LIMIT + 1).unwrap();
    assert!(!workspace_ok(dir.path()));
}

// Reuse the Rust test binary as a deterministic child, without a TeX installation.
#[test]
fn simulated_engine() {
    if env::var_os("RESUME_TEST_ENGINE").is_some() {
        thread::sleep(Duration::from_secs(5));
    }
}

#[test]
fn supervises_error_and_timeout() {
    let dir = tempfile::tempdir().unwrap();
    let exe = env::current_exe().unwrap();
    let now = Instant::now();
    let err = run(
        command(&exe, dir.path())
            .args(["--exact", "renderer::tests::simulated_engine"])
            .env("RESUME_TEST_ENGINE", "1"),
        dir.path(),
        now + Duration::from_millis(100),
    )
    .unwrap_err();
    assert_eq!(err, "编译超时");
    assert!(now.elapsed() < Duration::from_secs(4));
    assert!(run(
        command(&exe, dir.path()).arg("--invalid-option"),
        dir.path(),
        Instant::now() + Duration::from_secs(4)
    )
    .is_err());
}

#[test]
fn mark_schema_and_field_scopes() {
    use serde_json::{from_value, json};
    let value = json!({"name":"A😀B", "subtitle":"副", "size":11,"bold":true,"divider":false,
      "nameMarks":[{"start":1,"end":3,"bold":false}],"subtitleMarks":[{"start":0,"end":1,"size":32}],
      "sections":[{"id":"s","title":"标","body":"123","titleMarks":[{"start":0,"end":1,"font":"kai"}],"bodyMarks":[{"start":0,"end":2,"metric":true},{"start":2,"end":3,"metric":false}]}]});
    let tex = source(&from_value(value.clone()).unwrap()).unwrap();
    for fragment in [
        r"A{\mdseries 😀}B",
        r"\fontsize{32}{44.8}\selectfont 副",
        r"\resumeKai 标",
        r"{\color{resumeMetric} 12}{3}",
    ] {
        assert!(tex.contains(fragment), "{fragment}");
    }
    for key in ["name_marks", "NameMarks", "titleMarks"] {
        let mut v = value.clone();
        v[key] = json!([]);
        assert!(from_value::<Document>(v).is_err());
    }
    for marks in [
        json!([{"start":1,"end":2,"bold":true}]),
        json!([{"start":2,"end":3,"bold":true}]),
        json!([{"start":0,"end":5,"size":8}]),
        json!([{"start":1,"end":1,"bold":true}]),
        json!([{"start":0,"end":3,"font":"sans"},{"start":1,"end":4,"size":9}]),
        json!([{"start":3,"end":4,"font":"sans"},{"start":0,"end":1,"size":9}]),
        json!([{"start":0,"end":1}]),
        json!([{"start":0,"end":1,"size":7}]),
        json!([{"start":0,"end":1,"size":33}]),
        json!([{"start":0,"end":1,"size":10.5}]),
        json!([{"start":0,"end":1,"bold":null,"metric":true}]),
        json!([{"start":0,"end":1,"font":"other"}]),
        json!([{"start":0,"end":1,"raw":"x"}]),
        json!(null),
    ] {
        let mut v = value.clone();
        v["nameMarks"] = marks;
        assert!(
            from_value::<Document>(v.clone())
                .ok()
                .and_then(|d| source(&d).ok())
                .is_none(),
            "{v}"
        );
    }
    let mut d = sample();
    d.subtitle = "x".repeat(257);
    let run = |i| from_value(json!({"start":i,"end":i+1,"size":8})).unwrap();
    d.subtitle_marks = (0..256).map(run).collect();
    assert!(source(&d).is_ok());
    d.subtitle_marks.push(run(256));
    assert!(source(&d).is_err());
}

#[test]
fn restricts_and_encodes_mark_links() {
    use serde_json::{from_value, json};
    let check = |url: &str| {
        let mut d = sample();
        d.name_marks = from_value(json!([{"start":0,"end":1,"link":url}])).unwrap();
        source(&d)
    };
    for url in [
        "https://example.org:65535/x?x=&y=%28+~#z",
        "http://local",
        &format!("https://a/{}", "x".repeat(502)),
    ] {
        let tex = check(url).unwrap();
        assert!(!tex.contains(url));
    }
    for url in [
        "file://example.org",
        "HTTPS://example.org",
        "http:///abs",
        "https://a:b@host",
        "https://a/-@user",
        "https://bad_host",
        "https://a..b",
        "https://-a.b",
        "https://a-.b",
        "https://a:65536",
        "https://a:000000",
        "https://a/+()",
        "https://a/{}",
        r"https://a/\input",
        "https://a/中文",
        "https://a/\n",
        &format!("https://a/{}", "x".repeat(503)),
    ] {
        assert!(check(url).is_err(), "{url}");
    }
}

#[test]
#[ignore = "requires XeLaTeX, xdvipdfmx, npm dependencies and Node"]
fn real_mark_link_and_metric_pdf() {
    use serde_json::{from_value, json};
    let url = "https://my-site.example:8443/path_~?x=%28+1&y=2#frag";
    let mut d = sample();
    d.sections[0].body = "产出42%作品集".into();
    d.sections[0].body_marks=from_value(json!([{"start":0,"end":2,"font":"kai","bold":true},{"start":2,"end":5,"size":16,"metric":true},{"start":5,"end":8,"link":url}])).unwrap();
    let dir = tempfile::tempdir().unwrap();
    compile(&source(&d).unwrap(), dir.path()).unwrap_or_else(|e| {
        panic!(
            "{e}: {}",
            fs::read_to_string(dir.path().join("resume.log")).unwrap_or_default()
        )
    });
    let result = Command::new(executable("node").unwrap())
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/renderer/check-mark-pdf.mjs"))
        .arg(dir.path().join("resume.pdf"))
        .arg(url)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{} {}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
}

#[test]
fn validates_sparse_line_styles() {
    use serde_json::{from_value, json};
    let base = json!({"name":"a\r\nb\rc\n", "subtitle":"", "size":11,"bold":true,"divider":false,"sections":[]});
    let valid = |lines| {
        let mut v = base.clone();
        v["nameLines"] = lines;
        from_value(v).ok().and_then(|d| source(&d).ok()).is_some()
    };
    assert!(valid(
        json!([{"line":0,"indent":0,"after":0,"leading":80},{"line":3,"indent":144,"after":72,"leading":250}])
    ));
    for bad in [
        json!(null),
        json!([{"line":0}]),
        json!([{"line":4,"after":0}]),
        json!([{"line":1,"after":1},{"line":1,"after":2}]),
        json!([{"line":1,"after":0},{"line":0,"after":0}]),
        json!([{"line":-1,"indent":0}]),
        json!([{"line":0,"indent":145}]),
        json!([{"line":0,"after":73}]),
        json!([{"line":0,"leading":79}]),
        json!([{"line":0,"leading":251}]),
        json!([{"line":0,"after":null}]),
        json!([{"line":0,"indent":0.5}]),
        json!([{"line":0,"extra":1}]),
    ] {
        assert!(!valid(bad.clone()), "{bad}");
    }
}

#[test]
#[ignore = "requires XeLaTeX, xdvipdfmx, npm dependencies and Node"]
fn real_line_coordinates_pdf() {
    use serde_json::{from_value, json};
    let mut d = sample();
    d.name = "Name".into();
    d.name_lines = from_value(json!([{"line":0,"indent":12}])).unwrap();
    d.subtitle = "Sub".into();
    d.subtitle_lines = from_value(json!([{"line":0,"indent":18}])).unwrap();
    let s = &mut d.sections[0];
    s.icon = Icon::Work;
    s.title = "Title".into();
    s.title_lines = from_value(json!([{"line":0,"indent":24}])).unwrap();
    s.body = format!(
        "Base\r\n  Space\r\tTab\n　Wide\nGap\n\nBlank\nLinkA\r\nLinkB\n{}\nEnd",
        "wrap ".repeat(75)
    );
    // Compare a bold suffix across lines; its PDF origin measures the gap
    // independently of PDF.js text extraction normalizing whitespace.
    let mut mid_marks = Vec::new();
    for (gap, suffix) in [
        ("", "Zero"),
        (" ", "One"),
        ("   ", "Three"),
        ("\t", "InnerTab"),
        ("　", "Full"),
    ] {
        s.body.push_str("\n甲");
        s.body.push_str(gap);
        let end = s.body.encode_utf16().count();
        if suffix == "Three" {
            mid_marks.push(json!({"start":end-2,"end":end-1,"metric":true}));
        }
        mid_marks.push(json!({"start":end,"end":end+suffix.len(),"bold":true}));
        s.body.push_str(suffix);
    }
    let start = s.body[..s.body.find("LinkA").unwrap()]
        .encode_utf16()
        .count();
    s.body_marks=from_value(json!([{"start":7,"end":8,"bold":true},{"start":start,"end":start+12,"link":"https://example.org/"}])).unwrap();
    s.body_marks.extend(
        mid_marks
            .into_iter()
            .map(|v| from_value::<marks::Mark>(v).unwrap()),
    );
    s.body_lines = from_value(
        json!([{"line":4,"after":30},{"line":8,"indent":36},{"line":9,"indent":72,"leading":200}]),
    )
    .unwrap();
    let dir = tempfile::tempdir().unwrap();
    compile(&source(&d).unwrap(), dir.path()).unwrap_or_else(|err| {
        panic!(
            "{err}: {}",
            fs::read_to_string(dir.path().join("resume.log")).unwrap_or_default()
        )
    });
    let result = Command::new(executable("node").unwrap())
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/renderer/check-lines-pdf.mjs"))
        .arg(dir.path().join("resume.pdf"))
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{} {}",
        String::from_utf8_lossy(&result.stdout),
        String::from_utf8_lossy(&result.stderr)
    );
}
