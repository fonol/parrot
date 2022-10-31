use serde::{Deserialize, Serialize};
use std::clone::Clone;

#[derive(Debug, Clone, Serialize)]
pub struct IdNamePair {
    pub id: u32,
    pub name: String,
}


#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FileTreeNode {
    pub path: String,
    pub name: String,
    pub node_type: FileTreeNodeType,
}
impl FileTreeNode {
    pub fn new<T1: Into<String>, T2: Into<String>>(
        path: T1,
        name: T2,
        node_type: FileTreeNodeType,
    ) -> Self {
        Self {
            path: path.into(),
            name: name.into(),
            node_type,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum FileTreeNodeType {
    Lisp,
    Dir,
    Other,
}

pub type LispForm = String;
pub type SymbolName = String;