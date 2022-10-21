use crate::{config, BackendResult};
use std::{collections::HashMap, path::Path};

pub fn load_state() -> BackendResult<HashMap<String, String>> {
    let data_dir = config::get_data_dir()?;
    let state_file = format!("{}/state.json", data_dir);
    if !Path::new(&state_file).exists() {
        std::fs::write(&state_file, "{}")?;
    }
    let json = std::fs::read_to_string(state_file)?;

    Ok(serde_json::from_str(&json)?)
}

fn save_state(state: &HashMap<String, String>) -> BackendResult<()> {
    let data_dir = config::get_data_dir()?;
    let state_file = format!("{}/state.json", data_dir);
    let json = serde_json::to_string_pretty(state)?;

    std::fs::write(state_file, json)?;

    Ok(())
}

pub fn get_state_value(key: &str) -> BackendResult<Option<String>> {
    let state = load_state()?;
    Ok(state.get(key).map(|v| v.to_string()))
}
pub fn set_state_value(key: String, val: String) -> BackendResult<()> {
    let mut state = load_state()?;
    state.insert(key, val);
    save_state(&state)?;

    Ok(())
}
