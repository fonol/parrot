use crossbeam::SendError;
use serde::{Deserialize, Serialize};
use std::fmt::Display;

use crate::models::SlynkMessage;


#[derive(Serialize, Deserialize, Debug)]
pub struct BackendError(pub String);

pub type BackendResult<T> = Result<T, BackendError>;

impl From<std::io::Error> for BackendError {
    fn from(_: std::io::Error) -> BackendError {
        BackendError(String::from("unspecified error"))
    }
}
impl From<serde_json::Error> for BackendError {
    fn from(_: serde_json::Error) -> BackendError {
        BackendError(String::from("Error on json serializing/deserializing"))
    }
}
impl From<SendError<String>> for BackendError {
    fn from(_: SendError<String>) -> BackendError {
        BackendError(String::from("[Crossbeam] Failed to send"))
    }
}
impl From<SendError<SlynkMessage>> for BackendError {
    fn from(_: SendError<SlynkMessage>) -> BackendError {
        BackendError(String::from("[Crossbeam] Failed to send"))
    }
}
impl From<sexp::Error> for BackendError {
    fn from(_: sexp::Error) -> BackendError {
        BackendError(String::from("[sexp] Failed to parse"))
    }
}
