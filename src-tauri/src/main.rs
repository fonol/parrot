#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use parrot_rs::{self, BackendResult, repl::{STOP_SIG, SlynkAnswer, ChannelMethod, EditorPosition}, config::Config, ConfigDiagnostics, fts::{index::Index, models::{FileContentSearchResultGroup, SourceFileSearchResult}}};
use serde::Serialize;
use tauri::{Window};
use std::{sync::{Mutex}, collections::HashMap, path::Path};
use lazy_static::lazy_static;
use crossbeam;

lazy_static! {
    static ref REPL: Mutex<parrot_rs::repl::REPL> = {


        let config = parrot_rs::config::read_config().expect("Could not read config.");
        let socket = config.slynk_socket;
        // init code will only be called if config paths are confirmed to be set,
        // so this is save
        let path_to_sbcl = config.path_to_sbcl.unwrap();
        let path_to_core = config.path_to_core.unwrap();

        let current_exe_path = std::env::current_exe().unwrap();
        let slynk_start_path = current_exe_path
            .parent()
            .unwrap()
            .join("slynk/start-slynk.lisp")
            .to_str()
            .unwrap()
            .to_string();


        let repl = parrot_rs::repl::REPL::new(
            String::from(socket), 
            &path_to_sbcl, 
            &vec!["--core", &path_to_core, "--load", &slynk_start_path]);

        Mutex::<parrot_rs::repl::REPL>::new(repl)
    };

    static ref INDEX: Mutex<Index> = {
        Mutex::new(Index::new())
    };

}

#[derive(Debug, Clone, Serialize)]
struct Payload {
    text: String,
}

fn main() {
    parrot_rs::create_app_directory_if_not_existing().unwrap();
    parrot_rs::config::create_config_if_not_existing();


    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            init_repl,
            folder_opened,
            get_file_tree,

            check_config,
            get_config,
            write_config,

            repl_eval,
            repl_compile_form,
            repl_compile_and_load_file,
            repl_restart,
            repl_invoke_nth_restart,
            repl_emacs_return,
            interactive_eval_form,
            find_definition,

            get_sbcl_process_stdout_stderr,

            get_file_content,
            save_file_content,
            add_lisp_file,
            delete_file,
            rename_file_or_folder,
            file_exists,

            create_subdir,
            delete_dir,
            dir_is_empty,
            is_dir,

            search_source_files,

            get_state,
            get_state_value,
            set_state_value
         ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    
}

#[tauri::command]
fn check_config() -> ConfigDiagnostics {
    println!("check_config()");
    parrot_rs::get_config_diagnostics()
}
#[tauri::command]
fn init_repl(window: Window) -> BackendResult<()> {
    println!("after_lisp_path_confirmed: Init REPL");
    lazy_static::initialize(&REPL);
    let repl = REPL.lock().unwrap();
    if let Some(err_mess) = &repl.init_err {
        window.emit("term-init-error", Payload { text: err_mess.clone() }).expect("Could not send");
        print_sbcl_output_to_terminal(repl.get_sbcl_process_stdout_stderr(), window);
    } else {
        let receiver = repl.receiver();
        std::thread::spawn(move || {
            println!("main rec listening...");
            handle_repl_commands(receiver, window);
        });
    }
    Ok(())
}
#[tauri::command]
fn folder_opened(folder: String) {
    let mut index = INDEX.lock().unwrap();
    index.build(folder);
}

//
// REPL
//
#[tauri::command]
fn repl_restart(window: Window) -> BackendResult<()> {
    println!("App::repl_restart()");
    REPL
        .lock()
        .unwrap()
        .restart()?;
    let receiver = REPL.lock().unwrap().receiver();

     std::thread::spawn(move || {
        println!("main rec listening...");
        handle_repl_commands(receiver, window);
    });
    Ok(())
}
#[tauri::command]
fn repl_eval(input: String)  {
    REPL
        .lock()
        .unwrap()
        .eval_form(input);
}
#[tauri::command]
fn repl_compile_form(form: String, buffer: String, filename: Option<String>, position: EditorPosition)  {
    REPL
        .lock()
        .unwrap()
        .compile_form(form, buffer, position, filename);
}
#[tauri::command]
fn repl_emacs_return(form: String, thread: usize, tag: usize)  {
    REPL
        .lock()
        .unwrap()
        .emacs_return(&form, thread, tag);
}
#[tauri::command]
fn repl_compile_and_load_file(path: &str)  {
    REPL
        .lock()
        .unwrap()
        .compile_and_load_file(path);
}
#[tauri::command]
fn repl_invoke_nth_restart(level: usize, n: usize, thread: usize) {
    REPL
        .lock()
        .unwrap()
        .invoke_nth_restart(level, n, thread);
}
#[tauri::command]
fn interactive_eval_form(form: String) {
    REPL
        .lock()
        .unwrap()
        .interactive_eval_form(form);
}
#[tauri::command]
fn find_definition(symbol: String) {
    REPL
        .lock()
        .unwrap()
        .find_definition_for_symbol(symbol);
}

//
// SBCL
//

#[tauri::command]
fn get_sbcl_process_stdout_stderr() -> Vec<String> {
    REPL    
        .lock()
        .unwrap()
        .get_sbcl_process_stdout_stderr()
}

//
// config
//
#[tauri::command]
fn get_config() -> BackendResult<Config> {
    parrot_rs::config::read_config()
}
#[tauri::command]
fn write_config(config: Config) -> BackendResult<()> {
    parrot_rs::config::write_config(&config)
}


//
// files
//
#[tauri::command]
fn get_file_tree(folder: &str) -> BackendResult<String> {
    parrot_rs::tree::get_file_tree_as_json(folder)
}
#[tauri::command]
fn get_file_content(path: &str) -> BackendResult<String> {
    parrot_rs::file::get_file_content(path)

}
#[tauri::command]
fn save_file_content(path: &str, content: &str) -> BackendResult<()> {
    parrot_rs::file::save_file_content(path, content)
}
#[tauri::command]
fn add_lisp_file(folder: &str, name: &str) -> BackendResult<String> {
    parrot_rs::file::create_lisp_file(folder, name)
}
#[tauri::command]
fn delete_file(path: &str) -> BackendResult<()> {
    parrot_rs::file::delete_file(path)
}
#[tauri::command]
fn rename_file_or_folder(old_path: &str, new_name: &str) -> BackendResult<()> {
    parrot_rs::file::rename_file_or_folder(old_path, new_name)
}
#[tauri::command]
fn file_exists(path: &str) -> BackendResult<bool> {
    Ok(Path::new(path).exists())
}

//
// dirs
//

#[tauri::command]
fn create_subdir(parent: &str, name: &str) -> BackendResult<String> {
    parrot_rs::file::create_subdir(parent, name)
}
#[tauri::command]
fn delete_dir(path: &str) -> BackendResult<()> {
    parrot_rs::file::delete_dir(path)
}
#[tauri::command]
fn dir_is_empty(path: &str) -> BackendResult<bool> {
    parrot_rs::file::dir_is_empty(path)
}
#[tauri::command]
fn is_dir(path: &str) -> BackendResult<bool> {
    Ok(Path::new(path).is_dir())
}

//
// search
//
#[tauri::command]
fn search_source_files(query: &str, ignore_case: bool, is_regex: bool) -> BackendResult<SourceFileSearchResult> {
    INDEX.lock()
        .unwrap()
        .search_source_files(query, ignore_case, is_regex, 500)
}



//
// state
//

#[tauri::command]
fn get_state() -> BackendResult<HashMap<String, String>> {
    parrot_rs::state::load_state()
}
#[tauri::command]
fn set_state_value(key: String, val: String) -> BackendResult<()> {
    parrot_rs::state::set_state_value(key, val)
}
#[tauri::command]
fn get_state_value(key: &str) -> BackendResult<Option<String>> {
    parrot_rs::state::get_state_value(key)
}

fn print_sbcl_output_to_terminal(output: Vec<String>, window: Window) {
    window.emit("term-write", Payload { text: "SBCL process output:\n".to_string()}).unwrap();
    window.emit("term-write", Payload { text: output.join("") }).unwrap();
}
fn notify_error(message: &str, window: &Window) -> Result<(), tauri::Error> {
    window.emit("notify-error", Payload { text: message.to_string() })
}
fn notify_success(message: &str, window: &Window) -> Result<(), tauri::Error> {
    window.emit("notify-success", Payload { text: message.to_string() })
}

fn handle_repl_commands(rec: crossbeam::channel::Receiver<SlynkAnswer>, window: Window) {
    for m in rec {
        let mut emit: Result<(), tauri::Error> = Ok(());
        if let SlynkAnswer::WriteString { value, .. } = m {
            emit = window.emit("term-write", Payload { text: value });
        } else if let SlynkAnswer::Notify { text, error } = m {
            if error {
                emit = notify_error(&text, &window);
            } else {
                emit = notify_success(&text, &window);
            }
        } else if matches!(m, SlynkAnswer::Debug {..}) {
            emit = window.emit("debug", m);
        } else if matches!(m, SlynkAnswer::DebugReturn { .. }) {
            emit = window.emit("debug-return", m);
        } else if let SlynkAnswer::ChannelSend { method, .. } = m {
            if matches!(method, ChannelMethod::Prompt {..}) {
                emit = window.emit("set-prompt", method);
            }
            else if let ChannelMethod::WriteString(text) = method {
                emit = window.emit("term-write", Payload { text });
            }
            else if let ChannelMethod::WriteValues(values) = method {
                emit = window.emit("term-write", Payload { text: values.iter().map(|vtup| vtup.0.as_str()).collect::<Vec<&str>>().join("\n") });
            }
            else if let ChannelMethod::EvaluationAborted(message) = method {
                emit = window.emit("term-write", Payload { text: format!("; Evaluation aborted on {}", message) });
            }
            else if let ChannelMethod::Unknown(call) = method {
                emit = window.emit("term-write", Payload { text: format!("; [ERROR] Could not parse yet: {}", call) });
            }
        } else if matches!(m, SlynkAnswer::ReadFromMinibuffer { .. }) {
            emit = window.emit("read-input", m);
        } else if let SlynkAnswer::ReturnCompilationResult { duration, success, notes, .. } = m {
            if let Some(compiler_notes) = notes {
                window.emit("term-write", Payload { text: compiler_notes
                    .iter()
                    .map(|n| format!("Compiler note [{}]:\n{}: {} ", n.file.as_ref().unwrap_or(&String::from("<unknown file>")), n.severity, n.message))
                    .collect::<Vec<String>>().join("\n")}).unwrap();
            }
            if success {
                emit = notify_success(&format!("Compiled [{}s].", duration), &window);
            } else {
                emit = notify_error("Failed to compile.", &window);
            }
        } else if let SlynkAnswer::ReturnFindDefinitionResult { .. } = &m {
            emit = window.emit("jump", m.clone());
        };
        emit.expect("Could not send event to main window");
    }
}