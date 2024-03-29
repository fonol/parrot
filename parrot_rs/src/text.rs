use itertools::Itertools;
use lazy_static::lazy_static;
use regex::Regex;
use std::borrow::Cow;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;

lazy_static! {
    static ref RE_TOKENIZE: Regex = Regex::new(r#"(?i)[ /\\,_$'";:.+*`&()?!<>-]"#).unwrap();
    static ref RE_FORM_ESCAPE: Regex = Regex::new(r#"(["\\])"#).unwrap();
}

//
// public functions
//

pub fn escape_quotes(text: &str) -> String {
    text.replace("\"", "\\\"")
}
pub fn escape_form(text: &str) -> String {
    RE_FORM_ESCAPE.replace_all(text, "\\$1").to_string()
}

pub fn tokenize_lowercase(text: &str) -> Vec<u64> {
    RE_TOKENIZE
        .split(&text.to_lowercase())
        .filter(|t| t.len() > 2)
        .map(u64_hash)
        .collect()
}

pub fn tokenize_lowercase_unique(text: &str) -> Vec<String> {
    RE_TOKENIZE
        .split(&text.to_lowercase())
        .filter(|t| t.len() > 1)
        .unique()
        .map(|t| t.to_string())
        .collect()
}

pub fn ngram_tokenize_lowercase(text: &str, n: usize) -> Vec<u64> {
    let mut ngrams = Vec::<u64>::new();
    for t in RE_TOKENIZE
        .split(&text.to_lowercase())
        .filter(|t| t.len() >= n)
    {
        for ngram in char_windows(t, n) {
            ngrams.push(u64_hash(ngram));
        }
    }
    ngrams
}

pub fn ngram_tokenize_lowercase_unique(text: &str, n: usize) -> Vec<u64> {
    let mut ngrams = Vec::<u64>::new();
    for t in RE_TOKENIZE
        .split(&text.to_lowercase())
        .unique()
        .filter(|t| t.len() >= n)
    {
        for ngram in char_windows(t, n) {
            ngrams.push(u64_hash(ngram));
        }
    }
    ngrams
}


///
/// Returns a triple of (line index, starting position (nth character) of text in line, line)
/// 
pub fn get_line_from_byte_offset(text: &str, byte_offset: usize) -> (usize, usize, String) {
    let mut offset: usize = 0;
    for (ix, l) in text.split_inclusive('\n').enumerate() {
        offset += l.bytes().len();
        if offset >= byte_offset {
            let line_pos_bytes = byte_offset - (offset - l.bytes().len());
            let line_pos_char = &l[0..line_pos_bytes].replace('\t', "    ").chars().count();
            return (ix, *line_pos_char, l.to_string());
        }
    }
    panic!("This should not happen: byte_offset should always be inside the text.");
}
pub fn get_surrounding_context(text: &str, char_pos: usize, window_size: usize) -> (String, usize) {
    let mut start_ix = if char_pos <= window_size {
        0
    } else {
        char_pos - window_size
    };
    let mut end_ix = if char_pos + window_size >= text.chars().count() {
        text.chars().count()
    } else {
        char_pos + window_size
    };
    // unused number of characters at the left side of the window
    let start_off: i32 = (window_size as i32 - char_pos as i32).max(0);
    // unused number of characters at the right side of the window
    let end_off: i32 = (char_pos as i32 + window_size as i32 - text.chars().count() as i32).max(0);
    // if on the left side, there are unused chars, we can increase the window on the right side
    if start_off > 0 && end_off == 0 {
        end_ix = (end_ix + start_off as usize).min(text.chars().count());
    } else if end_off > 0 && start_off == 0 {
        start_ix = (start_ix as i32 - end_off).max(0) as usize;
    }
    (text.chars()
        .skip(start_ix)
        .take(end_ix - start_ix)
        .collect(), start_ix)

}

pub fn u64_hash(text: &str) -> u64 {
    let mut s = DefaultHasher::new();
    text.hash(&mut s);
    s.finish()
}
pub fn trim_quote_op(mut text: String) -> String {
    if text.starts_with("#'") {
        text = text
            .chars()
            .skip(2)
            .collect();
    }
    else if text.starts_with("'") {
        text = text
            .chars()
            .skip(2)
            .collect();
    }
    text
}

pub fn trim_quotes(mut text: String) -> String {
    if text.starts_with("\"") {
        text.remove(0);
    }
    if text.ends_with("\"") {
        text.pop();
    }
    text
}
pub fn trim_escaped_quotes(mut text: String) -> String {
    if text.starts_with("\\\"") {
        text.remove(0);
        text.remove(0);
    }
    if text.ends_with("\\\"") {
        text.pop();
        text.pop();
    }
    text
}
pub fn trim_parens(mut text: String) -> String {
    if text.starts_with("(") {
        text.remove(0);
    }
    if text.ends_with(")") {
        text.pop();
    }
    text
}
pub fn unescape_quotes(text: &str) -> String {
    text.replace("\\\"", "\"")
}
pub fn quote(text: &str) -> Cow<str> {
    if text.starts_with("#'") {
        Cow::Borrowed(text)
    } else if text.starts_with("'") {
        Cow::Borrowed(text)
    } else {
        Cow::Owned(format!("'{}", text))
    }
}
pub fn add_leading_and_trailing_slash(mut text: String) -> String {
    if !text.starts_with("\\") && !text.starts_with("/") {
        if text.contains("\\") {
            text.insert(0, '\\');
        } else {
            text.insert(0, '/');
        }
    }
    if !text.ends_with("\\") && !text.ends_with("/") {
        if text.contains("\\") {
            text.push('\\');
        } else {
            text.push('/');
        }
    }
    text
}

//
// private functions
//

fn char_windows(src: &str, win_size: usize) -> impl Iterator<Item = &str> {
    src.char_indices().flat_map(move |(from, _)| {
        src[from..]
            .char_indices()
            .nth(win_size - 1)
            .map(|(to, c)| &src[from..from + to + c.len_utf8()])
    })
}
