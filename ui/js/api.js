// Tauri command wrappers
const { invoke } = window.__TAURI__.core

// ── Projects ──────────────────────────────────────────────────────────────────

export async function loadProjects() {
  return invoke("load_projects")
}

export async function saveProjects(store) {
  return invoke("save_projects", { store })
}

export async function importNodepadFile() {
  return invoke("import_nodepad_file")
}

export async function exportNodepadFile(projectName, content) {
  return invoke("export_nodepad_file", { projectName, content })
}

export async function exportMarkdownFile(projectName, content) {
  return invoke("export_markdown_file", { projectName, content })
}

// ── AI ────────────────────────────────────────────────────────────────────────

export async function enrichBlock(text, context, config, forcedType, category) {
  return invoke("enrich_block", { text, context, config, forcedType, category })
}

export async function generateGhost(context, previousTexts, config) {
  return invoke("generate_ghost", { context, previousTexts, config })
}

export async function fetchUrlMeta(url) {
  return invoke("fetch_url_meta", { url })
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportToMarkdown(projectName, blocks) {
  return invoke("export_to_markdown", { projectName, blocks })
}
