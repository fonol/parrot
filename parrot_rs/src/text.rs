use itertools::Itertools;
use lazy_static::lazy_static;
use regex::Regex;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;

lazy_static! {
    static ref RE_TOKENIZE: Regex = Regex::new(r#"(?i)[ /\\,_$'";:.+*`&()?!<>-]"#).unwrap();
}

//
// public functions
//

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

#[inline(always)]
pub fn u64_hash(text: &str) -> u64 {
    let mut s = DefaultHasher::new();
    text.hash(&mut s);
    s.finish()
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
pub fn unescape_quotes(text: &str) -> String {
    text.replace("\\\"", "\"")
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
