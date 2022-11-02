use itertools::Itertools;
use regex::Regex;
use sexp::{Sexp, Atom};

use crate::{BackendError, BackendResult, text::{trim_parens, trim_quotes}};

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