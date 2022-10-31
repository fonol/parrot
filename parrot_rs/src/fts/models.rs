use std::clone::Clone;
use std::collections::HashMap;
use std::path::Path;

use itertools::Itertools;
use serde::{Deserialize, Serialize};

use crate::{models::FileTreeNodeType, text::ngram_tokenize_lowercase};

use super::index::NGRAM_SIZE;

pub type DocId = u32;

#[derive(Clone)]
pub struct Document {
    pub path: String,
    pub name_lower: String,
    term_frequencies: HashMap<u64, u32>,
    name_tokens: Vec<u64>,
}
impl Document {
    pub fn new(path: &str, tokens: &[u64]) -> Self {
        debug_assert!(!Path::new(path).is_absolute());

        let mut tf = HashMap::new();
        let name = Path::new(path).file_name().unwrap().to_str().unwrap();
        let name_tokens = ngram_tokenize_lowercase(name, NGRAM_SIZE);
        for t in tokens.iter() {
            *tf.entry(*t).or_insert(0) += 1; 
        }

        Self {
            term_frequencies: tf,
            name_lower: name.to_lowercase(),
            path: path.to_string(),
            name_tokens,
        }
    }
    pub fn term_freq(&self, token: u64) -> u32 {
        match self.term_frequencies.get(&token) {
            Some(count) => *count,
            None => 0,
        }
    }
    pub fn token_is_in_name(&self, token: u64) -> bool {
        self.name_tokens.contains(&token)
    }
}

#[derive(Serialize, Deserialize)]
pub struct FileFolderSearchResult {
    pub full_path: String,
    pub rel_path: String,
    pub leaf_name: String,
    pub ntype: FileTreeNodeType,
    pub last_mod: String,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub enum FileSort {
    NameAsc,
    NameDesc,
    LastModAsc,
    LastModDesc,
}

#[derive(Clone, Copy)]
pub enum SearchMode {
    FilesFolders,
    Files
}
#[derive(Serialize, Deserialize)]
pub enum FileType {
    Lisp,
    Dir,
    Fasl,
    Other
}

#[derive(Serialize, Deserialize)]
pub struct FileContentSearchResultGroup {
    pub path_to_file: String,
    pub file_name: String,
    pub folder_name: String,
    pub matches: Vec<FileContentLineResult>

}

#[derive(Serialize, Deserialize)]
pub struct FileContentLineResult {
    pub context: String,
    pub line: usize,
    pub col: usize
}

#[derive(Serialize, Deserialize)]
pub struct SourceFileSearchResult {
    pub results: Vec<FileContentSearchResultGroup>,
    pub too_many_results: bool,
    pub match_count: usize,
    pub file_match_count: usize

}

   
#[derive(Serialize, Deserialize)]
pub struct PaginatedFileResult {
    pub files: Vec<FileFolderSearchResult>,
    pub page: usize,
    pub pages_total: usize,
    pub results_total: usize,
}
