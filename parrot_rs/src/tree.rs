use std::{collections::HashMap, ffi::OsStr, fs, path::Path, time::Instant};

use indextree::{Arena, NodeId};
use itertools::Itertools;
use serde_indextree::Node;
use walkdir::{DirEntry, WalkDir};

use crate::{
    file::{is_lisp_file, path_to_node_name},
    models::{FileTreeNode, FileTreeNodeType},
    text::u64_hash, BackendError,
};


//
// public functions
//

pub fn get_folder_tree(folder_path: &str) -> Result<(Arena<FileTreeNode>, NodeId), BackendError> {
    get_tree(folder_path, true)
}

pub fn get_file_tree(folder_path: &str) -> Result<(Arena<FileTreeNode>, NodeId), BackendError> {
    get_tree(folder_path, false)
}

///
/// Returns a vec containing the full file paths for all .md files contained in the folder and its subfolders.
///
pub fn get_all_lisp_files_in_folder(folder_path: &str) -> Vec<String> {
    WalkDir::new(folder_path)
        .min_depth(1)
        .max_depth(50)
        .into_iter()
        .filter_entry(|e| !is_hidden(e))
        .filter(|e| e.is_ok())
        .map(|e| e.unwrap())
        .filter(|e| e.file_type().is_file() && e.file_name().to_str().unwrap().ends_with(".lisp"))
        .map(|r| r.path().to_str().unwrap().to_string())
        .collect_vec()
}

///
/// Returns an iterator over the full file paths for all .lisp files contained in the folder and its subfolders.
///
pub fn get_all_lisp_files_in_folder_as_iter(folder_path: &str) -> Box<dyn Iterator<Item = String>> {
    Box::new(
        WalkDir::new(folder_path)
            .min_depth(1)
            .max_depth(50)
            .into_iter()
            .filter_entry(|e| !is_hidden(e))
            .filter(|e| e.is_ok())
            .map(|e| e.unwrap())
            .filter(|e| e.file_type().is_file() && e.file_name().to_str().unwrap().ends_with(".lisp"))
            .map(|r| r.path().to_str().unwrap().to_string()),
    )
}

///
/// Returns an iterator over a tuple of (file path, file content) for all .lisp files contained in the folder and its subfolders.
///
pub fn get_all_lisp_file_contents_in_folder_as_iter(
    folder_path: &str,
) -> Box<dyn Iterator<Item = (String, String)>> {
    Box::new(
        WalkDir::new(folder_path)
            .min_depth(1)
            .max_depth(50)
            .into_iter()
            .filter_entry(|e| !is_hidden(e))
            .filter(|e| e.is_ok())
            .map(|e| e.unwrap())
            .filter(|e| e.file_type().is_file() && e.file_name().to_str().unwrap().ends_with(".lisp"))
            .filter_map(|f| {
                std::fs::read_to_string(f.path())
                    .ok()
                    .map(|content| (f.path().to_str().unwrap().to_string(), content))
            }),
    )
}

pub fn path_to_tree_node_type(path: &Path) -> FileTreeNodeType {
    if path.is_dir() {
        FileTreeNodeType::Dir
    } else if is_lisp_file(path) {
        FileTreeNodeType::Lisp
    } else {
        FileTreeNodeType::Other
    }
}

pub fn get_folder_tree_as_json(folder_path: &str) -> Result<String, BackendError> {
    let (arena, root_node) = get_folder_tree(folder_path)?;
    get_tree_as_json(arena, root_node)
}
pub fn get_file_tree_as_json(folder_path: &str) -> Result<String, BackendError> {
    let (arena, root_node) = get_file_tree(folder_path)?;
    get_tree_as_json(arena, root_node)
}

//
// private functions
//

fn get_tree(
    folder_path: &str,
    folder_only: bool,
) -> Result<(Arena<FileTreeNode>, NodeId), BackendError> {
    // Create a new arena
    let mut arena = Arena::<FileTreeNode>::new();

    let folder_path_norm = if folder_path.ends_with('/') {
        folder_path[0..folder_path.len() - 1].to_string()
    } else {
        folder_path.to_string()
    };
    let id = u64_hash(&folder_path_norm);

    let path = Path::new(folder_path);
    let root_folder_name = path_to_node_name(path);
    let root_tree_node = FileTreeNode::new(folder_path, root_folder_name, FileTreeNodeType::Dir);
    let root_node = arena.new_node(root_tree_node);

    // new imp
    let mut node_ids = HashMap::<u64, NodeId>::new();
    node_ids.insert(id, root_node);

    for entry in WalkDir::new(folder_path)
        .min_depth(1)
        .max_depth(50)
        .into_iter()
        .filter_entry(|e| !is_hidden(e))
    {
        let entry = entry.unwrap();
        let path = entry.path();
        let parents_path = path.parent().unwrap().to_str().unwrap();
        let path_str = path.to_str().unwrap();

        let node_name = path_to_node_name(path);
        let node_type = path_to_tree_node_type(path);
        if matches!(node_type, FileTreeNodeType::Other) {
            continue;
        }

        let is_dir = matches!(node_type, FileTreeNodeType::Dir);
        if folder_only && !is_dir {
            continue;
        }
        let id = u64_hash(path_str);
        let fnode = FileTreeNode::new(path_str.replace('\\', "/"), node_name, node_type);
        let node_id = arena.new_node(fnode);

        if is_dir {
            node_ids.insert(id, node_id);
        }

        let parents_id = u64_hash(parents_path);
        let parent_node = node_ids.get(&parents_id).unwrap();
        parent_node.append(node_id, &mut arena);
    }
    Ok((arena, root_node))
}

fn get_tree_as_json(arena: Arena<FileTreeNode>, root: NodeId) -> Result<String, BackendError> {
    let as_json = serde_json::to_string(&Node::new(root, &arena))?;
    Ok(as_json)
}

fn walk_dir_rec(dir_path: &str, arena: &mut Arena<FileTreeNode>, parent: NodeId) {
    // 1. add the dir as node to the arena

    let path = Path::new(dir_path);
    let node_name = path_to_node_name(path);
    let node_type = path_to_tree_node_type(path);
    let is_dir = matches!(node_type, FileTreeNodeType::Dir);
    let fnode = FileTreeNode::new(dir_path, node_name, node_type);

    if is_dir {
        let children = get_dir_entries(dir_path);
        if !children.is_empty() {
            let node_id = arena.new_node(fnode);
            parent.append(node_id, arena);
            for c in children {
                walk_dir_rec(&c, arena, node_id);
            }
        }
    } else {
        let node_id = arena.new_node(fnode);
        parent.append(node_id, arena);
    }
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

fn get_dir_entries(dir_path: &str) -> Vec<String> {
    let mut res = Vec::<String>::new();
    for rd in fs::read_dir(dir_path).unwrap() {
        if rd.is_err() {
            continue;
        }
        let p = rd.unwrap().path();
        if p.is_dir()
            && !p
                .file_name()
                .map(|f| f.to_str().unwrap_or(""))
                .unwrap_or("")
                .starts_with('.')
        {
            res.push(p.to_str().map(|s| s.replace('\\', "/")).unwrap());
        } else if p.is_file()
            && matches!(
                p.extension().map_or("", |os| os.to_str().unwrap_or("")),
                "lisp" | "cl" | "pdf"
            )
        {
            res.push(p.to_str().map(|s| s.replace('\\', "/")).unwrap());
        }
    }
    res
}
