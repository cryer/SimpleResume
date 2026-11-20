use super::Font;
use serde::{Deserialize, Deserializer};
use std::fmt::Write;

// Omission inherits the field style. Explicit null is not a style value.
pub(super) fn present<'de, D: Deserializer<'de>, T: Deserialize<'de>>(
    d: D,
) -> Result<Option<T>, D::Error> {
    T::deserialize(d).map(Some)
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Mark {
    start: usize,
    end: usize,
    #[serde(default, deserialize_with = "present")]
    bold: Option<bool>,
    #[serde(default, deserialize_with = "present")]
    size: Option<u8>,
    #[serde(default, deserialize_with = "present")]
    font: Option<Font>,
    #[serde(default, deserialize_with = "present")]
    metric: Option<bool>,
    #[serde(default, deserialize_with = "present")]
    link: Option<String>,
}

fn valid_link(s: &str) -> bool {
    let Some(rest) = s
        .strip_prefix("https://")
        .or_else(|| s.strip_prefix("http://"))
    else {
        return false;
    };
    if s.len() > 512
        || !s
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b".:/?&=_#%+~-".contains(&b))
    {
        return false;
    }
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = match authority.split_once(':') {
        Some((host, port))
            if (1..=5).contains(&port.len())
                && port.bytes().all(|b| b.is_ascii_digit())
                && port.parse::<u16>().is_ok() =>
        {
            host
        }
        Some(_) => return false,
        None => authority,
    };
    host.len() <= 253
        && host.split('.').all(|label| {
            (1..=63).contains(&label.len())
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
}

pub(super) fn ranges<'a>(
    text: &str,
    marks: &'a [Mark],
) -> Result<Vec<(usize, usize, &'a Mark)>, String> {
    if marks.len() > 256 {
        return Err("每个字段最多 256 个局部样式".into());
    }
    // Walk UTF-16 and UTF-8 together; there is no byte offset inside a surrogate pair.
    let mut chars = text.char_indices();
    let (mut units, mut byte) = (0, 0);
    let mut boundary = |target| {
        while units < target {
            let (at, ch) = chars.next()?;
            units += ch.len_utf16();
            byte = at + ch.len_utf8();
        }
        (units == target).then_some(byte)
    };
    let mut ranges = Vec::with_capacity(marks.len());
    for m in marks {
        if m.start >= m.end
            || m.size.is_some_and(|s| !(8..=32).contains(&s))
            || m.link.as_deref().is_some_and(|s| !valid_link(s))
            || (m.bold.is_none()
                && m.size.is_none()
                && m.font.is_none()
                && m.metric.is_none()
                && m.link.is_none())
        {
            return Err("局部样式或链接无效".into());
        }
        let start = boundary(m.start).ok_or("局部样式起点无效")?;
        let end = boundary(m.end).ok_or("局部样式终点无效")?;
        ranges.push((start, end, m));
    }
    Ok(ranges)
}
impl Mark {
    pub(super) fn begin(&self, out: &mut String) {
        let m = self;
        out.push('{');
        if let Some(font) = m.font {
            out.push_str(match font {
                Font::Serif => r"\rmfamily\songti ",
                Font::Sans => r"\sffamily\heiti ",
                Font::Kai => r"\rmfamily\resumeKai ",
            });
        }
        if let Some(bold) = m.bold {
            out.push_str(if bold { r"\bfseries " } else { r"\mdseries " });
        }
        if let Some(size) = m.size {
            write!(
                out,
                r"\fontsize{{{size}}}{{{:.1}}}\selectfont ",
                f32::from(size) * 1.4
            )
            .unwrap();
        }
        if m.metric == Some(true) {
            out.push_str(r"\color{resumeMetric} ");
        }
        if let Some(link) = &m.link {
            // A PDF hexadecimal string. No user byte is ever a TeX or PDF token.
            out.push_str(r"\resumeBeginLink{");
            for b in link.bytes() {
                write!(out, "{b:02X}").unwrap();
            }
            out.push('}');
        }
    }
    pub(super) fn end(&self, out: &mut String) {
        if self.link.is_some() {
            out.push_str(r"\resumeEndLink{}");
        }
        out.push('}');
    }
}
