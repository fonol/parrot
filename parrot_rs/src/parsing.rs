use sexp::{Sexp, Atom};

use crate::{BackendError, BackendResult};

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
