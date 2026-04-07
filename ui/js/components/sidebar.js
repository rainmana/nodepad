// Project sidebar + settings panel
import {
  getState, setState, loadSettings, saveSettings, getModels, PROVIDERS,
  createProject, deleteProject, renameProject, getActiveProject
} from "../state.js"
import { importNodepadFile, exportNodepadFile, exportToMarkdown, exportMarkdownFile } from "../api.js"

export function createSidebar() {
  const el = document.createElement("div")
  el.id = "sidebar"
  el.className = "sidebar"
  el.setAttribute("aria-hidden", "true")

  el.innerHTML = `
    <div class="sidebar-inner">
      <div class="sidebar-header">
        <span class="sidebar-logo">nodepad</span>
        <button class="btn-icon sidebar-close" id="sidebar-close">✕</button>
      </div>

      <div class="sidebar-section" id="projects-section">
        <div class="section-title">Projects</div>
        <div id="project-list" class="project-list"></div>
        <div class="sidebar-actions">
          <button class="btn-secondary" id="btn-new-project">+ New project</button>
          <button class="btn-secondary" id="btn-import-project">↓ Import .nodepad</button>
        </div>
      </div>

      <div class="sidebar-divider"></div>

      <div class="sidebar-section">
        <div class="section-title">AI Settings</div>
        <div class="settings-form">
          <label class="form-label">Provider</label>
          <select id="setting-provider" class="form-select">
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
          </select>

          <label class="form-label">Model</label>
          <select id="setting-model" class="form-select"></select>

          <label class="form-label">API Key</label>
          <div class="key-input-row">
            <input id="setting-key" type="password" class="form-input" placeholder="sk-..." autocomplete="off">
            <button class="btn-icon" id="btn-toggle-key" title="Show/hide key">👁</button>
          </div>

          <div class="setting-row">
            <label class="form-label">Web grounding</label>
            <input id="setting-grounding" type="checkbox" class="form-checkbox">
          </div>

          <button class="btn-primary" id="btn-save-settings">Save settings</button>
        </div>
      </div>

      <div class="sidebar-divider"></div>

      <div class="sidebar-section">
        <div class="section-title">Export</div>
        <div class="sidebar-actions">
          <button class="btn-secondary" id="btn-export-nodepad">↑ Export .nodepad</button>
          <button class="btn-secondary" id="btn-export-markdown">↑ Export Markdown</button>
        </div>
      </div>
    </div>
  `

  attachSidebarEvents(el)
  return el
}

function attachSidebarEvents(el) {
  // Close
  el.querySelector("#sidebar-close").addEventListener("click", () => {
    setState({ sidebarOpen: false })
  })

  // New project
  el.querySelector("#btn-new-project").addEventListener("click", () => {
    showInlineInput(el.querySelector("#projects-section"), "New project name…", "Untitled", name => {
      if (name?.trim()) createProject(name.trim())
    })
  })

  // Import
  el.querySelector("#btn-import-project").addEventListener("click", async () => {
    try {
      const raw = await importNodepadFile()
      if (!raw) return
      const data = JSON.parse(raw)
      if (!data?.project?.blocks) throw new Error("Invalid .nodepad file")
      const state = getState()
      let name = data.project.name || "Imported"
      const existingNames = state.projects.map(p => p.name)
      if (existingNames.includes(name)) {
        let n = 2
        while (existingNames.includes(`${name} (${n})`)) n++
        name = `${name} (${n})`
      }
      const newProject = {
        id: Math.random().toString(36).slice(2, 10),
        name,
        blocks: data.project.blocks.map(b => ({ ...b, isEnriching: false, isError: false })),
        collapsedIds: data.project.collapsedIds || [],
        ghostNotes: data.project.ghostNotes || [],
        lastGhostTexts: data.project.lastGhostTexts,
        lastGhostBlockCount: data.project.lastGhostBlockCount,
        lastGhostTimestamp: data.project.lastGhostTimestamp,
      }
      setState({ projects: [...state.projects, newProject], activeProjectId: newProject.id })
    } catch (err) {
      alert("Import failed: " + err.message)
    }
  })

  // Provider change
  el.querySelector("#setting-provider").addEventListener("change", e => {
    populateModelDropdown(el, e.target.value)
  })

  // Toggle API key visibility
  el.querySelector("#btn-toggle-key").addEventListener("click", () => {
    const input = el.querySelector("#setting-key")
    input.type = input.type === "password" ? "text" : "password"
  })

  // Save settings
  el.querySelector("#btn-save-settings").addEventListener("click", () => {
    const provider = el.querySelector("#setting-provider").value
    const modelId  = el.querySelector("#setting-model").value
    const apiKey   = el.querySelector("#setting-key").value.trim()
    const grounding = el.querySelector("#setting-grounding").checked
    const settings = { provider, modelId, apiKey, webGrounding: grounding }
    saveSettings(settings)
    setState({ settings })
    showToast("Settings saved")
  })

  // Export .nodepad
  el.querySelector("#btn-export-nodepad").addEventListener("click", async () => {
    const project = getActiveProject()
    if (!project) return
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      project: {
        id: project.id,
        name: project.name,
        blocks: project.blocks,
        collapsedIds: project.collapsedIds || [],
        ghostNotes: project.ghostNotes || [],
      }
    }
    await exportNodepadFile(project.name, JSON.stringify(payload, null, 2))
  })

  // Export Markdown
  el.querySelector("#btn-export-markdown").addEventListener("click", async () => {
    const project = getActiveProject()
    if (!project) return
    const md = await exportToMarkdown(project.name, project.blocks)
    await exportMarkdownFile(project.name, md)
  })
}

function populateModelDropdown(el, provider) {
  const select = el.querySelector("#setting-model")
  const models = getModels(provider)
  const current = select.value
  select.innerHTML = models.map(m =>
    `<option value="${m.id}" ${m.id === current ? "selected" : ""}>${m.label}</option>`
  ).join("")
}

export function renderProjectList(el) {
  const list = el.querySelector("#project-list")
  if (!list) return
  const state = getState()

  list.innerHTML = state.projects.map(p => `
    <div class="project-item ${p.id === state.activeProjectId ? "active" : ""}" data-pid="${p.id}">
      <span class="project-name" data-pid="${p.id}">${escHtml(p.name)}</span>
      <span class="project-count">${p.blocks?.length || 0}</span>
      <button class="btn-icon danger tiny" data-action="delete-project" data-pid="${p.id}" title="Delete project">✕</button>
    </div>
  `).join("")

  list.querySelectorAll(".project-item").forEach(item => {
    item.addEventListener("click", e => {
      const pid = item.dataset.pid
      const action = e.target.closest("[data-action]")?.dataset?.action
      if (action === "delete-project") {
        if (confirm("Delete this project? This cannot be undone.")) {
          deleteProject(pid)
        }
        return
      }
      setState({ activeProjectId: pid, sidebarOpen: false })
    })

    // Double-click to rename
    item.querySelector(".project-name").addEventListener("dblclick", e => {
      e.stopPropagation()
      const pid = item.dataset.pid
      const current = state.projects.find(p => p.id === pid)?.name || ""
      showInlineInput(item.closest("#projects-section") || el.querySelector("#projects-section"), "Rename project…", current, newName => {
        if (newName?.trim() && newName.trim() !== current) {
          renameProject(pid, newName.trim())
        }
      })
    })
  })
}

export function syncSidebarSettings(el) {
  const settings = loadSettings()
  const providerEl = el.querySelector("#setting-provider")
  const keyEl = el.querySelector("#setting-key")
  const groundingEl = el.querySelector("#setting-grounding")

  if (providerEl) {
    providerEl.value = settings.provider || "openrouter"
    populateModelDropdown(el, settings.provider || "openrouter")
    const modelEl = el.querySelector("#setting-model")
    if (modelEl) modelEl.value = settings.modelId || ""
  }
  if (keyEl) keyEl.value = settings.apiKey || ""
  if (groundingEl) groundingEl.checked = !!settings.webGrounding
}

function escHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function showInlineInput(anchor, placeholder, defaultValue, onConfirm) {
  // Remove any existing inline input
  anchor.querySelector(".inline-input-row")?.remove()

  const row = document.createElement("div")
  row.className = "inline-input-row"
  row.innerHTML = `
    <input class="form-input inline-name-input" type="text" placeholder="${escHtml(placeholder)}" value="${escHtml(defaultValue)}">
    <button class="btn-primary btn-inline-confirm">OK</button>
    <button class="btn-icon btn-inline-cancel">✕</button>
  `
  anchor.appendChild(row)

  const input = row.querySelector(".inline-name-input")
  input.focus()
  input.select()

  const confirm = () => {
    const val = input.value.trim()
    row.remove()
    onConfirm(val)
  }
  const cancel = () => row.remove()

  row.querySelector(".btn-inline-confirm").addEventListener("click", confirm)
  row.querySelector(".btn-inline-cancel").addEventListener("click", cancel)
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") confirm()
    if (e.key === "Escape") cancel()
  })
}

function showToast(msg) {
  const t = document.createElement("div")
  t.className = "toast"
  t.textContent = msg
  document.body.appendChild(t)
  requestAnimationFrame(() => t.classList.add("show"))
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300) }, 2000)
}
