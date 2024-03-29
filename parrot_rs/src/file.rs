use std::{path::Path, io};

use crate::{BackendResult, BackendError};

pub fn is_lisp_file(path: &Path) -> bool {
    match path.extension() {
        None => false,
        Some(os_str) => os_str == "lisp" || os_str == "cl",
    }
}
pub fn is_fasl_file(path: &Path) -> bool {
    match path.extension() {
        None => false,
        Some(os_str) => os_str == "fasl"
    }
}

pub fn paths_are_eq<P: AsRef<Path>>(path1: P, path2: P) -> bool {
    path1.as_ref().eq(path2.as_ref())
}
pub fn normalize_path<P: AsRef<Path>>(path: P) -> String {
    path.as_ref().to_str().unwrap().replace('\\', "/")
}

pub fn save_file_content<P: AsRef<Path>>(path: P, content: &str) -> BackendResult<()> {
    std::fs::write(path, content)?;
    Ok(())
}
pub fn get_file_content<P: AsRef<Path>>(path: P) -> BackendResult<String> {
    if !path.as_ref().exists() {
        Err(BackendError(format!("The path {:?} does not exist!", path.as_ref())))
    } else {
        Ok(std::fs::read_to_string(path)?)
    }
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
pub fn rename_file_or_folder<P: AsRef<Path>>(old_path: P, new_name: &str) -> BackendResult<String> {
    if !old_path.as_ref().exists() {
        return Err(BackendError(format!("File/folder does not exist: {}", old_path.as_ref().to_str().unwrap())))
    }
    let stem = old_path.as_ref()
        .parent()
        .unwrap();
    let mut new_path = stem.join(new_name);
    if let Some(ext) = old_path.as_ref().extension() {
        if new_path.extension().is_none() {
            new_path.set_extension(ext);
        }
    }

    if new_path.exists() {
        return Err(BackendError("This already exists.".to_string()));
    }
    std::fs::rename(&old_path, &new_path)?;
    Ok(new_path.to_str().unwrap().to_string())
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

pub fn move_to_dir<P: AsRef<Path>>(src: P, target: P) -> BackendResult<()> {
    if !target.as_ref().exists() {
        return Err(BackendError(String::from("Target path does not exist.")));
    }
    if !target.as_ref().is_dir() {
        return Err(BackendError(String::from("Target is not a dir.")));
    }
    if !src.as_ref().exists() {
        return Err(BackendError(String::from("Source path does not exist.")));
    }

    let src_name = src.as_ref().file_name().unwrap();
    let new_path = target.as_ref().join(src_name);
    std::fs::rename(src, new_path)?;
    Ok(())
}
pub fn to_rel_path<P: AsRef<Path>>(root_folder: P, full_path: P) -> String {
    full_path
        .as_ref()
        .strip_prefix(root_folder)
        .unwrap()
        .to_str()
        .unwrap()
        .replace('\\', "/")
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
