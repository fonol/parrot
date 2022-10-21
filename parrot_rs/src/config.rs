use directories::{BaseDirs, ProjectDirs, UserDirs};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

use crate::BackendError;

#[derive(Serialize, Deserialize)]
pub struct Config {
    pub path_to_sbcl: Option<String>,
    pub path_to_core: Option<String>,
    pub slynk_socket: String,

    pub vim_mode: bool,
    pub vim_esc: Option<String>,

    pub shortcut_compile_and_load_file: Option<String>,
    pub shortcut_compile_top_level: Option<String>,
    pub shortcut_eval_last_expression: Option<String>,
    pub show_line_numbers: bool
}

fn config_path() -> Result<String, BackendError> {
    let data_dir = get_config_dir()?;
    let joined = Path::new(&data_dir)
        .join("config.json")
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| BackendError("could not build config path".to_string()))?;

    Ok(joined)
}

pub fn write_config(config: &Config) -> Result<(), BackendError> {
    let as_str = serde_json::to_string_pretty(config).unwrap();
    let config_file_path = config_path()?;
    fs::write(config_path()?, as_str)
        .unwrap_or_else(|_| panic!("Could not write to config file: {}", &config_file_path));
    Ok(())
}

pub fn read_config() -> Result<Config, BackendError> {
    let config_file_path = config_path()?;
    let config_json_res = fs::read_to_string(config_path()?);
    match config_json_res {
        Ok(config_json) => Ok(serde_json::from_str(&config_json)?),
        Err(_) => Err(BackendError(format!(
            "Could not read config file: {}",
            &config_file_path
        ))),
    }
}

pub fn create_config_if_not_existing() {
    let path_to_config_file = config_path().unwrap();
    if !Path::new(&path_to_config_file).exists() {
        let config = Config {
            path_to_sbcl: None,
            path_to_core: None,
            slynk_socket: "127.0.0.1:4005".to_string(),
            vim_mode: false,
            vim_esc: None,
            shortcut_compile_and_load_file: Some(String::from("Shift-Ctrl-L")),
            shortcut_compile_top_level: Some(String::from("Shift-Ctrl-C")),
            shortcut_eval_last_expression: Some(String::from("Shift-Ctrl-E")),
            show_line_numbers: false
        };

        write_config(&config).unwrap();
    }
}

pub fn get_config_dir() -> Result<String, BackendError> {
    if let Some(proj_dirs) = ProjectDirs::from("com", "parrot-soft", "parrot") {
        let config_dir = proj_dirs.config_dir().to_str().unwrap().to_string();
        return Ok(config_dir);
        // Lin: /home/alice/.config/barapp
        // Win: C:\Users\Alice\AppData\Roaming\Foo Corp\Bar App\config
        // Mac: /Users/Alice/Library/Application Support/com.Foo-Corp.Bar-App
    }
    Err(BackendError(
        "Application's config dir not found".to_string(),
    ))
}

pub fn get_data_dir() -> Result<String, BackendError> {
    if let Some(proj_dirs) = ProjectDirs::from("com", "parrot-soft", "parrot") {
        let data_dir = proj_dirs.data_dir().to_str().unwrap().to_string();
        return Ok(data_dir);
    }
    Err(BackendError("Application's data dir not found".to_string()))
}
