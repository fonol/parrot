use itertools::Itertools;
use regex::{Regex, RegexBuilder};
use sexp::{Sexp, Atom};
use lazy_static::lazy_static;

use crate::{BackendError, BackendResult };
use crate::text::*;
use crate::models::*;

lazy_static! {
    // parsing swank :return messages
    static ref CONTINUATION: Regex = Regex::new(r" ([0-9]+)\)$").unwrap();
    static ref RETURN_VALUE: Regex = RegexBuilder::new(" *\\(:return \\(:(?:ok|abort) (?:(?P<value>(?:.|\n|\t|\r)+)|(?P<nil>nil))\\) [0-9]+\\) *$").multi_line(true).build().unwrap();
    static ref WRITE_STRING: Regex = Regex::new("\\(:write-string \"((?:.|\n)+)\"( :repl-result)?\\)$").unwrap();
    static ref WRITE_VALUES: Regex = Regex::new("\\(:write-values (?:\\((\\(\"(?:.|\n)+\" [0-9]+ (?:\".+\"|nil)\\))+\\)|nil)\\)$").unwrap();
    static ref EVALUATION_ABORTED: Regex = Regex::new(" ?\\(:evaluation-aborted \"(?P<message>.+)\"\\)$").unwrap();
    static ref PROMPT: Regex = Regex::new("\\(:prompt \"(.+)\" \"(.+)\" (?P<elevel>[0-9]+) (?P<len_history>[0-9]+)( \"(?P<condition>.+)\")?\\)$").unwrap();
    static ref CHANNEL_SEND: Regex = RegexBuilder::new("\\(:channel-send ([0-9]+) (\\((?:.|\n)+\\))\\)$").multi_line(true).build().unwrap();
    static ref COMPILATION_RESULT: Regex = RegexBuilder::new(" ?\\(:compilation-result (?P<notes>nil|\".+\"|\\((\\(.+\\))+\\)) (?P<success>nil|t) (?P<duration>[0-9]+\\.[0-9]+) (?P<loadp>nil|t) (?P<faslfile>nil|\".+\")\\)$").dot_matches_new_line(true).build().unwrap();
    static ref COMPILER_NOTES: Regex = RegexBuilder::new("\\((\\(:message \"(?P<message>.+)\" :severity :(?P<severity>[^ ]+) :location \\(:location \\(:file \"(?P<file>.+)\"\\) \\(:position .+\\) nil\\) :references .+\\))+\\)").build().unwrap();
}


pub fn clean_and_parse_sexp(sexp_str: &str) -> BackendResult<Sexp> {
    let cleaned = sexp_str
        .trim()
        .replace("\n", " ")
        .replace("\t", " ");

    let parsed = sexp::parse(&cleaned);
    match parsed {
        Ok(sexp) => Ok(sexp),
        Err(e) => Err(BackendError(format!("Failed to parse sexp: {}.", e.message)))
    }
}

pub fn sexp_children(sexp: Sexp) -> BackendResult<Vec<Sexp>> {
    if let Sexp::List(children) = sexp {
        Ok(children)
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
pub fn sexp_list_nth(sexp: &Sexp, n: usize) -> BackendResult<&Sexp> {
    if let Sexp::List(children) = sexp {
        Ok(&children[n])
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
pub fn sexp_list_nth_as_string(sexp: &Sexp, n: usize) -> BackendResult<String> {
    if let Sexp::List(children) = sexp {
        match &children[n] {
            Sexp::Atom(Atom::S(value)) => Ok(value.clone()),
            _ => Err(BackendError("Failed to parse sexp.".to_string()))
        }
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
pub fn sexp_list_nth_as_usize(sexp: &Sexp, n: usize) -> BackendResult<usize> {
    if let Sexp::List(children) = sexp {
        match &children[n] {
            Sexp::Atom(Atom::I(value)) => Ok(*value as usize),
            _ => Err(BackendError("Failed to parse sexp.".to_string()))
        }
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
pub fn sexp_list_nth_as_list(sexp: &Sexp, n: usize) -> BackendResult<&Vec<Sexp>> {
    if let Sexp::List(children) = sexp {
        match &children[n] {
            Sexp::List(subchildren) => Ok(subchildren),
            _ => Err(BackendError("Failed to parse sexp.".to_string()))
        }
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
//
// sexp=(a nil), n=1 -> None
// sexp=(a (b c)), n=1 -> Some(Sexp::List(...))
// sexp=(a "b"), n=1 -> Some(Sexp::Atom(...))
//
pub fn sexp_list_nth_or_nil(sexp: &Sexp, n: usize) -> BackendResult<Option<&Sexp>> {
    if let Sexp::List(children) = sexp {
        if n > children.len() - 1 {
           return Err(BackendError("Failed to parse sexp.".to_string()));
        }
        match &children[n] {
            Sexp::Atom(Atom::S(s)) if s == "nil" => Ok(None),
            _ => Ok(Some(&children[n]))
        }
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
pub fn sexp_is_nil(sexp: &Sexp) -> bool {

    if let Sexp::Atom(Atom::S(val)) = sexp {
        return val == "nil"
    } 
    return false;
}

pub fn sexp_string_atom(sexp: &Sexp) -> BackendResult<String> {
    if let Sexp::Atom(Atom::S(val)) = sexp {
        Ok(val.clone())
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}
pub fn sexp_usize_atom(sexp: &Sexp) -> BackendResult<usize> {
    if let Sexp::Atom(Atom::I(val)) = sexp {
        Ok(*val as usize)
    } else {
        Err(BackendError("Failed to parse sexp.".to_string()))
    }
}

///
/// Check if the given form is a return statement with a continuation
/// 
pub fn get_continuation(return_value: &str) -> Option<usize> {
    if !return_value.starts_with("(:return ") {
        return None
    }
    let re = Regex::new("^\\(:return (?:\n|\t|.)+ (?P<continuation>[0-9]+)\\)$").unwrap();
    if let Some(cap) = re.captures(return_value) {
        return cap.name("continuation").unwrap().as_str().parse::<usize>().ok();
    }
    None
}


///
/// Parse the list given by (list-all-packages)
/// 
pub fn parse_package_list(list: &str) -> BackendResult<Vec<String>> {
    let re = Regex::new("#<PACKAGE \"(?P<name>.+?)\">").unwrap();
    let pnames = re.captures_iter(list)
        .map(|c| c.name("name").unwrap().as_str().to_string())
        .sorted()
        .collect();
    Ok(pnames)
}
///
/// Parse the list given by (do-all-symbols)
/// 
pub fn parse_symbol_list(return_value: String) -> BackendResult<Vec<String>> {
    let sexp = clean_and_parse_sexp(&return_value).unwrap();
    let list = sexp_list_nth_as_string(&sexp, 0).unwrap();
    if list.len() == 0 || list == "()" || list.eq_ignore_ascii_case("nil") {
        Ok(vec![])
    } else {
        let re = Regex::new("(?:\n| +|\t)+").unwrap();
        let list_cleaned = Regex::new("(^[(\"]+|[\")]+$)").unwrap()
            .replace_all(&list, "").to_string();
        Ok(re.split(&list_cleaned)
            .map(|s| s.to_string())
            .sorted()
            .collect())

    }
}


pub fn parse_slynk_answer(m: &str, ccb: Option<&ContinuationCallback>) -> SlynkAnswer {
    if !m.starts_with("(:indentation-update ") {
        println!("Parsing: {}", m);
    }
    if m.starts_with("(:indentation-update ") {
        SlynkAnswer::IndentationUpdate
    }  else if m.starts_with("(:channel-send ") {
        let cap = CHANNEL_SEND.captures(m).unwrap();
        let channel = cap.get(1).unwrap().as_str().parse::<usize>().unwrap();
        let form = cap.get(2).unwrap().as_str();
        SlynkAnswer::ChannelSend { channel, method: parse_channel_method(form) }
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
                .to_string();

        if matches!(ccb, Some(&ContinuationCallback::JumpToDef)) {
            let sexp_parsed = clean_and_parse_sexp(&value).unwrap();
            let mut definitions = vec![];
            if !sexp_is_nil(&sexp_parsed) {
                for def in sexp_children(sexp_parsed).unwrap() {
                    let label = sexp_list_nth_as_string(&def, 0).unwrap();
                    let location = sexp_list_nth(&def, 1).unwrap();
                    let location_or_err = sexp_list_nth_as_string(&location, 0).unwrap();
                    if location_or_err == ":error" {
                        definitions.push(FoundDefinition {
                            label, 
                            error: Some(sexp_list_nth_as_string(&location, 1).unwrap()),
                            file: None,
                            position: None,
                            snippet: None
                        });
                    } else {

                        let lfile = sexp_list_nth(&location, 1).unwrap();
                        let file = sexp_list_nth_as_string(&lfile, 1).ok();
                        let lpos = sexp_list_nth(&location, 2).unwrap();
                        let position = sexp_list_nth_as_usize(&lpos, 1).ok();
                        let lsnippet = sexp_list_nth(&location, 3).unwrap();
                        let snippet = if sexp_is_nil(&lsnippet) {
                            None
                        } else {
                            Some(sexp_list_nth_as_string(&lsnippet, 1).unwrap())
                        };
                        definitions.push(FoundDefinition {
                            label, 
                            error: None,
                            file,
                            position,
                            snippet
                        });
                    }
                }
            }
            SlynkAnswer::ReturnFindDefinitionResult { continuation, definitions } 

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

            SlynkAnswer::ReturnCompilationResult { continuation, notes, success, duration, loadp, fasl_file }
        } else {
            SlynkAnswer::Return {
                continuation,
                value: value.replace("\\\"", "\""),
                status: status
            }
        }

    } else if m.starts_with("(:new-features ") {
        SlynkAnswer::NewFeatures
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
                return SlynkAnswer::Debug {
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
        SlynkAnswer::DebugActivate { level, thread }
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
        SlynkAnswer::DebugReturn { level, thread }
    } else if m.starts_with("(:write-string ") {
        let repl_result = m.ends_with(":repl-result)");
        let value = unescape_quotes(WRITE_STRING.captures(m)
                .unwrap()
                .get(1)
                .unwrap()
                .as_str());
        SlynkAnswer::WriteString { value, repl_result }
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
                SlynkAnswer::ReadFromMinibuffer { thread, tag, prompt, initial_value }
            },
            _ => panic!("Should be list")
        }
    } else {
        SlynkAnswer::IndentationUpdate
    }
}

pub fn parse_channel_method(answer: &str) -> ChannelMethod {

    if answer.starts_with("(:write-string ") {
        let to_write = WRITE_STRING.captures(answer)
        .unwrap()
        .get(1)
        .map(|m| m.as_str())
        .map(unescape_quotes)
        .unwrap();

        return ChannelMethod::WriteString(to_write)
    }
    if answer.starts_with("(:prompt ") {
        let cap = PROMPT.captures(answer)
        .unwrap();
        let package = cap.get(1).unwrap().as_str().to_string();
        let prompt = cap.get(2).unwrap().as_str().to_string();
        let elevel = cap.name("elevel").unwrap().as_str().parse::<usize>().unwrap();
        let len_history = cap.name("len_history").unwrap().as_str().parse::<usize>().unwrap();
        let condition = cap.name("condition").map(|m| unescape_quotes(m.as_str()));
        return ChannelMethod::Prompt {
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
            return ChannelMethod::WriteValues(vec![]);
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
        return ChannelMethod::WriteValues(values);
    }
    if answer.starts_with("(:evaluation-aborted ") {
        let cap = EVALUATION_ABORTED.captures(answer).unwrap();
        return ChannelMethod::EvaluationAborted(cap.iter().skip(1).map(|c| c.unwrap().as_str().to_string()).collect());
    }
    ChannelMethod::Unknown(answer.to_string())
}

pub fn nil_or_string<T: Into<String>>(form: Option<T>) -> String {
    match form {
        Some(is) => format!("\"{}\"", is.into()),
        None => String::from("nil")
    }
}
// nil -> None
// "text" -> Some("text")
pub fn option_str(form: &str) -> Option<String> {
    match form {
        "nil" => None,
        v => Some(v.to_string())
    }
}

pub fn bool_to_nil_or_t(val: &bool) -> String {
    match val {
        true => "T".to_string(),
        false => "nil".to_string()
    }
}