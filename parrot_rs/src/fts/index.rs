use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, Instant};

use itertools::Itertools;
use lazy_static::lazy_static;
use regex::{Regex, RegexBuilder};

use crate::file::{to_rel_path, is_lisp_file, is_fasl_file, normalize_path, path_to_node_name};
use crate::error::BackendError;
use crate::tree::{get_all_lisp_files_in_folder_as_iter};
use crate::{ config, text::*, BackendResult };
use super::models::*;

pub const NGRAM_SIZE: usize = 3;

pub struct Index {
    root_folder: Option<String>,

    // contains all documents
    pub documents: HashMap<DocId, Document>,

    pub doc_ids: HashMap<String, DocId>,

    // maps a token to all documents where it is occurring in the name
    pub index_file_names: HashMap<u64, Vec<DocId>>,
    // maps doc ids to document content
    pub index_file_contents: HashMap<DocId, String>,

}
impl Index {
    pub fn new() -> Self {
        Self {
            root_folder: None,
            documents: HashMap::new(),
            doc_ids: HashMap::new(),
            index_file_names: HashMap::new(),
            index_file_contents: HashMap::new(),
        }
    }

    /// call this after a file's content has been updated
    pub fn handle_file_content_write(&mut self, file_path: &str) {
        debug_assert!(Path::new(file_path).exists());
        debug_assert!(Path::new(file_path).is_absolute());

        if let Some((docs_id, _)) = self.get_document(file_path) {
            self.index_file_contents.retain(|doc_id, _| docs_id.ne(doc_id));
            let _ = self.index_file_content(file_path, docs_id);
        } else {
            println!("WARN: Doc for path {} not found.", file_path);
        }
    }
    /// call this after a file's name has been updated or a file's path has changed
    pub fn handle_file_path_change(&mut self, file_path_old: &str, file_path_new: &str) {
        debug_assert!(Path::new(file_path_new).exists());
        debug_assert!(Path::new(file_path_new).is_absolute());
        debug_assert!(Path::new(file_path_old).is_absolute());

        if let Some((docs_id, _)) = self.get_document(file_path_old) {
            // 1. update in file name index
            for (_, doc_list) in self.index_file_names.iter_mut() {
                doc_list.retain(|doc_id| doc_id.ne(&docs_id));
            }
            self.index_file_names.retain(|_, v| !v.is_empty());
            let rel_path_old = to_rel_path(self.root_folder.as_ref().unwrap().as_str(), file_path_old);
            self.doc_ids.remove(&rel_path_old);
            let rel_path_new = to_rel_path(self.root_folder.as_ref().unwrap().as_str(), file_path_new);
            let tokens = ngram_tokenize_lowercase(&rel_path_new, NGRAM_SIZE);
            let doc = Document::new(&rel_path_new, &tokens);
            self.documents.insert(docs_id, doc);
            self.doc_ids.insert(rel_path_new, docs_id);

        } else {
            println!("WARN: Doc for path {} not found.", file_path_old);
        }
    }
    pub fn handle_dir_rename(&mut self, dir_path_old: &str, dir_path_new: &str) {
        debug_assert!(Path::new(dir_path_new).is_absolute());
        debug_assert!(Path::new(dir_path_old).is_absolute());

        let dir_path_old_rel = to_rel_path(self.root_folder.clone().unwrap().as_str(), dir_path_old);
        let doc_ids = self.get_documents_in_dir_rec(&dir_path_old_rel);
        for doc_id in doc_ids {
            let doc = self.remove_document(doc_id);
            let new_file_path = Path::new(dir_path_new).join(Path::new(&doc.path)
                    .strip_prefix(&dir_path_old_rel)
                    .expect("File should start with old folder path"));
            self.add_document(new_file_path).expect("File should exist");
        }

    }

    pub fn handle_files_deletion<P: AsRef<Path>>(&mut self, abs_paths: &Vec<P>) {
        for p in abs_paths {
            self.remove_document_if_existing(p);
        }
    }
    pub fn remove_document_if_existing<P: AsRef<Path>>(&mut self, fpath: P) -> Option<Document> {
        if let Some((docs_id, _)) = self.get_document(fpath.as_ref().to_str().unwrap()) {
            let doc = self.remove_document(docs_id);
            Some(doc)
        } else {
            println!("WARN: Doc for path {} not found.", fpath.as_ref().to_str().unwrap());
            None
        }
    }
    pub fn remove_document(&mut self, docs_id: DocId) -> Document {
            // 1. delete the file in content token -> file index
            self.index_file_contents.retain(|doc_id, _| docs_id.ne(doc_id));

            // 2. delete the file in name token -> file index
            for (_, doc_list) in self.index_file_names.iter_mut() {
                doc_list.retain(|doc_id| doc_id.ne(&docs_id));
            }
            self.index_file_names.retain(|_, v| !v.is_empty());

            // 4. delete the file in documents index
            let doc = self.documents.remove(&docs_id).unwrap();
            // let rel_path = to_rel_path(self.root_folder.as_ref().unwrap().as_str(), fpath.as_ref().to_str().unwrap());
            self.doc_ids.retain(|_, v| v.clone().ne(&docs_id));
            doc
    }

    pub fn add_document<P: AsRef<Path>>(&mut self, fpath: P) -> BackendResult<DocId> {
        let pth =fpath.as_ref();

        debug_assert!(pth.exists());
        debug_assert!(pth.is_absolute());

        let rel_path = to_rel_path(Path::new(self.root_folder.as_ref().unwrap()), fpath.as_ref());
        let doc_id = self.unused_doc_id();

        let tokens = ngram_tokenize_lowercase(&rel_path, NGRAM_SIZE);
        if is_lisp_file(pth) {
            self.index_file_content(fpath, doc_id);
        }
        let doc = Document::new(&rel_path, &tokens);
        let doc_was_present = self.documents.insert(doc_id, doc);
        debug_assert!(doc_was_present.is_none());
        let id_was_present = self.doc_ids.insert(rel_path, doc_id);
        debug_assert!(id_was_present.is_none());

        for t in tokens.into_iter().unique() {
            self.index_file_names
                .entry(t)
                .or_insert_with(Vec::new)
                .push(doc_id);
        }
        Ok(doc_id)
    }

    ///
    /// Empties the index and rebuilds it from the folder.
    ///
    pub fn build(&mut self, root_folder: String) {
        println!("Index::build()");
        let timer_start = Instant::now();

        self.root_folder = Some(root_folder.clone());
        let rc = root_folder.clone();
        let root_pth = Path::new(&rc);
        self.index_file_names.clear();
        self.index_file_contents.clear();
        self.documents.clear();
        self.doc_ids.clear();

        let paths_and_contents = get_all_lisp_files_in_folder_as_iter(&root_folder);


        for (id, full_path) in paths_and_contents.enumerate() {
            let rel_path = to_rel_path(&root_folder, &full_path);
            let pth = Path::new(&rel_path);
            if pth.file_name().is_none() {
                continue;
            }
            if !pth.is_dir() && pth.extension().is_none() {
                continue;
            }

            let tokens = ngram_tokenize_lowercase(&rel_path, NGRAM_SIZE);

            let doc = Document::new(&rel_path, &tokens);
            self.documents.insert(id as u32, doc);
            for t in tokens.into_iter().unique() {
                self.index_file_names
                    .entry(t)
                    .or_insert_with(Vec::new)
                    .push(id as u32);
            }
            self.doc_ids.insert(normalize_path(&rel_path), id as u32);

            // if file is a source file, index file content
            if is_lisp_file(pth) {
                let abs_path = root_pth.join(&pth);
                self.index_file_content(abs_path, id as u32);
            }
        }
        let elapsed = timer_start.elapsed();
        println!("Index::build(): took {:?} ms", elapsed);
        println!("Index contains {} items", self.documents.len());
    }

    pub fn search_source_files(
        &self,
        query: &str,
        ignore_case: bool,
        is_regex: bool,
        limit: usize,
    ) -> BackendResult<SourceFileSearchResult> {

        let mut count: usize = 0;
        let mut file_match_count: usize = 0;


        let mut res = Vec::<FileContentSearchResultGroup>::new();
        if is_regex {
            match RegexBuilder::new(query).case_insensitive(ignore_case).build() {
                Ok(re) => {
                    for (doc_id, content) in self.index_file_contents.iter() {
                        if count >= limit {
                            break;
                        }
                        if re.is_match(content) {

                            let mut found = Vec::<FileContentLineResult>::new();
                            for m in re.find_iter(content) {
                                let pos = m.start();
                                let (line_ix, line_pos, line) = get_line_from_byte_offset(&content, pos);
                                let (ctx, ctx_offset) = get_surrounding_context(&line, line_pos, 20);

                                found.push(FileContentLineResult { 
                                      line: line_ix,
                                      context: ctx,
                                      col: line_pos,
                                      to_mark: m.as_str().to_string(),
                                      to_mark_ix: line_pos - ctx_offset
                                    });
                                count+= 1;
                                if count >= limit {
                                    break;
                                }
                            }
                            let doc = self.documents.get(doc_id).unwrap();

                            res.push(FileContentSearchResultGroup {
                                file_name: path_to_node_name(&Path::new(&doc.path)).to_string(),
                                folder_name: Path::new(&doc.path)
                                    .parent()
                                    .unwrap()
                                    .file_name()
                                    .unwrap()
                                    .to_str()
                                    .unwrap()
                                    .to_string(),
                                path_to_file: Path::new(&self.root_folder.as_ref().unwrap()).join(&doc.path).to_str().unwrap().to_string(),
                                matches: found
                            });
                            file_match_count += 1;
                        }
                    }
                    Ok(SourceFileSearchResult { results: res, too_many_results: count >= limit, match_count: count, file_match_count })
                },
                Err(e) => {
                    Err(BackendError(format!("Invalid regex: {}", e)))
                }
            }
        } else {
            let q = if ignore_case {
                query.to_lowercase()
            } else {
                query.to_string()
            };
            for (doc_id, doc_content) in self.index_file_contents.iter() {
                if count >= limit {
                    break;
                }
                let content = if ignore_case {
                    doc_content.to_lowercase()
                } else {
                    doc_content.to_string()
                };
                if content.contains(&q) {

                    let mut found = Vec::<FileContentLineResult>::new();
                    for mi in content.match_indices(&q) {
                        let byte_offset = mi.0;
                        let (line_ix, line_pos, line) = get_line_from_byte_offset(doc_content, byte_offset);
                        let (ctx, ctx_offset) = get_surrounding_context(&line, line_pos, 20);
                        found.push(FileContentLineResult { 
                          line: line_ix,
                          context: ctx,
                          col: line_pos,
                          to_mark: mi.1.to_string(),
                          to_mark_ix: line_pos - ctx_offset
                        });
                        count+= 1;
                        if count >= limit {
                            break;
                        }
                    }
                    let doc = self.documents.get(doc_id).unwrap();

                    res.push(FileContentSearchResultGroup {
                        file_name: path_to_node_name(&Path::new(&doc.path)).to_string(),
                        folder_name: Path::new(&doc.path)
                            .parent()
                            .unwrap()
                            .file_name()
                            .unwrap()
                            .to_str()
                            .unwrap()
                            .to_string(),
                        path_to_file: Path::new(&self.root_folder.as_ref().unwrap()).join(&doc.path).to_str().unwrap().to_string(),
                        matches: found
                    });
                    file_match_count += 1;

                }

            }
            Ok(SourceFileSearchResult { results: res, too_many_results: count >= limit, match_count: count, file_match_count })
        }
    }


    //
    // private functions
    //
    

    fn unused_doc_id(&self) -> DocId {
        let max_key = self.documents.keys().max().unwrap();
        *max_key + 1
    }
    fn get_doc_id(&self, rel_path: &str) -> Option<DocId> {

            self.doc_ids.get(rel_path)
            .or_else(|| self.doc_ids.get(&format!("/{}", rel_path)))
            .map(|v| v.to_owned())
    }

    fn index_file_content<P: AsRef<Path>>(&mut self, fpath: P, doc_id: DocId) -> String {
        let content = fs::read_to_string(fpath.as_ref()).unwrap();
        self.index_file_contents
            .entry(doc_id)
            .or_insert(content.clone());
        content
    }

    fn rank_tf_idf(
        &self,
        query: &str,
        tokens: Vec<u64>,
        docs_found: HashSet<DocId>
    ) -> Vec<DocId> {
        let mut scores = Vec::<(DocId, f64)>::new();
        let docs_len = self.documents.len();
        for doc_id in docs_found {
            let doc = self.documents.get(&doc_id).unwrap();
            let mut score = 0.0;
            for token in &tokens {
                let tf = doc.term_freq(*token);
                let idf = self.inverse_document_frequency(*token, docs_len);
                score += tf as f64 * idf;
                if doc.token_is_in_name(*token) {
                    score += 3.0;
                }
            }

            scores.push((doc_id, score));
        }
        scores.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Less));
        scores.reverse();
        scores.iter().map(|s| s.0).collect()
    }

    fn rank_ngrams(&self, doc_counts: HashMap<DocId, usize>, mode: SearchMode) -> Vec<DocId> {
        let mut res = Vec::<DocId>::new();
        for doc_id in doc_counts
            .into_iter()
            .sorted_by(|e1, e2| e2.1.cmp(&e1.1))
            .map(|e| e.0)
        {
            let doc = self.documents.get(&doc_id).unwrap();
           
            res.push(doc_id);
        }
        res
    }
    fn document_frequency(&self, token: u64) -> usize {
        match self.index_file_names.get(&token) {
            Some(doc_list) => doc_list.len(),
            None => 0,
        }
    }
    fn inverse_document_frequency(&self, token: u64, docs_len: usize) -> f64 {
        ((docs_len / self.document_frequency(token).max(1)) as f64)
            .log10()
    }

    fn get_document(&self, fpath: &str) -> Option<(DocId, Document)> {
        let rel_path = to_rel_path(self.root_folder.as_ref().unwrap().as_str(), fpath);

        let doc = self
            .documents
            .iter()
            .find(|e| e.1.path.eq(&rel_path))
            .map(|v| (*v.0, v.1.clone()));

        doc
    }

    fn get_documents_in_dir_rec<P: AsRef<Path>>(&self, dir_path: P) -> Vec<DocId> {
        self
            .documents
            .iter()
            .filter(|e| Path::new(&e.1.path).starts_with(dir_path.as_ref()))
            .map(|v| *v.0)
            .collect()
    }

    fn get_documents_id(&self, path: &str) -> Option<DocId> {
        let docs_id = self
            .documents
            .iter()
            .find(|e| e.1.path.eq(path))
            .map(|v| *v.0);

        docs_id
    }

}

fn path_to_file_type(path: &Path) -> FileType {
    if path.is_dir() {
        FileType::Dir
    } else if is_lisp_file(path) {
        FileType::Lisp
    } else if is_fasl_file(path) {
        FileType::Fasl
    } else {
        FileType::Other
    }
}
