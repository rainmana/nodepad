// Nodepad — Tauri app entry point
import { loadProjects, enrichBlock, exportToMarkdown, exportMarkdownFile } from "./api.js"
import {
  getState, setState, subscribe, loadSettings, getActiveProject,
  updateActiveProject, updateBlock, addBlock, getAIConfig, forceSave
} from "./state.js"
import { detectContentType } from "./content-types.js"
import { renderTilingView } from "./views/tiling.js"
import { renderKanbanView } from "./views/kanban.js"
import { renderGraphView } from "./views/graph.js"
import { createSidebar, renderProjectList, syncSidebarSettings } from "./components/sidebar.js"
import { createGhostPanel, renderGhostList } from "./components/ghost-panel.js"

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function init() {
  // Load persisted data
  const [store, settings] = await Promise.all([
    loadProjects(),
    Promise.resolve(loadSettings()),
  ])

  setState({
    projects: store.projects,
    activeProjectId: store.activeProjectId || store.projects[0]?.id || "",
    settings,
    isLoaded: true,
  })

  buildUI()
  subscribeToState()
  renderAll()
}

// ── DOM ───────────────────────────────────────────────────────────────────────

let sidebar, ghostPanel, mainView, inputEl, statusBar

function buildUI() {
  const app = document.getElementById("app")
  app.innerHTML = `
    <div id="titlebar" data-tauri-drag-region>
      <div id="titlebar-left">
        <button id="btn-sidebar" class="btn-icon titlebar-btn" title="Projects & Settings">☰</button>
        <span id="project-name-display" class="project-name-display"></span>
      </div>
      <div id="view-switcher">
        <button class="view-btn active" data-view="tiling" title="Tiling">⊞ Tiling</button>
        <button class="view-btn" data-view="kanban" title="Kanban">⊟ Kanban</button>
        <button class="view-btn" data-view="graph" title="Graph">⬡ Graph</button>
      </div>
      <div id="titlebar-right">
        <button id="btn-ghost" class="btn-icon titlebar-btn" title="Ghost notes">✨</button>
        <span id="block-count" class="block-count"></span>
      </div>
    </div>

    <div id="main-area">
      <div id="main-view"></div>
    </div>

    <div id="input-bar">
      <div id="input-wrap">
        <textarea id="note-input" placeholder="Type a note… (Enter to add, Shift+Enter for newline)" rows="1"></textarea>
        <button id="btn-add" class="btn-primary">Add</button>
      </div>
    </div>

    <div id="status-bar">
      <span id="status-text"></span>
      <span id="status-right"></span>
    </div>
  `

  mainView = document.getElementById("main-view")
  inputEl = document.getElementById("note-input")

  // Sidebar
  sidebar = createSidebar()
  document.body.appendChild(sidebar)

  // Ghost panel
  ghostPanel = createGhostPanel()
  document.body.appendChild(ghostPanel)

  attachGlobalEvents()
}

// ── Events ────────────────────────────────────────────────────────────────────

function attachGlobalEvents() {
  // Sidebar toggle
  document.getElementById("btn-sidebar").addEventListener("click", () => {
    const { sidebarOpen } = getState()
    setState({ sidebarOpen: !sidebarOpen })
  })

  // Ghost panel toggle
  document.getElementById("btn-ghost").addEventListener("click", () => {
    const { ghostPanelOpen } = getState()
    setState({ ghostPanelOpen: !ghostPanelOpen })
  })
  document.addEventListener("nodepad:ghost-toggle", () => {
    const { ghostPanelOpen } = getState()
    setState({ ghostPanelOpen: !ghostPanelOpen })
  })

  // View switcher
  document.getElementById("view-switcher").addEventListener("click", e => {
    const btn = e.target.closest("[data-view]")
    if (!btn) return
    setState({ view: btn.dataset.view })
  })

  // Note input — auto-resize
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto"
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px"
  })

  // Submit on Enter (without Shift)
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitNote()
    }
  })

  // Add button
  document.getElementById("btn-add").addEventListener("click", submitNote)

  // Re-enrich handler
  document.addEventListener("nodepad:reenrich", async e => {
    const { blockId } = e.detail
    await performEnrich(blockId)
  })

  // Close panels on outside click
  document.addEventListener("click", e => {
    const state = getState()
    if (state.sidebarOpen && !sidebar.contains(e.target) && !e.target.closest("#btn-sidebar")) {
      setState({ sidebarOpen: false })
    }
    if (state.ghostPanelOpen && !ghostPanel.contains(e.target) && !e.target.closest("#btn-ghost")) {
      setState({ ghostPanelOpen: false })
    }
  })

  // Keyboard shortcuts
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      setState({ sidebarOpen: false, ghostPanelOpen: false })
    }
    // Cmd+1/2/3 for views
    if ((e.metaKey || e.ctrlKey) && ["1","2","3"].includes(e.key)) {
      const views = ["tiling","kanban","graph"]
      setState({ view: views[parseInt(e.key) - 1] })
    }
  })

  // Drag region — allow window drag from titlebar
  const titlebar = document.getElementById("titlebar")
  titlebar?.addEventListener("mousedown", e => {
    if (e.target.closest("button, input, select, textarea")) return
  })
}

// ── Note submission ───────────────────────────────────────────────────────────

async function submitNote() {
  const text = inputEl.value.trim()
  if (!text) return

  inputEl.value = ""
  inputEl.style.height = "auto"

  const block = addBlock(text)
  if (!block) return

  // Re-render immediately
  renderMain()
  setStatus(`Added: ${text.slice(0, 40)}${text.length > 40 ? "…" : ""}`)

  // Auto-enrich if API key configured
  const settings = getState().settings
  if (settings.apiKey) {
    await performEnrich(block.id)
  }
}

// ── AI enrichment ─────────────────────────────────────────────────────────────

async function performEnrich(blockId) {
  const project = getActiveProject()
  const block = project?.blocks.find(b => b.id === blockId)
  if (!block) return

  const settings = getState().settings
  const config = getAIConfig(settings)
  if (!config) return

  updateBlock(blockId, { isEnriching: true, isError: false, statusText: "Annotating…" })
  setStatus("Annotating with AI…")
  renderMain()

  const context = project.blocks
    .filter(b => b.id !== blockId && b.annotation)
    .slice(0, 20)
    .map(b => ({ id: b.id, text: b.text, category: b.category, annotation: b.annotation }))

  try {
    const result = await enrichBlock(block.text, context, config, null, null)
    const influencedBy = (result.influencedByIndices || [])
      .map(i => context[i]?.id)
      .filter(Boolean)

    updateBlock(blockId, {
      contentType: result.contentType,
      category: result.category,
      annotation: result.annotation,
      confidence: result.confidence,
      sources: result.sources,
      influencedBy,
      isUnrelated: result.isUnrelated,
      isEnriching: false,
      isError: false,
      statusText: undefined,
    })
    setStatus(`Annotated: ${result.category}`)
  } catch (err) {
    updateBlock(blockId, { isEnriching: false, isError: true, statusText: err.message || "AI error" })
    setStatus("AI error: " + (err.message || "unknown"))
    console.error("Enrich error:", err)
  }

  renderMain()
}

// ── Render ────────────────────────────────────────────────────────────────────

function subscribeToState() {
  subscribe(state => renderAll(state))
}

function renderAll(state = getState()) {
  renderTitlebar(state)
  renderViewButtons(state)
  renderSidebarVisibility(state)
  renderGhostPanelVisibility(state)
  renderMain(state)
  renderStatusBar(state)
}

function renderMain(state = getState()) {
  switch (state.view) {
    case "tiling": renderTilingView(mainView); break
    case "kanban": renderKanbanView(mainView); break
    case "graph":  renderGraphView(mainView); break
  }
}

function renderTitlebar(state = getState()) {
  const project = getActiveProject()
  const nameEl = document.getElementById("project-name-display")
  if (nameEl) nameEl.textContent = project?.name || ""
  const countEl = document.getElementById("block-count")
  if (countEl) countEl.textContent = project ? `${project.blocks.length} notes` : ""
}

function renderViewButtons(state = getState()) {
  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === state.view)
  })
}

function renderSidebarVisibility(state = getState()) {
  sidebar.classList.toggle("open", state.sidebarOpen)
  sidebar.setAttribute("aria-hidden", !state.sidebarOpen)
  if (state.sidebarOpen) {
    renderProjectList(sidebar)
    syncSidebarSettings(sidebar)
  }
}

function renderGhostPanelVisibility(state = getState()) {
  ghostPanel.classList.toggle("open", state.ghostPanelOpen)
  ghostPanel.setAttribute("aria-hidden", !state.ghostPanelOpen)
  if (state.ghostPanelOpen) renderGhostList(ghostPanel)
}

function renderStatusBar(state = getState()) {
  const project = getActiveProject()
  const right = document.getElementById("status-right")
  if (right && project) {
    const annotated = project.blocks.filter(b => b.annotation).length
    right.textContent = `${annotated}/${project.blocks.length} annotated`
  }
}

function setStatus(msg) {
  const el = document.getElementById("status-text")
  if (el) { el.textContent = msg; setTimeout(() => { el.textContent = "" }, 4000) }
}

// ── Start ─────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", init)
