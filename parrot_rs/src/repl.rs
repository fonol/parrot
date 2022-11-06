use std::collections::HashMap;
use std::collections::hash_map::Entry;
use std::net::TcpStream;
use std::thread;
use std::io::{BufRead, BufReader, Write, Read, ErrorKind};
use std::process::{Command, Stdio, Child, ChildStdin};
use std::sync::{Mutex, Arc, RwLock};
use crossbeam::{unbounded, bounded, Sender, Receiver};
use regex::{Regex, RegexBuilder};
use serde::{Serialize, Deserialize};

use std::thread::sleep;
use std::time::Duration;
use os_pipe::{self, PipeWriter};
use utf8_chars::BufReadCharsExt;
use crate::models::*;
use crate::text::{trim_quotes, unescape_quotes, escape_quotes};
use crate::{BackendResult, BackendError};
use lazy_static::lazy_static;
use sexp::{self, Atom, Sexp};
use crate::parsing::*;

pub const STOP_SIG: &str = "REPL~QUIT"; 


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

        if let Err(e) = tcp_write_try {
            init_err = Some(format!("Failed to connect to Slynk server.\n{}", &e.to_string()));
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
                    let rets = pending_handle_out
                        .lock()
                        .unwrap();
                    let ccb = match get_continuation(&body) {
                        Some(cont) => rets.get(&cont),
                        None => None
                    };
                    let sw = parse_slynk_answer(&body, ccb);


                    // handle answer
                    println!("Got SlynkAnswer: {:?}", &sw);
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
                                    ContinuationCallback::DisplayPackages(cont) => 
                                        sender_tcp.send(SlynkAnswer::ResolvePending { continuation: *cont, data: serde_json::to_string(&parse_package_list(&value).unwrap()).unwrap() }).expect("Could not send"),
                                    ContinuationCallback::DisplaySymbolsInPackage(cont) => 
                                        sender_tcp.send(SlynkAnswer::ResolvePending { continuation: *cont, data: serde_json::to_string(&parse_symbol_list(value.clone()).unwrap()).unwrap() }).expect("Could not send"),
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
                        _ => {

                        }
                    }
                    sender_tcp.send(sw).expect("Failed to send.");

                };
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
                        },
                        SlynkMessage::ListAllPackages(cont) => {
                            pending_handle_in.lock().unwrap().insert(continuation, ContinuationCallback::DisplayPackages(*cont));
                            emacs_rex("(slynk:interactive-eval \"(list-all-packages)\")", &package_handle.lock().unwrap(), &continuation)
                        },
                        SlynkMessage::ListSymbolsInPackage{ package, vars, macros, functions, classes, cont} => {
                            let lst_symbols = format!(r#"
                            (write ((lambda (package)
                                (let ((res (list)))
                                    (do-all-symbols (sym package)
                                        (when (and (or  (and {} (and (not (macro-function sym)) (fboundp sym)))
                                                        (and {} (macro-function sym))
                                                        (and {} (boundp sym))
                                                        (and {} (find-class sym nil)))
                                                    (eql (symbol-package sym)
                                                        (find-package package)))
                                            (push sym res)))
                                    res)) 
                                '{}))
                            "#, 
                                bool_to_nil_or_t(functions), 
                                bool_to_nil_or_t(macros), 
                                bool_to_nil_or_t(vars), 
                                bool_to_nil_or_t(classes), 
                                package);
                            pending_handle_in.lock().unwrap().insert(continuation, ContinuationCallback::DisplaySymbolsInPackage(*cont));
                            emacs_rex(&format!("(slynk:eval-and-grab-output \"{}\")", &lst_symbols), &package_handle.lock().unwrap(), &continuation)
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

    pub fn list_all_packages(&self, continuation: usize) -> BackendResult<()> {
        self.slynk_repl_sender.send(SlynkMessage::ListAllPackages(continuation))?;
        Ok(())
    }
    pub fn get_symbols_in_package(&self, package: String, vars: bool, functions: bool, classes: bool, macros: bool, continuation: usize) -> BackendResult<()> {
        self.slynk_repl_sender.send(SlynkMessage::ListSymbolsInPackage{ package, vars, functions, classes, macros, cont: continuation, })?;
        Ok(())
    }


    fn get_continuation_callback(&self, return_value: &str) -> Option<ContinuationCallback> {
        get_continuation(return_value)
            .map(|c| self.pending.lock().unwrap().get(&c).map(|e| e.to_owned()))
            .flatten()

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

