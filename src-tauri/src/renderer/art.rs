use serde::Deserialize;

#[derive(Default, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub(super) enum Icon {
    #[default]
    None,
    Education,
    Work,
    Project,
    Skills,
    Contact,
    Mail,
    Location,
    Phone,
    Globe,
    Certificate,
    Award,
    Languages,
    Calendar,
    Research,
    Publication,
    Volunteer,
    Code,
    Chart,
    Portfolio,
}

impl Icon {
    // Original fixed PDF paths; new outlines map the SVG grid into the 12 × 10 bp icon box.
    pub(super) fn path(self) -> Option<&'static str> {
        Some(match self {
            Self::None => return None,
            Self::Education => "0 6.5 m 6 9.5 l 12 6.5 l 6 3.5 l h f 2.6 4.6 m 2.6 2.8 l 6 1 l 9.4 2.8 l 9.4 4.6 l 6 3 l h f 11.5 6 m 11.5 2 l S",
            Self::Work => "1 1 10 6 re S 4 7 m 4 9 l 8 9 l 8 7 l S 1 5 m 6 3.7 l 11 5 l S",
            Self::Project => "1 1 m 1 8.5 l 4.5 8.5 l 6 7 l 11 7 l 11 1 l h S 1 5.5 m 11 5.5 l S",
            Self::Skills => "5 1 m 7 1 l 7.3 2.3 l 8.4 3 l 9.7 2.6 l 10.7 4.3 l 9.7 5.2 l 9.7 6.2 l 10.5 7.2 l 9.5 8.7 l 8.2 8.3 l 7.2 8.8 l 6.9 10 l 5 10 l 4.7 8.8 l 3.7 8.3 l 2.5 8.7 l 1.5 7.2 l 2.4 6.2 l 2.4 5.1 l 1.4 4.2 l 2.4 2.6 l 3.7 3 l 4.7 2.3 l h f 1 g 7.8 5.6 m 7.8 8 4.2 8 4.2 5.6 c 4.2 3.2 7.8 3.2 7.8 5.6 c f",
            Self::Contact => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 4 4 m 20 4 l 20 20 l 4 20 l h 9 9 m 9 5 15 5 15 9 c 15 13 9 13 9 9 c h 7 17 m 7 12 17 12 17 17 c S",
            Self::Mail => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 2 5 m 22 5 l 22 19 l 2 19 l h 2 6 m 12 14 l 22 6 l S",
            Self::Location => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 12 22 m 10 19 4 13 4 9 c 4 0 20 0 20 9 c 20 13 14 19 12 22 c h 9 9 m 9 5 15 5 15 9 c 15 13 9 13 9 9 c h S",
            Self::Phone => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 6 2 m 10 7 l 8 10 l 9 13 12 16 15 17 c 18 14 l 22 18 l 20 21 l 14 25 0 11 3 5 c h S",
            Self::Globe => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 2 12 m 2 -1 22 -1 22 12 c 22 25 2 25 2 12 c h 12 2 m 5 7 5 17 12 22 c 19 17 19 7 12 2 c h 3 12 m 21 12 l S",
            Self::Certificate => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 3 3 m 21 3 l 21 17 l 18 17 l 11 17 m 3 17 l 3 3 l 6 7 m 16 7 l 6 10 m 10 10 l 12 13 m 12 9 18 9 18 13 c 18 17 12 17 12 13 c h 13 16 m 12 22 l 15 20 l 18 22 l 17 16 l S",
            Self::Award => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 7 3 m 17 3 l 17 9 l 17 16 7 16 7 9 c h 7 5 m 3 5 l 3 10 4 11 8 11 c 17 5 m 21 5 l 21 10 20 11 16 11 c 12 14 m 12 20 l 7 21 m 17 21 l S",
            Self::Languages => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 2 6 m 14 6 l 8 3 m 8 6 l 12 6 m 11 12 7 16 2 18 c 4 9 m 5 12 8 15 11 16 c 12 21 m 17 9 l 22 21 l 14 17 m 20 17 l S",
            Self::Calendar => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 3 5 m 21 5 l 21 21 l 3 21 l h 7 2 m 7 8 l 17 2 m 17 8 l 3 11 m 21 11 l 7 15 m 10 15 l 14 15 m 17 15 l S",
            Self::Research => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 8 2 m 16 2 l 9 2 m 9 10 l 3 20 l 4 22 l 20 22 l 21 20 l 15 10 l 15 2 l 7 15 m 17 15 l S",
            Self::Publication => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 12 6 m 9 3 5 3 2 4 c 2 19 l 5 18 9 18 12 21 c 15 18 19 18 22 19 c 22 4 l 19 3 15 3 12 6 c h 12 6 m 12 21 l S",
            Self::Volunteer => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 12 21 m 10 19 2 13 2 8 c 2 2 9 1 12 7 c 15 1 22 2 22 8 c 22 13 15 18 12 21 c h S",
            Self::Code => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 7 6 m 2 12 l 7 18 l 14 3 m 10 21 l 17 6 m 22 12 l 17 18 l S",
            Self::Chart => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 3 3 m 3 21 l 22 21 l 7 17 m 7 13 l 12 17 m 12 9 l 17 17 m 17 5 l S",
            Self::Portfolio => "0.4 0 0 -0.4 1.2 9.8 cm 2 w 1 J 3 5 m 21 5 l 21 20 l 3 20 l h 3 17 m 9 11 l 14 16 l 17 13 l 21 17 l 15 9 m 17 9 l S",
        })
    }
}

// Latin Modern Math code points, independent of the active text family.
pub(super) fn extra_glyph(c: char) -> Option<&'static str> {
    Some(match c {
        '←' => r"\resumeGlyph\resumeMath{2190}",
        '↑' => r"\resumeGlyph\resumeMath{2191}",
        '↓' => r"\resumeGlyph\resumeMath{2193}",
        '↔' => r"\resumeGlyph\resumeMath{2194}",
        '⇒' => r"\resumeGlyph\resumeMath{21D2}",
        '⇔' => r"\resumeGlyph\resumeMath{21D4}",
        '↗' => r"\resumeGlyph\resumeMath{2197}",
        '↘' => r"\resumeGlyph\resumeMath{2198}",
        '≤' => r"\resumeGlyph\resumeMath{2264}",
        '≥' => r"\resumeGlyph\resumeMath{2265}",
        '≠' => r"\resumeGlyph\resumeMath{2260}",
        '≈' => r"\resumeGlyph\resumeMath{2248}",
        '×' => r"\resumeGlyph\resumeMath{00D7}",
        '÷' => r"\resumeGlyph\resumeMath{00F7}",
        '∞' => r"\resumeGlyph\resumeMath{221E}",
        '∑' => r"\resumeGlyph\resumeMath{2211}",
        '√' => r"\resumeGlyph\resumeMath{221A}",
        '∝' => r"\resumeGlyph\resumeMath{221D}",
        '∈' => r"\resumeGlyph\resumeMath{2208}",
        '∩' => r"\resumeGlyph\resumeMath{2229}",
        '∪' => r"\resumeGlyph\resumeMath{222A}",
        '⊕' => r"\resumeGlyph\resumeMath{2295}",
        '∴' => r"\resumeGlyph\resumeMath{2234}",
        '∵' => r"\resumeGlyph\resumeMath{2235}",
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const NEW_GLYPHS: &str = "←↑↓↔⇒⇔↗↘≤≥≠≈×÷∞∑√∝∈∩∪⊕∴∵";

    #[test]
    fn fixed_references_only_for_new_symbols() {
        for c in NEW_GLYPHS.chars() {
            assert_eq!(
                extra_glyph(c).unwrap(),
                format!(r"\resumeGlyph\resumeMath{{{:04X}}}", c as u32)
            );
        }
        for c in r"•→★◆✓±文#\{}".chars() {
            assert_eq!(extra_glyph(c), None);
        }
    }

    #[test]
    fn icon_ids_have_distinct_fixed_pdf_drawings() {
        let mut paths = std::collections::HashSet::new();
        for id in "education work project skills contact mail location phone globe certificate award languages calendar research publication volunteer code chart portfolio".split_whitespace() {
            let icon: Icon = serde_json::from_value(serde_json::json!(id)).unwrap();
            let path = icon.path().unwrap();
            assert!(paths.insert(path));
            for token in path.split_ascii_whitespace() {
                assert!(token.parse::<f32>().is_ok() || matches!(token, "m"|"l"|"c"|"h"|"f"|"S"|"re"|"g"|"cm"|"J"|"w"));
            }
        }
        assert!(Icon::default().path().is_none());
        assert!(serde_json::from_str::<Icon>(r#""custom""#).is_err());
    }

    #[test]
    #[ignore = "requires XeLaTeX, xdvipdfmx, ctex and Fandol"]
    fn real_catalog_glyphs_in_every_font() {
        use super::super::{compile, executable, source, Document};
        let symbols = format!("•→★◆✓±{NEW_GLYPHS}");
        for font in ["serif", "sans", "kai"] {
            let doc: Document = serde_json::from_value(serde_json::json!({
                "name": "校样", "subtitle": "", "font": font, "size": 10, "bold": true, "divider": false,
                "sections": [{"id":"symbols", "icon":"certificate", "title":symbols, "body":symbols}]
            })).unwrap();
            let tex = source(&doc)
                .unwrap()
                .replace(r"\begin{document}", r"\begin{document}\tracinglostchars=3 ");
            let dir = tempfile::tempdir().unwrap();
            let pdf = compile(&tex, dir.path()).unwrap();
            assert!(pdf.starts_with(b"%PDF-"));
            if let Ok(exe) = executable("pdftotext") {
                let text = std::process::Command::new(exe)
                    .current_dir(dir.path())
                    .args(["-enc", "UTF-8", "resume.pdf", "-"])
                    .output()
                    .unwrap();
                assert!(text.status.success());
                let compact: String = String::from_utf8(text.stdout)
                    .unwrap()
                    .split_whitespace()
                    .collect();
                assert_eq!(compact.matches(&symbols).count(), 2, "{font}: {compact}");
            }
        }
    }
}
