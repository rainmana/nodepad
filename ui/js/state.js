// Central reactive state store
import { saveProjects } from "./api.js"
import { detectContentType } from "./content-types.js"

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

function now() {
  return Date.now()
}

// ── Settings (localStorage) ───────────────────────────────────────────────────

const SETTINGS_KEY = "nodepad-settings"

export const PROVIDERS = {
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  openai:     { label: "OpenAI",     baseUrl: "https://api.openai.com/v1" },
}

export const OPENROUTER_MODELS = [
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5", supportsGrounding: false },
  { id: "openai/gpt-4o",               label: "GPT-4o",            supportsGrounding: true  },
  { id: "google/gemini-2.5-pro-preview-03-25", label: "Gemini 2.5 Pro", supportsGrounding: true },
  { id: "deepseek/deepseek-chat",       label: "DeepSeek V3",      supportsGrounding: false },
  { id: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small 3.2", supportsGrounding: false },
]

export const OPENAI_MODELS = [
  { id: "gpt-4o",      label: "GPT-4o",      supportsGrounding: true,  groundingModelId: "gpt-4o-search-preview"      },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", supportsGrounding: true,  groundingModelId: "gpt-4o-mini-search-preview" },
  { id: "gpt-4.1",     label: "GPT-4.1",     supportsGrounding: false },
  { id: "gpt-4.1-mini",label: "GPT-4.1 Mini",supportsGrounding: false },
  { id: "o4-mini",     label: "o4-mini",     supportsGrounding: false },
]

function defaultSettings() {
  return { apiKey: "", provider: "openrouter", modelId: "openai/gpt-4o", webGrounding: false }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings()
    return { ...defaultSettings(), ...JSON.parse(raw) }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function getAIConfig(settings) {
  if (!settings.apiKey) return null
  const models = settings.provider === "openai" ? OPENAI_MODELS : OPENROUTER_MODELS
  const model = models.find(m => m.id === settings.modelId) || models[0]
  return {
    apiKey: settings.apiKey,
    modelId: model.id,
    provider: settings.provider,
    webGrounding: settings.webGrounding && (model?.supportsGrounding ?? false),
    customBaseUrl: null,
  }
}

export function getModels(provider) {
  return provider === "openai" ? OPENAI_MODELS : OPENROUTER_MODELS
}

// ── State ─────────────────────────────────────────────────────────────────────

let _state = {
  projects: [],
  activeProjectId: "",
  view: "tiling",         // "tiling" | "kanban" | "graph"
  sidebarOpen: false,
  ghostPanelOpen: false,
  highlightedBlockId: null,
  settings: defaultSettings(),
  isLoaded: false,
}

const listeners = new Set()

export function getState() { return _state }

export function setState(patch) {
  _state = { ..._state, ...patch }
  for (const fn of listeners) fn(_state)
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ── Project helpers ───────────────────────────────────────────────────────────

export function getActiveProject() {
  return _state.projects.find(p => p.id === _state.activeProjectId) || _state.projects[0]
}

export function updateActiveProject(patch) {
  setState({
    projects: _state.projects.map(p =>
      p.id === _state.activeProjectId ? { ...p, ...patch } : p
    )
  })
  scheduleSave()
}

export function addBlock(text) {
  const project = getActiveProject()
  if (!project) return null
  const block = {
    id: genId(),
    text,
    timestamp: now(),
    contentType: detectContentType(text),
    isEnriching: false,
    isError: false,
  }
  updateActiveProject({ blocks: [block, ...project.blocks] })
  return block
}

export function updateBlock(id, patch) {
  const project = getActiveProject()
  if (!project) return
  updateActiveProject({
    blocks: project.blocks.map(b => b.id === id ? { ...b, ...patch } : b)
  })
}

export function deleteBlock(id) {
  const project = getActiveProject()
  if (!project) return
  updateActiveProject({ blocks: project.blocks.filter(b => b.id !== id) })
}

export function createProject(name) {
  const id = genId()
  const project = {
    id, name,
    blocks: [],
    collapsedIds: [],
    ghostNotes: [],
  }
  setState({
    projects: [..._state.projects, project],
    activeProjectId: id,
  })
  scheduleSave()
  return project
}

export function deleteProject(id) {
  const remaining = _state.projects.filter(p => p.id !== id)
  const activeId = _state.activeProjectId === id
    ? (remaining[0]?.id || "")
    : _state.activeProjectId
  setState({ projects: remaining, activeProjectId: activeId })
  scheduleSave()
}

export function renameProject(id, name) {
  setState({
    projects: _state.projects.map(p => p.id === id ? { ...p, name } : p)
  })
  scheduleSave()
}

// ── Persistence ───────────────────────────────────────────────────────────────

let _saveTimer = null

function scheduleSave() {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(persistState, 800)
}

async function persistState() {
  const { projects, activeProjectId } = _state
  try {
    await saveProjects({
      projects: projects.map(stripTransient),
      activeProjectId,
    })
  } catch (err) {
    console.error("Save failed:", err)
  }
}

function stripTransient(project) {
  return {
    ...project,
    blocks: project.blocks.map(b => {
      const { isEnriching, isError, statusText, ...rest } = b
      return rest
    })
  }
}

export function forceSave() {
  clearTimeout(_saveTimer)
  return persistState()
}
