mod commands;
mod models;

use commands::{
    ai::{enrich_block, fetch_url_meta, generate_ghost},
    export::export_to_markdown,
    projects::{export_markdown_file, export_nodepad_file, import_nodepad_file, load_projects, save_projects},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Projects
            load_projects,
            save_projects,
            import_nodepad_file,
            export_nodepad_file,
            export_markdown_file,
            // AI
            enrich_block,
            generate_ghost,
            fetch_url_meta,
            // Export
            export_to_markdown,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
