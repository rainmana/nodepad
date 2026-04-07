use crate::models::{Project, ProjectsStore};
use std::fs;
use tauri::{AppHandle, Manager};

fn projects_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .expect("no app data dir")
        .join("projects.json")
}

#[tauri::command]
pub async fn load_projects(app: AppHandle) -> Result<ProjectsStore, String> {
    let path = projects_path(&app);
    if !path.exists() {
        return Ok(ProjectsStore {
            projects: vec![default_project()],
            active_project_id: "default".to_string(),
        });
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let store: ProjectsStore = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(store)
}

#[tauri::command]
pub async fn save_projects(app: AppHandle, store: ProjectsStore) -> Result<(), String> {
    let path = projects_path(&app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&store).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

// Dialog commands use the async dialog API to avoid blocking the Tauri main thread.
// We use a oneshot channel to bridge the callback-based dialog API into async/await.

#[tauri::command]
pub async fn import_nodepad_file(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel::<Option<tauri_plugin_fs::FilePath>>();
    app.dialog()
        .file()
        .add_filter("Nodepad files", &["nodepad", "json"])
        .pick_file(move |p| { let _ = tx.send(p); });

    let picked = rx.await.map_err(|e| e.to_string())?;
    match picked {
        Some(fp) => {
            let path = fp.into_path().map_err(|e| e.to_string())?;
            let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            Ok(Some(raw))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn export_nodepad_file(
    app: AppHandle,
    project_name: String,
    content: String,
) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    let slug = slugify(&project_name);
    let filename = format!("{}.nodepad", if slug.is_empty() { "project" } else { &slug });

    let (tx, rx) = oneshot::channel::<Option<tauri_plugin_fs::FilePath>>();
    app.dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("Nodepad files", &["nodepad"])
        .save_file(move |p| { let _ = tx.send(p); });

    let picked = rx.await.map_err(|e| e.to_string())?;
    match picked {
        Some(fp) => {
            let path = fp.into_path().map_err(|e| e.to_string())?;
            fs::write(&path, content).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn export_markdown_file(
    app: AppHandle,
    project_name: String,
    content: String,
) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    let slug = slugify(&project_name);
    let filename = format!("{}.md", if slug.is_empty() { "project" } else { &slug });

    let (tx, rx) = oneshot::channel::<Option<tauri_plugin_fs::FilePath>>();
    app.dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("Markdown files", &["md"])
        .save_file(move |p| { let _ = tx.send(p); });

    let picked = rx.await.map_err(|e| e.to_string())?;
    match picked {
        Some(fp) => {
            let path = fp.into_path().map_err(|e| e.to_string())?;
            fs::write(&path, content).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' { c } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn default_project() -> Project {
    use crate::models::{Block, ContentType};
    use chrono::Utc;

    let now = Utc::now().timestamp_millis();
    Project {
        id: "default".to_string(),
        name: "My First Project".to_string(),
        blocks: vec![Block {
            id: "b1".to_string(),
            text: "Welcome to Nodepad — your spatial thinking tool. Add notes below and AI will annotate them.".to_string(),
            timestamp: now,
            content_type: ContentType::General,
            category: Some("intro".to_string()),
            annotation: Some("A spatial note-taking tool where blocks are automatically classified, annotated by AI, and connected by semantic influence.".to_string()),
            confidence: None,
            sources: None,
            influenced_by: None,
            is_unrelated: None,
            is_pinned: Some(true),
            sub_tasks: None,
            is_enriching: false,
        }],
        collapsed_ids: vec![],
        ghost_notes: vec![],
        last_ghost_texts: None,
        last_ghost_block_count: None,
        last_ghost_timestamp: None,
    }
}
