use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::net::TcpStream;
use std::thread;
use std::io::{BufRead, BufReader, Write, Read};
use std::process::{Command, Stdio, Child, ChildStdin};
use std::sync::{Mutex, Arc, RwLock};
use crossbeam::{unbounded, bounded, Sender, Receiver};
use regex::{Regex, RegexBuilder};
use serde::{Serialize, Deserialize};

use std::thread::sleep;
use std::time::Duration;
use os_pipe::{self, PipeWriter};
use utf8_chars::BufReadCharsExt;
use crate::text::{trim_quotes, unescape_quotes, escape_quotes};
use crate::{BackendResult, BackendError};
use lazy_static::lazy_static;
use sexp::{self, Atom, Sexp};

pub const STOP_SIG: &str = "REPL~QUIT"; 

lazy_static! {
    // parsing swank :return messages
    static ref CONTINUATION: Regex = Regex::new(r" ([0-9]+)\)$").unwrap();
    static ref RETURN_VALUE: Regex = RegexBuilder::new("\\(:return \\(:(?:ok|abort) (?:(?P<value>(?:.|\n|\t)+)|(?P<nil>nil))\\) [0-9]+\\)$").multi_line(true).build().unwrap();
    static ref FIND_DEFINITION_RESULT: Regex = RegexBuilder::new("(?:\\((\\(\"(?P<label>.+)\" \\(:location \\(:file \"(?P<file>.+)\"\\) \\(:position (?P<pos>[0-9]+)\\) \\(:snippet \"(?P<snippet>(?:.|\n|\t)+)\"\\)\\)\\) ?)+\\)|(?P<nil>nil))$").multi_line(true).build().unwrap();
    static ref WRITE_STRING: Regex = Regex::new("\\(:write-string \"((?:.|\n)+)\"( :repl-result)?\\)$").unwrap();
    static ref WRITE_VALUES: Regex = Regex::new("\\(:write-values (?:\\((\\(\".+\" [0-9]+ (?:\".+\"|nil)\\))+\\)|nil)\\)$").unwrap();
    static ref EVALUATION_ABORTED: Regex = Regex::new("\\(:evaluation-aborted \"(?P<message>.+)\"\\)$").unwrap();
    static ref PROMPT: Regex = Regex::new("\\(:prompt \"(.+)\" \"(.+)\" (?P<elevel>[0-9]+) (?P<len_history>[0-9]+)( \"(?P<condition>.+)\")?\\)$").unwrap();
    static ref CHANNEL_SEND: Regex = RegexBuilder::new("\\(:channel-send ([0-9]+) (\\((?:.|\n)+\\))\\)$").multi_line(true).build().unwrap();
    static ref COMPILATION_RESULT: Regex = RegexBuilder::new("\\(:compilation-result (?P<notes>nil|\".+\"|\\((\\(.+\\))+\\)) (?P<success>nil|t) (?P<duration>[0-9]+\\.[0-9]+) (?P<loadp>nil|t) (?P<faslfile>nil|\".+\")\\)$").dot_matches_new_line(true).build().unwrap();
    static ref COMPILER_NOTES: Regex = RegexBuilder::new("\\((\\(:message \"(?P<message>.+)\" :severity :(?P<severity>[^ ]+) :location \\(:location \\(:file \"(?P<file>.+)\"\\) \\(:position .+\\) nil\\) :references .+\\))+\\)").build().unwrap();
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

}
impl SlynkAnswer {
    pub fn parse(m: &str) -> Self {

        if !m.starts_with("(:indentation-update ") {
            println!("Parsing: {}", m);
        }
        if m.starts_with("(:indentation-update ") {
            Self::IndentationUpdate
        }  else if m.starts_with("(:channel-send ") {
            let cap = CHANNEL_SEND.captures(m).unwrap();
            let channel = cap.get(1).unwrap().as_str().parse::<usize>().unwrap();
            let form = cap.get(2).unwrap().as_str();
            Self::ChannelSend { channel, method: ChannelMethod::parse(form) }
        }
        
        
        else if m.starts_with("(:return ") {
            let status = if m.starts_with("(:return (:ok") {
                ReturnStatus::Ok
            } else {
                ReturnStatus::Abort
            };
            let cont_str = CONTINUATION.captures(m)
                    .unwrap()
                    .get(1)
                    .unwrap()
                    .as_str();

            let continuation = cont_str
                .parse::<usize>()
                .unwrap();

            let mut captures = RETURN_VALUE.captures(m).unwrap();
            let value = captures
                    .name("value")
                    .or(captures.name("nil"))
                    .unwrap()
                    .as_str()
                    .replace("\\\"", "\"");

            if FIND_DEFINITION_RESULT.is_match(&value) {
                let mut definitions = vec![];
                for c in FIND_DEFINITION_RESULT.captures_iter(&value) {
                    let label = c.name("label").unwrap().as_str().to_string();
                    let file = c.name("file").map(|m| m.as_str().to_string());
                    let position = c.name("pos").unwrap().as_str().parse::<usize>().unwrap();
                    let snippet = c.name("snippet").unwrap().as_str().to_string();
                    definitions.push(FoundDefinition {
                        label, 
                        file,
                        position,
                        snippet
                    });
                } 
                Self::ReturnFindDefinitionResult { continuation, definitions } 

            } else if COMPILATION_RESULT.is_match(&value) {

                captures = COMPILATION_RESULT.captures(&value).unwrap();
                let cnotes = captures.name("notes").unwrap().as_str();
                let notes = if COMPILER_NOTES.is_match(&cnotes) {
                    let mut lnotes = vec![];
                    for c in COMPILER_NOTES.captures_iter(&cnotes) {
                        let message = c.name("message").unwrap().as_str().to_string();
                        let severity = c.name("severity").unwrap().as_str().to_string();
                        let file = c.name("file").map(|m| m.as_str().to_string());
                        lnotes.push(CompilerNotes {
                            message, 
                            severity,
                            file
                        });
                    }
                    Some(lnotes)
                } else {
                    None
                };
                let success = captures.name("success").unwrap().as_str().eq_ignore_ascii_case("t");
                let duration = captures.name("duration").unwrap().as_str().parse::<f64>().unwrap();
                let loadp = captures.name("loadp").unwrap().as_str().eq_ignore_ascii_case("t");
                let fasl_file = option_str(&trim_quotes(captures.name("faslfile").unwrap().as_str().to_string()));

                Self::ReturnCompilationResult { continuation, notes, success, duration, loadp, fasl_file }
            } else {
                Self::Return {
                    continuation,
                    value: value,
                    status: status
                }
            }

        } else if m.starts_with("(:new-features ") {
            Self::NewFeatures
        } else if m.starts_with("(:debug ") {

            let sexp = sexp::parse(m).unwrap();
            match sexp {
                Sexp::List(children) => {
                    let thread = match &children[1] {
                        Sexp::Atom(Atom::I(t)) => *t as usize,
                        _ => panic!("Failed to parse thread")
                    };
                    let level = match children[2] {
                        Sexp::Atom(Atom::I(lvl)) => {
                            lvl as usize
                        },
                        _ => panic!("Should be atom")
                    };
                    let condition = match &children[3] {
                        Sexp::List(condition) => {
                            DebugCondition { 
                                desc: unescape_quotes(&trim_quotes(condition[0].to_string())),
                                ctype: unescape_quotes(&trim_quotes(condition[1].to_string()))
                            }
                        },
                        _ => panic!("Should be list")
                    };
                    let restarts = match &children[4] {
                        Sexp::List(restarts) => {
                            restarts.iter().map(|r| match r {
                                Sexp::List(rparts) => {
                                    let mut desc = unescape_quotes(&rparts[1].to_string());
                                    desc.pop();
                                    Restart { short: rparts[0].to_string(), desc: desc.chars().skip(1).collect() }
                                },
                                _ => panic!("Should be list")
                            }).collect()
                        },
                        _ => panic!("Should be list")
                    };
                    let frames = match &children[5] {
                        Sexp::List(frames) => {
                            frames.iter().map(|f| f.to_string()).collect()
                        },
                        _ => panic!("Should be list")
                    };
                    let continuations = match &children[6] {
                        Sexp::List(conts) => {
                            conts.iter().map(|f| f.to_string()).collect()
                        },
                        Sexp::Atom(_) => {
                            vec![]
                        }
                    };
                    return Self::Debug {
                        thread,
                        level,
                        condition,
                        restarts,
                        frames,
                        continuations
                    }
                },
                sexp::Sexp::Atom(_) => {
                    panic!("Debug should always be a list!");
                }
            }
        } else if m.starts_with("(:debug-activate ") {
            let sexp = sexp::parse(m).unwrap();
            let thread = match &sexp {
                Sexp::List(children) => {
                    children[1].to_string().parse::<usize>().unwrap()
                },
                _ => panic!("Should be list")
            };
            let level = match &sexp {
                Sexp::List(children) => {
                    children[2].to_string().parse::<usize>().unwrap()
                },
                _ => panic!("Should be list")
            };
            Self::DebugActivate { level, thread }
        } else if m.starts_with("(:debug-return ") {
            let sexp = sexp::parse(m).unwrap();
            let thread = match &sexp {
                Sexp::List(children) => {
                    children[1].to_string().parse::<usize>().unwrap()
                },
                _ => panic!("Should be list")
            };
            let level = match &sexp {
                Sexp::List(children) => {
                    children[2].to_string().parse::<usize>().unwrap()
                },
                _ => panic!("Should be list")
            };
            Self::DebugReturn { level, thread }
        } else if m.starts_with("(:write-string ") {
            let repl_result = m.ends_with(":repl-result)");
            let value = unescape_quotes(WRITE_STRING.captures(m)
                    .unwrap()
                    .get(1)
                    .unwrap()
                    .as_str());
            Self::WriteString { value, repl_result }
        } else if m.starts_with("(:read-from-minibuffer ") {
            let sexp = sexp::parse(m).unwrap();
            match &sexp {
                Sexp::List(children) => {
                    let thread = children[1].to_string().parse::<usize>().unwrap();
                    let tag = children[2].to_string().parse::<usize>().unwrap();
                    let prompt = trim_quotes(children[3].to_string());
                    let init = children[4].to_string();
                    let initial_value = match &init[..] {
                        "nil" => None,
                        v => Some(v.to_string())
                    };
                    Self::ReadFromMinibuffer { thread, tag, prompt, initial_value }
                },
                _ => panic!("Should be list")
            }
        } else {
            Self::IndentationUpdate
        }
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
    pub file: Option<String>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoundDefinition {
    pub label: String,
    pub file: Option<String>,
    pub position: usize,
    pub snippet: String
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
impl ChannelMethod {
    pub fn parse(answer: &str) -> Self {

        if answer.starts_with("(:write-string ") {
            let to_write = WRITE_STRING.captures(answer)
            .unwrap()
            .get(1)
            .unwrap()
            .as_str();
            return Self::WriteString(to_write.to_string())
        }
        if answer.starts_with("(:prompt ") {
            let cap = PROMPT.captures(answer)
            .unwrap();
            let package = cap.get(1).unwrap().as_str().to_string();
            let prompt = cap.get(2).unwrap().as_str().to_string();
            let elevel = cap.name("elevel").unwrap().as_str().parse::<usize>().unwrap();
            let len_history = cap.name("len_history").unwrap().as_str().parse::<usize>().unwrap();
            let condition = cap.name("condition").map(|m| unescape_quotes(m.as_str()));
            return Self::Prompt {
                package,
                prompt,
                elevel,
                len_history,
                condition
            };
        }
        if answer.starts_with("(:write-values ") {
            let cap = WRITE_VALUES.captures(answer).unwrap();
            if answer == "(:write-values nil)" {
                return Self::WriteValues(vec![]);
            }
            let mut values = vec![];
            for val_tup in cap.iter().skip(1) {
                let sp = sexp::parse(val_tup.unwrap().as_str()).unwrap();
                if let Sexp::List(vlist) = sp {
                    let val = sexp_string_atom(&vlist[0]).unwrap();
                    let hlen = sexp_usize_atom(&vlist[1]).unwrap();
                    let symbol = sexp_string_atom(&vlist[2]).unwrap();
                    values.push((val, hlen, symbol));
                }
            }
            return Self::WriteValues(values);
        }
        if answer.starts_with("(:evaluation-aborted ") {
            let cap = EVALUATION_ABORTED.captures(answer).unwrap();
            return Self::EvaluationAborted(cap.iter().skip(1).map(|c| c.unwrap().as_str().to_string()).collect());
        }
        Self::Unknown(answer.to_string())
    }
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
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorPosition {
    pos: usize,
    line: usize,
    col: usize
}

#[derive(Debug, Clone)]
pub enum ContinuationCallback {
    PrintReturnValue(PrintKind),
    Print(String, PrintKind),
    LoadFile,
    JumpToDef
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrintKind {
    Repl,
    Notification,
}

pub struct REPL {

    //
    // parameters
    //

    // the slynk server to talk to, e.g. 127.0.0.1:4005
    socket: String,

    // sbcl path
    path: String,
    // sbcl args
    args: Vec<String>,

    //
    // process & commmunication
    //
    child: Child,
    slynk_repl_sender: Sender<SlynkMessage>,
    // receives Answers from Slynk server
    rec_tcp: Receiver<SlynkAnswer>,
    // receives stdout from SBCL process
    rec_sbcl_process: Receiver<String>,

    out_buf : Arc<Mutex<String>>,
    // collects the output from the sbcl process
    sbcl_process_out: Arc<Mutex<Vec<String>>>,

    // continuation counter for emacs-rex calls
    cont: Arc<Mutex<usize>>,

    // pending actions
    // e.g. printing the return of an evalutation
    // e.g. loading the returned .fasl file of a compilation call
    pending: Arc<Mutex<HashMap<usize, ContinuationCallback>>>,



    //
    // REPL
    //

    // current package
    package: Arc<Mutex<String>>,

    // current prompt
    prompt: Arc<Mutex<String>>,

    //
    // meta
    //
    pub init_err: Option<String>

}


impl REPL {
    pub fn new<T: AsRef<str>>(socket: String, path: &str, args: &[T]) -> Self {
        println!("REPL::new(socket={}, path={}, args={:?})", &socket, path, args.iter().map(|a| a.as_ref()).collect::<Vec<&str>>());

        let mut c = Command::new(path);
        for a in args {
            c.arg(a.as_ref());
        }
        let (reader, writer_out) = os_pipe::pipe().unwrap();
        let writer_err = writer_out.try_clone().unwrap();
        // let writer_cancel = writer_out.try_clone().unwrap();

        let child = 
            c
            // .stdin(Stdio::piped())
            .stdout(writer_out)
            .stderr(writer_err)
            .spawn()
            .expect("SBCL command failed to start");
        
        
        let (sender_tcp, rec_tcp) = bounded::<SlynkAnswer>(0);
        let (sender_sbcl_process, rec_sbcl_process) = unbounded::<String>();
        let (slynk_repl_sender, slynk_repl_receiver) = bounded::<SlynkMessage>(0);


        let arc_cont = Arc::new(Mutex::new(0 as usize));
        let arc_package = Arc::new(Mutex::new(String::from("COMMON-LISP-USER")));
        let arc_prompt = Arc::new(Mutex::new(String::from("CL-USER")));

        let mut init_err: Option<String> = None;

        // 
        // thread that listens to receiver_1 and sends the messages to the process' stdin
        // let mut stdin = child.stdin.take().unwrap();
        // thread::spawn(move || {
        //     for line in receiver_1 {
        //         if line.contains(STOP_SIG) {

        //             println!("stdin writer: quit");
        //             break;
        //         }
        //         println!("writing to stdin: {} {}", &line, line.len());
        //         stdin.write_all(line.as_bytes()).unwrap();
        //         if !line.ends_with("\n") {
        //             stdin.write("\n".as_bytes()).unwrap();
        //         }
        //     }
        // });

        let out_buf = Arc::new(Mutex::new(String::from("")));
        let sbcl_process_out = Arc::new(Mutex::new(vec![]));
        // 
        // thread that listens to the sbcl process' stdout & stderr
        //
        let mut f = BufReader::new(reader);
        let out_buf_handle = out_buf.clone();
        let scbl_process_out_handle = sbcl_process_out.clone();
        thread::spawn(move || {
            println!("Listener thread for SBCL stdout process starting...");
            for c in f.chars().map(|x| x.unwrap()) {
                let mut out_buf = out_buf_handle.lock().unwrap();
                out_buf.push(c);
                if out_buf.contains(STOP_SIG) {
                    // still send a message so that any receivers also quit
                    sender_sbcl_process.send(out_buf.clone()).expect("Failed to send.");

                    // store output in internal buffer
                    let mut sbcl_out = scbl_process_out_handle.lock().unwrap();
                    sbcl_out.push(out_buf.clone());

                    println!("BufReader: quit");
                    break;
                } 
               if c == '\n' {
                    sender_sbcl_process.send(out_buf.clone()).expect("Failed to send.");
                    // store output in internal buffer
                    let mut sbcl_out = scbl_process_out_handle.lock().unwrap();
                    sbcl_out.push(out_buf.clone());
                    out_buf.clear();
                }             
            }
        });

        let pending = Arc::new(Mutex::new(HashMap::<usize, ContinuationCallback>::new()));

        let mut tcp_write_try = TcpStream::connect(&socket);
        let mut connect_try = 1;
        while tcp_write_try.is_err() && connect_try < 6 {
            println!("Could not connect to Slynk server over socket {}. Retry {} of 5 in 500ms...", &socket, &connect_try);
            thread::sleep(Duration::from_millis(500));
            connect_try += 1;
            tcp_write_try = TcpStream::connect(&socket);
        }
        if tcp_write_try.is_err() {
            init_err = Some("Failed to connect to Slynk server".to_string());
        } else {
            let mut tcp_write = tcp_write_try.expect(&format!("ABORT: Could not connect to Slynk server over socket {}.", &socket));
            let mut tcp_read = tcp_write.try_clone().expect("Could not clone stream");

            // // thread that reads incoming messages from swank/slynk server
            let package_handle = arc_package.clone();
            let prompt_handle = arc_prompt.clone();
            let pending_handle_out = pending.clone();
            let slynk_repl_sender_handle = slynk_repl_sender.clone();
            thread::spawn(move || {

                loop {
                    let mut buf = [0 as u8;6];
                    let message_len;
                    match tcp_read.read_exact(&mut buf) {
                        Ok(_) => {
                            message_len = i64::from_str_radix(String::from_utf8_lossy(&buf).as_ref(), 16).unwrap();
                            println!("Got answer, message len: {}", message_len);
                        },
                        Err(e) => {
                            println!("Could not read response: {}", e);
                            break;
                        }
                    };
                    let mut bbuf = vec![0 as u8; message_len as usize];
                    tcp_read.read_exact(&mut bbuf).expect("Could not read message body.");
                    let body = String::from_utf8(bbuf).unwrap();
                    let sw = SlynkAnswer::parse(&body);

                    // handle answer
                    println!("Got SlynkAnswer: {:?}", &sw);
                    let rets = pending_handle_out
                        .lock()
                        .unwrap();
                    match &sw {
                        SlynkAnswer::ChannelSend { method, .. } => {
                            if let ChannelMethod::Prompt { package, prompt, .. } = method {
                                let mut pr = prompt_handle.lock().unwrap();
                                let mut pa = package_handle.lock().unwrap();
                                *pr = prompt.clone();
                                *pa = package.clone();
                            }
                        },
                        SlynkAnswer::Return { continuation, status, value } => {
                            if rets.contains_key(continuation) {
                                match &rets[continuation] {

                                    ContinuationCallback::PrintReturnValue(PrintKind::Repl) => 
                                        sender_tcp.send(SlynkAnswer::WriteString { value: trim_quotes(value.clone()), repl_result: false }).expect("Could not send"),
                                    ContinuationCallback::PrintReturnValue(PrintKind::Notification) => 
                                        sender_tcp.send(SlynkAnswer::Notify { text: trim_quotes(value.clone()), error: !matches!(status, &ReturnStatus::Ok) }).expect("Could not send"),
                                    ContinuationCallback::Print(message, PrintKind::Repl) => 
                                        sender_tcp.send(SlynkAnswer::WriteString { value: trim_quotes(message.clone()), repl_result: false }).expect("Could not send"),
                                    ContinuationCallback::Print(message, PrintKind::Notification) => 
                                        sender_tcp.send(SlynkAnswer::Notify { text: trim_quotes(message.clone()), error: !matches!(status, &ReturnStatus::Ok) }).expect("Could not send"),
                                    ContinuationCallback::JumpToDef => 
                                        sender_tcp.send(SlynkAnswer::Notify { text: value.clone(), error: !matches!(status, &ReturnStatus::Ok) }).expect("Could not send"),
                                     _ => ()
                                }
                            }
                         },
                         SlynkAnswer::ReturnCompilationResult { continuation, success, fasl_file, .. } => {
                            if rets.contains_key(continuation) {
                                match rets[continuation] {
                                    ContinuationCallback::LoadFile => {
                                        if !success {
                                            sender_tcp.send(SlynkAnswer::Notify { text: "Failed to compile file.".to_string(), error: true }).expect("Could not send");
                                        } 
                                        if let Some(fpath) = fasl_file {
                                            slynk_repl_sender_handle.send(SlynkMessage::LoadFile(fpath.clone()))
                                                .expect("Could not send");
                                        }
                                    },
                                    _ => ()
                                }
                            }
                         },
                        //  SlynkAnswer::ReturnFindDefinitionResult { continuation, definitions, .. } => {
                        //     if rets.contains_key(continuation) {
                        //         match rets[continuation] {
                        //             ContinuationCallback::JumpToDef => {
                        //                 if definitions.is_empty() {
                        //                     sender_tcp.send(SlynkAnswer::Notify { text: "Failed to find definition.".to_string(), error: true }).expect("Could not send");
                        //                 } else {
                        //                     sender_tcp.send(SlynkAnswer::Notify { text: definitions.iter().map(|d| d.label.as_str()).collect::<Vec<&str>>().join("\n"), error: false }).expect("Could not send");
                        //                 }
                        //             },
                        //             _ => ()
                        //         }
                        //     }
                        //  },
                        _ => {

                        }
                    }
                    sender_tcp.send(sw).expect("Failed to send.");

                }
                println!("Thread reading incoming messages from Slynk stopped.");

            });

            //
            // thread that writes to swank/slynk server
            //
            let cont_handle = arc_cont.clone();
            let package_handle = arc_package.clone();
            let pending_handle_in = pending.clone();
            thread::spawn(move || {

                // create mrepl
                let mreq = emacs_rex("(slynk-mrepl:create-mrepl 1)", &package_handle.lock().unwrap(), &cont_handle.lock().unwrap());
                let hex_prefix = format!("{:#08x}", mreq.chars().count())[2..].to_string();
                let message_full = format!("{}{}", hex_prefix, mreq);
                tcp_write.write_all(message_full.as_bytes()).expect("Could not send tol tcp in.");


                for message_to_send in slynk_repl_receiver {
                    let mut cont_count = cont_handle.lock().unwrap();
                    *cont_count += 1;
                    let continuation = cont_count.clone();

                    let message_body =  match &message_to_send {

                        SlynkMessage::Eval(form)  => {
                            let escaped = escape_quotes(form);
                            emacs_channel_send(&format!("(:process \"{}\")", escaped), 1)
                        },
                        SlynkMessage::InteractiveEval(form) => {
                            let escaped = escape_quotes(form);
                            pending_handle_in.lock().unwrap().insert(continuation, ContinuationCallback::PrintReturnValue(PrintKind::Notification));
                            emacs_rex(&format!("(slynk:interactive-eval \"{}\")", escaped), &package_handle.lock().unwrap(), &continuation)
                        },
                        SlynkMessage::CompileAndLoadFile(path) => {
                            pending_handle_in.lock().unwrap().insert(continuation, ContinuationCallback::LoadFile);
                            emacs_rex(&format!("(slynk:compile-file-for-emacs \"{}\" t)", path), &package_handle.lock().unwrap(), &continuation)
                        },
                        SlynkMessage::LoadFile(path) => {
                            pending_handle_in.lock().unwrap().insert(continuation, ContinuationCallback::Print("File loaded.".to_string(), PrintKind::Repl));
                            emacs_rex(&format!("(slynk:load-file \"{}\")", trim_quotes(path.clone())), &package_handle.lock().unwrap(), &continuation)
                        },
                        SlynkMessage::FindDefinitions(symbol) => {
                            let escaped = escape_quotes(symbol);
                            pending_handle_in.lock().unwrap().insert(continuation, ContinuationCallback::JumpToDef);
                            emacs_rex(&format!("(slynk:find-definitions-for-emacs \"{}\")", escaped), &package_handle.lock().unwrap(), &continuation)
                        },
                        SlynkMessage::Stop => { 
                            emacs_rex("(slynk:quit-lisp)", &package_handle.lock().unwrap(), &continuation)
                        },
                        SlynkMessage::InvokeNthRestart(level, n, thread) => {
                            emacs_rex_thread(&format!("(slynk:invoke-nth-restart-for-emacs {} {})", level , n), &package_handle.lock().unwrap(), *thread, &continuation)
                        },
                        SlynkMessage::EmacsReturn(form, thread, tag) => {
                            emacs_return(form, *thread, tag)
                        },
                        SlynkMessage::CompileStringForEmacs{ string, buffer, position, filename, policy} => {
                            // ignoring policy for now
                            let fname = nil_or_string(filename.to_owned());
                            let escaped = escape_quotes(string);
                            emacs_rex_thread(&format!("(slynk:compile-string-for-emacs \"{}\" \"{}\" '((:position {}) (:line {} {})) {} 'nil)", escaped, buffer, position.pos, position.line, position.col, fname),  &package_handle.lock().unwrap(), 1, &continuation)
                        }
                    };
                    let hex_prefix = format!("{:#08x}", message_body.chars().count())[2..].to_string();
                    let message_full = format!("{}{}", hex_prefix, message_body);
                    println!("Writing to tcp: {}", &message_full);
                    tcp_write.write_all(message_full.as_bytes()).expect("Could not send to tcp in.");

                    if matches!(message_to_send, SlynkMessage::Stop) {
                        println!("Thread sending messages to Slynk stopped.");
                        break;
                    }
                }
            });

        }

        
        Self {
            socket,
            path: path.to_string(),
            args: args.to_owned().iter().map(|s| s.as_ref().to_string()).collect(),

            child,
            slynk_repl_sender,
            out_buf,
            rec_tcp,
            rec_sbcl_process,
            sbcl_process_out,

            cont: arc_cont,
            pending,

            package: arc_package,
            prompt: arc_prompt,

            init_err

        }
    }

    pub fn restart(&mut self) -> BackendResult<()> {
        self.quit()?;
        let new_repl = Self::new(self.socket.clone(), &self.path, self.args.as_slice());
        let _ = std::mem::replace(self, new_repl);
        Ok(())
    }
  
    pub fn quit(&mut self) -> BackendResult<()> {

        self.slynk_repl_sender.send(SlynkMessage::Stop).expect("Could not send");
        // self.
        // self.writer.write(STOP_SIG.as_bytes())?;
        // self.sender.send(STOP_SIG.to_string()).unwrap();
        self.child.kill()?;
        Ok(())
    }

    ///
    /// Get a receiver for incoming Slynk answers
    /// 
    pub fn receiver(&self) -> Receiver<SlynkAnswer> {
        self.rec_tcp.clone()
    }

    ///
    /// Get the content of the SBCL process output buffer
    ///
    pub fn get_sbcl_process_stdout_stderr(&self) -> Vec<String> {
        self.sbcl_process_out
            .lock()
            .unwrap()
            .clone()
    }


    // e.g. C-c C-k in Emacs
    pub fn compile_and_load_file(&mut self, path: &str) -> BackendResult<()> {

        self.slynk_repl_sender.send(SlynkMessage::CompileAndLoadFile(path.to_string()))?;
        Ok(())
    }

    // e.g. C-c C-c in Emacs
    pub fn compile_form(&mut self, form: String, buffer: String, position: EditorPosition, filename: Option<String>) -> BackendResult<()> {
        println!("REPL::compile_form('{}')", &form);
        self.slynk_repl_sender.send(SlynkMessage::CompileStringForEmacs{ buffer, filename, policy: None, position, string: form })?;
        Ok(())

    }
    pub fn eval_form(&mut self, form: String) -> BackendResult<()> {
        println!("REPL::eval_form('{}')", &form);
        self.slynk_repl_sender.send(SlynkMessage::Eval(form))?;
        Ok(())
    }
    // e.g. C-x C-e in Emacs
    pub fn interactive_eval_form(&mut self, form: String) -> BackendResult<()> {
        self.slynk_repl_sender.send(SlynkMessage::InteractiveEval(form))?;
        Ok(())
    }
    // e.g. M-x sly-edit-definition in Emacs
    pub fn find_definition_for_symbol(&mut self, symbol: String) -> BackendResult<()> {
        self.slynk_repl_sender.send(SlynkMessage::FindDefinitions(symbol))?;
        Ok(())
    }

    pub fn emacs_return(&mut self, form: &str, thread: usize, tag: usize) -> BackendResult<()> {
        self.slynk_repl_sender.send(SlynkMessage::EmacsReturn(form.to_string(), thread, tag))?;
        Ok(())
    }

    pub fn invoke_nth_restart(&self, level: usize, n: usize, thread: usize) -> BackendResult<()> {
        self.slynk_repl_sender.send(SlynkMessage::InvokeNthRestart(level, n, thread))?;
        Ok(())
    }

}

fn emacs_return(form: &str, thread: usize, tag: &usize) -> String {
    format!("(:emacs-return {} {} \"{}\")\n", thread, tag, &trim_quotes(form.to_string()))
}
fn emacs_rex(form: &str, package: &str, continuation: &usize) -> String {
    format!("(:emacs-rex {} \"{}\" t {}))\n", form, package, continuation)
}
fn emacs_rex_thread(form: &str, package: &str, thread: usize,  continuation: &usize) -> String {
    format!("(:emacs-rex {} \"{}\" {} {}))\n", form, package, thread, continuation)
}
fn emacs_channel_send(form: &str, channel: usize) -> String {
    format!("(:emacs-channel-send {} {})\n", channel, form)
}

fn nil_or_string<T: Into<String>>(form: Option<T>) -> String {
    match form {
        Some(is) => format!("\"{}\"", is.into()),
        None => String::from("nil")
    }
}
// nil -> None
// "text" -> Some("text")
fn option_str(form: &str) -> Option<String> {
    match form {
        "nil" => None,
        v => Some(v.to_string())
    }
}

fn sexp_string_atom(sexp: &Sexp) -> BackendResult<String> {
    if let Sexp::Atom(Atom::S(val)) = sexp {
        Ok(val.clone())
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
fn sexp_usize_atom(sexp: &Sexp) -> BackendResult<usize> {
    if let Sexp::Atom(Atom::I(val)) = sexp {
        Ok(*val as usize)
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}