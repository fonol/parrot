#![allow(dead_code, unused_imports)]

use std::fs;
use std::path::Path;
use std::process::{Command};
use std::sync::Arc;
pub use error::{BackendResult, BackendError};
use serde::Serialize;
use std::net::SocketAddr;


pub mod fts;
pub mod error;
pub mod config;
pub mod repl;
pub mod tree;
pub mod file;
pub mod text;
pub mod models;
pub mod state;
pub mod parsing;

#[derive(Serialize, Debug, PartialOrd, PartialEq)]
pub enum ConfigValueStatus {
    Ok(String),
    ValueMissing,
    ValueInvalid(String)
}

#[derive(Serialize, Debug, PartialOrd, PartialEq)]
pub struct ConfigDiagnostics {

    pub ok: bool,
    pub path_to_sbcl: ConfigValueStatus,
    pub path_to_core: ConfigValueStatus,
    pub slynk_socket: ConfigValueStatus
}

pub fn get_config_diagnostics() -> ConfigDiagnostics {
    let c = config::read_config().unwrap();
    let path_to_sbcl = match c.path_to_sbcl {
        Some(p) => { 
            if Path::new(&p).exists() {
                ConfigValueStatus::Ok(p.to_string())
            } else {
                ConfigValueStatus::ValueInvalid(p.to_string())
            }
        },
        None =>  ConfigValueStatus::ValueMissing
    };
    let path_to_core = match c.path_to_core {
        Some(p) => { 
            if Path::new(&p).exists() {
                ConfigValueStatus::Ok(p.to_string())
            } else {
                ConfigValueStatus::ValueInvalid(p.to_string())
            }
        },
        None =>  ConfigValueStatus::ValueMissing
    };
    let slynk_socket = if c.slynk_socket.parse::<SocketAddr>().is_ok() {
                ConfigValueStatus::Ok(c.slynk_socket.clone())
            } else {
                ConfigValueStatus::ValueInvalid(c.slynk_socket.clone())
            };

    ConfigDiagnostics {
        ok: matches!(path_to_core, ConfigValueStatus::Ok(_))
            && matches!(path_to_sbcl, ConfigValueStatus::Ok(_))
            && matches!(slynk_socket, ConfigValueStatus::Ok(_)),
        path_to_sbcl,
        path_to_core,
        slynk_socket
    }
}
pub fn set_sbcl_path(path: &str) -> BackendResult<()> {
    config::create_config_if_not_existing();
    let mut config = config::read_config()?;
    config.path_to_sbcl = Some(path.to_owned());
    config::write_config(&config)?;
    Ok(())
}

pub fn create_app_directory_if_not_existing() -> BackendResult<()> {
    let config_dir = config::get_config_dir()?;
    fs::create_dir_all(config_dir)?;

    let data_dir = config::get_data_dir()?;
    fs::create_dir_all(data_dir)?;

    Ok(())
}