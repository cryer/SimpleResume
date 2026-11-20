use super::{
    escape,
    marks::{self, present, Mark},
};
use serde::Deserialize;
use std::fmt::Write;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Line {
    line: usize,
    #[serde(default, deserialize_with = "present")]
    indent: Option<u8>,
    #[serde(default, deserialize_with = "present")]
    after: Option<u8>,
    #[serde(default, deserialize_with = "present")]
    leading: Option<u8>,
}

fn fragment(out: &mut String, text: &str, at_start: &mut bool) {
    if *at_start {
        for (i, c) in text.char_indices() {
            match c {
                ' ' => out.push_str(r"\hspace*{\fontdimen2\font}"),
                '\t' => out.push_str(r"\hspace*{4\fontdimen2\font}"),
                '　' => out.push_str(r"\hspace*{1em}"),
                _ => {
                    *at_start = false;
                    out.push_str(&escape(&text[i..]));
                    return;
                }
            }
        }
    } else {
        out.push_str(&escape(text));
    }
}

pub(super) fn render(
    text: &str,
    marks: &[Mark],
    styles: &[Line],
    prefix: &str,
) -> Result<String, String> {
    if styles.windows(2).any(|w| w[0].line >= w[1].line)
        || styles.iter().any(|s| {
            s.indent.is_some_and(|v| v > 144)
                || s.after.is_some_and(|v| v > 72)
                || s.leading.is_some_and(|v| !(80..=250).contains(&v))
                || (s.indent.is_none() && s.after.is_none() && s.leading.is_none())
        })
    {
        return Err("行格式无效".into());
    }
    let ranges = marks::ranges(text, marks)?;
    let mut styles = styles.iter().peekable();
    let (mut mark, mut start, mut line) = (0, 0, 0);
    let mut out = String::new();
    loop {
        let end = text[start..]
            .find(['\r', '\n'])
            .map_or(text.len(), |i| start + i);
        let style = styles.next_if(|s| s.line == line);
        out.push('{');
        if let Some(v) = style.and_then(|s| s.indent) {
            write!(out, r"\leftskip={v}pt\relax ").unwrap();
        }
        if let Some(v) = style.and_then(|s| s.leading) {
            write!(out, r"\resumeLeading{{{:.2}}}", f32::from(v) / 100.).unwrap();
        }
        if line == 0 {
            out.push_str(prefix);
        }
        // A wholly absent field retains its legacy zero height. An explicit empty
        // paragraph (including the trailing one after a newline) gets a baseline.
        if start == end && (!text.is_empty() || style.is_some()) {
            out.push_str(r"\leavevmode\hbox{}");
        }
        let mut at_start = true;
        let mut pos = start;
        while let Some(&(a, b, m)) = ranges.get(mark) {
            if b <= pos {
                mark += 1;
                continue;
            }
            if a >= end || pos == end {
                break;
            }
            if a > pos {
                fragment(&mut out, &text[pos..a], &mut at_start);
                pos = a;
            }
            m.begin(&mut out);
            let stop = b.min(end);
            fragment(&mut out, &text[pos..stop], &mut at_start);
            m.end(&mut out);
            pos = stop;
            if b == stop {
                mark += 1;
            }
        }
        fragment(&mut out, &text[pos..end], &mut at_start);
        out.push_str(r"\par}");
        if let Some(v) = style.and_then(|s| s.after) {
            write!(out, r"\vskip {v}pt\relax").unwrap();
        }
        out.push('\n');
        if end == text.len() {
            break;
        }
        start = end
            + if text[end..].starts_with("\r\n") {
                2
            } else {
                1
            };
        line += 1;
    }
    if styles.peek().is_some() {
        return Err("行号超出范围".into());
    }
    Ok(out)
}
