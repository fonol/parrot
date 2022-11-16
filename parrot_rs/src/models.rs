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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum SymbolType {
    Macro,
    Function,
    Class,
    Var
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Symbol {
    pub name: String,
    pub stype: SymbolType 
}

///
/// Messages coming from Slynk server
///
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SlynkAnswer {
    WriteString {
        value: String,
        repl_result: bool,
    },
    NewPackage {
        package_name: String, 
        prompt: String
    },
    Return {
        continuation: usize,
        status: ReturnStatus,
        value: String
    },
    ReturnCompilationResult {
        continuation: usize,
        notes: Option<Vec<CompilerNotes>>,
        success: bool,
        duration: f64,
        loadp: bool,
        fasl_file: Option<String>
    },
    ReturnFindDefinitionResult {
        continuation: usize,
        definitions: Vec<FoundDefinition>
    },
    Debug {
        thread: usize,
        level: usize,
        condition: DebugCondition,
        restarts: Vec<Restart>,
        frames: Vec<String>,
        continuations: Vec<String>
    },
    DebugActivate {
        level: usize,
        thread: usize
    },
    DebugReturn {
        level: usize,
        thread: usize
    },
    ChannelSend {
        channel: usize,
        method: ChannelMethod
    },
    ReadFromMinibuffer{
        thread: usize,
        tag: usize, // what does this do? Same as continuation?
        prompt: String,
        initial_value: Option<String>
    },
    IndentationUpdate,
    NewFeatures,
    // added, not from Slynk
    Notify {
        text: String,
        error: bool
    },
    ResolvePending {
        continuation: usize,
        data: String
    }

}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ReturnStatus {
    Ok, 
    Abort
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompilerNotes {
    pub message: String,
    pub severity: String,
    pub file: Option<String>,
    pub position: Option<usize>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundDefinition {
    pub label: String,
    pub error: Option<String>,
    pub file: Option<String>,
    pub position: Option<usize>,
    pub snippet: Option<String>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChannelMethod {
    Prompt{
        package: String,
        prompt: String,
        elevel: usize,
        len_history: usize,
        condition: Option<String>

    }, 
    WriteValues(Vec<(String, usize, String)>),
    WriteString(String),
    EvaluationAborted(String),
    Unknown(String)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restart {
    pub short: String,
    pub desc: String
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugCondition {
    pub desc: String,
    pub ctype: String
}

///
/// Messages sent to Slynk server
/// 
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SlynkMessage {
    Eval(String),
    InteractiveEval(String),
    InvokeNthRestart(usize, usize, usize),
    CompileAndLoadFile(String),
    LoadFile(String),
    FindDefinitions(String),
    Stop,
    EmacsReturn(String, usize, usize),
    CompileStringForEmacs{
        string: String,
        buffer: String,
        position: EditorPosition,
        filename: Option<String>,
        policy: Option<String> // ?
    },
    ListAllPackages(usize),
    ListSymbolsInPackage{
        package: String,
        vars: bool,
        macros: bool,
        functions: bool,
        classes: bool,
        cont: usize
    },
    DescribeForSymbolInfo {
        symbol: String,
        cont: usize
    },
    AproposForSymbolInfo {
        symbol: String,
        cont: usize
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorPosition {
    pub pos: usize,
    pub line: usize,
    pub col: usize
}

#[derive(Debug, Clone)]
pub enum ContinuationCallback {
    PrintReturnValue(PrintKind),
    Print(String, PrintKind),
    LoadFile,
    JumpToDef,
    DisplayPackages(usize),
    DisplaySymbolsInPackage(usize),
    DisplayDescribe(usize),
    DisplayApropos(usize),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrintKind {
    Repl,
    Notification,
}
