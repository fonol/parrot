use std::{path::Path, io};

use crate::{BackendResult, BackendError};

pub fn is_lisp_file(path: &Path) -> bool {
    match path.extension() {
        None => false,
        Some(os_str) => os_str == "lisp" || os_str == "cl",
    }
}
pub fn is_pdf_file(path: &Path) -> bool {
    match path.extension() {
        None => false,
        Some(os_str) => os_str == "pdf" || os_str == "PDF",
    }
}

pub fn save_file_content<P: AsRef<Path>>(path: P, content: &str) -> BackendResult<()> {
    std::fs::write(path, content)?;
    Ok(())
}
pub fn get_file_content<P: AsRef<Path>>(path: P) -> BackendResult<String> {
    Ok(std::fs::read_to_string(path)?)
}

pub fn path_to_node_name(path: &Path) -> &str {
    path.file_name().and_then(|os| os.to_str()).unwrap()
}

pub fn delete_dir<P: AsRef<Path>>(path: P) -> BackendResult<()> {
    std::fs::remove_dir_all(path)?;
    Ok(())
}
pub fn dir_is_empty<P: AsRef<Path>>(path: P) -> BackendResult<bool> {
    Ok(path.as_ref().read_dir()?.next().is_none())
}
pub fn delete_file<P: AsRef<Path>>(path: P) -> BackendResult<()> {
    std::fs::remove_file(path)?;
    Ok(())
}

pub fn create_subdir(parent_path: &str, folder_name: &str) -> BackendResult<String> {
    let path = Path::new(parent_path).join(Path::new(folder_name));

    match std::fs::create_dir(&path) {
        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
            BackendResult::Err(BackendError("Folder already exists".to_string()))
        }
        Err(e) if e.kind() == io::ErrorKind::InvalidInput => {
            BackendResult::Err(BackendError("Invalid name".to_string()))
        }
        Err(e) if e.kind() == io::ErrorKind::PermissionDenied => {
            BackendResult::Err(BackendError("Permission denied".to_string()))
        }
        Err(e) if e.kind() == io::ErrorKind::Other => {
            BackendResult::Err(BackendError("Other error".to_string()))
        }
        Err(_) => BackendResult::Err(BackendError("Other error".to_string())),
        _ => Ok(path.as_os_str().to_str().unwrap().to_string()),
    }
}

pub fn create_lisp_file<P: AsRef<Path>>(folder: P, name: &str) -> BackendResult<String> {
    let mut name_sanitized = sanitize_filename::sanitize(name);
    if !name_sanitized.to_lowercase().ends_with(".lisp") 
    && !name_sanitized.to_lowercase().ends_with(".cl") {
        name_sanitized = format!("{}.lisp", name_sanitized);
    }
    let full_path = Path::new(&folder.as_ref()).join(&name_sanitized);
    std::fs::write(&full_path, "")?;

    Ok(full_path.to_str().unwrap().to_string())
}
