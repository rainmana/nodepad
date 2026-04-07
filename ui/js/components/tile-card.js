// TileCard component — renders a single block card
import { TYPE_CONFIG } from "../content-types.js"
import { updateBlock, deleteBlock, getState, updateActiveProject, getActiveProject, getAIConfig } from "../state.js"
import { enrichBlock } from "../api.js"
import { renderMarkdown } from "../markdown.js"

export function createTileCard(block, opts = {}) {
  const { hideCollapse = false, onReEnrich } = opts
  const cfg = TYPE_CONFIG[block.contentType] || TYPE_CONFIG.general

  const card = document.createElement("div")
  card.className = "tile-card"
  card.dataset.id = block.id
  card.style.setProperty("--accent", cfg.accent)

  if (block.isPinned) card.classList.add("pinned")
  if (block.isUnrelated) card.classList.add("unrelated")
  if (block.isEnriching) card.classList.add("enriching")

  card.innerHTML = buildCardHTML(block, cfg, hideCollapse)
  attachCardEvents(card, block, opts)
  return card
}

function buildCardHTML(block, cfg, hideCollapse) {
  const time = new Date(block.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const isTask = block.contentType === "task"
  const isCollapsed = false // handled at the view level

  return `
    <div class="card-header">
      <div class="card-type-badge" title="${cfg.label}">
        <span class="type-icon">${cfg.icon}</span>
        <span class="type-label">${cfg.label}</span>
      </div>
      ${block.category ? `<span class="card-category">${escHtml(block.category)}</span>` : ""}
      <div class="card-actions">
        ${block.isPinned ? `<button class="btn-icon active" data-action="pin" title="Unpin">📌</button>` : `<button class="btn-icon" data-action="pin" title="Pin">📌</button>`}
        <button class="btn-icon" data-action="reenrich" title="Re-annotate">🔄</button>
        <button class="btn-icon danger" data-action="delete" title="Delete">✕</button>
      </div>
    </div>

    <div class="card-body" data-part="body">
      ${isTask ? renderTaskBody(block) : `<div class="card-text" data-part="text">${escHtml(block.text)}</div>`}
    </div>

    ${block.annotation ? `
    <div class="card-annotation" data-part="annotation">
      <div class="annotation-content">${renderMarkdown(block.annotation)}</div>
      ${block.confidence != null ? `<div class="confidence-bar" title="${block.confidence}% confidence">
        <div class="confidence-fill" style="width:${block.confidence}%"></div>
        <span class="confidence-label">${Math.round(block.confidence)}%</span>
      </div>` : ""}
      ${block.sources?.length ? `<div class="card-sources">${block.sources.map(s =>
        `<a href="${s.url}" target="_blank" rel="noopener noreferrer" class="source-chip">${escHtml(s.siteName || s.title)}</a>`
      ).join("")}</div>` : ""}
    </div>` : ""}

    ${block.isEnriching ? `<div class="card-spinner"><span class="spinner"></span><span>${block.statusText || "Annotating…"}</span></div>` : ""}
    ${block.isError ? `<div class="card-error">${escHtml(block.statusText || "AI error")}</div>` : ""}

    <div class="card-footer">
      <span class="card-time">${time}</span>
      ${block.influencedBy?.length ? `<span class="connection-count" data-action="connections" title="${block.influencedBy.length} connections">⬡ ${block.influencedBy.length}</span>` : ""}
    </div>
  `
}

function renderTaskBody(block) {
  const tasks = block.subTasks || []
  return `
    <div class="card-text task-text">${escHtml(block.text)}</div>
    ${tasks.length ? `<ul class="subtask-list">${tasks.map(t => `
      <li class="subtask-item ${t.isDone ? "done" : ""}">
        <button class="subtask-check" data-action="subtask-toggle" data-subtask="${t.id}">
          ${t.isDone ? "✅" : "⬜"}
        </button>
        <span>${escHtml(t.text)}</span>
        <button class="btn-icon danger tiny" data-action="subtask-delete" data-subtask="${t.id}">✕</button>
      </li>`).join("")}
    </ul>` : ""}
  `
}

function attachCardEvents(card, block, opts) {
  const { onReEnrich, onHighlight, onConnectionHover } = opts

  // Double-click to edit
  card.addEventListener("dblclick", e => {
    if (e.target.closest("[data-action]")) return
    startEdit(card, block)
  })

  // Action buttons
  card.addEventListener("click", e => {
    const btn = e.target.closest("[data-action]")
    if (!btn) return
    const action = btn.dataset.action

    if (action === "delete") {
      deleteBlock(block.id)
      card.remove()
    } else if (action === "pin") {
      updateBlock(block.id, { isPinned: !block.isPinned })
      block.isPinned = !block.isPinned
      refreshCard(card, block)
    } else if (action === "reenrich") {
      if (onReEnrich) onReEnrich(block.id)
      else triggerEnrich(block.id)
    } else if (action === "connections") {
      if (onHighlight) onHighlight(block.id)
    } else if (action === "subtask-toggle") {
      const stId = btn.dataset.subtask
      const project = getActiveProject()
      const b = project.blocks.find(b => b.id === block.id)
      if (!b?.subTasks) return
      const updated = b.subTasks.map(t => t.id === stId ? { ...t, isDone: !t.isDone } : t)
      updateBlock(block.id, { subTasks: updated })
      block.subTasks = updated
      refreshCard(card, block)
    } else if (action === "subtask-delete") {
      const stId = btn.dataset.subtask
      const project = getActiveProject()
      const b = project.blocks.find(b => b.id === block.id)
      if (!b?.subTasks) return
      const updated = b.subTasks.filter(t => t.id !== stId)
      updateBlock(block.id, { subTasks: updated })
      block.subTasks = updated
      refreshCard(card, block)
    }
  })
}

function startEdit(card, block) {
  const textEl = card.querySelector("[data-part='text']")
  if (!textEl) return

  const ta = document.createElement("textarea")
  ta.className = "card-edit-textarea"
  ta.value = block.text
  textEl.replaceWith(ta)
  ta.focus()
  ta.setSelectionRange(ta.value.length, ta.value.length)
  ta.style.height = ta.scrollHeight + "px"

  ta.addEventListener("input", () => {
    ta.style.height = "auto"
    ta.style.height = ta.scrollHeight + "px"
  })

  ta.addEventListener("blur", () => {
    const newText = ta.value.trim()
    if (newText && newText !== block.text) {
      updateBlock(block.id, { text: newText })
      block.text = newText
    }
    refreshCard(card, block)
  })

  ta.addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      ta.blur()
    }
    if (e.key === "Escape") {
      ta.value = block.text
      ta.blur()
    }
  })
}

function refreshCard(card, block) {
  const cfg = TYPE_CONFIG[block.contentType] || TYPE_CONFIG.general
  card.style.setProperty("--accent", cfg.accent)
  card.classList.toggle("pinned", !!block.isPinned)
  card.classList.toggle("unrelated", !!block.isUnrelated)
  card.classList.toggle("enriching", !!block.isEnriching)
  card.innerHTML = buildCardHTML(block, cfg, false)
  attachCardEvents(card, block, {})
}

async function triggerEnrich(blockId) {
  const project = getActiveProject()
  const block = project?.blocks.find(b => b.id === blockId)
  if (!block) return

  const settings = getState().settings
  const config = getAIConfig(settings)
  if (!config) {
    alert("Configure your AI API key in Settings first.")
    return
  }

  updateBlock(blockId, { isEnriching: true, isError: false, statusText: "Annotating…" })

  const context = project.blocks
    .filter(b => b.id !== blockId)
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
  } catch (err) {
    updateBlock(blockId, { isEnriching: false, isError: true, statusText: err.message || "AI error" })
  }
}

function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
