// Kanban view — columns by content type
import { TYPE_CONFIG } from "../content-types.js"
import { createTileCard } from "../components/tile-card.js"
import { getActiveProject } from "../state.js"

export function renderKanbanView(container) {
  const project = getActiveProject()
  if (!project) { container.innerHTML = "<div class='empty-state'>No project selected</div>"; return }

  const blocks = project.blocks
  if (blocks.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✏️</div><div>Add notes to see them organised here</div></div>`
    return
  }

  // Group blocks by content type
  const groups = {}
  for (const block of blocks) {
    const type = block.contentType || "general"
    if (!groups[type]) groups[type] = []
    groups[type].push(block)
  }

  // Order: pinned first, then by type order
  const typeOrder = [
    "thesis","claim","question","idea","task","entity","definition",
    "reference","quote","opinion","reflection","narrative","comparison","general"
  ]

  container.innerHTML = ""
  const board = document.createElement("div")
  board.className = "kanban-board"

  // Pinned column if any pinned blocks exist
  const pinned = blocks.filter(b => b.isPinned)
  if (pinned.length) {
    board.appendChild(createColumn("📌 Pinned", pinned, "pinned"))
  }

  for (const type of typeOrder) {
    if (!groups[type]?.length) continue
    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.general
    board.appendChild(createColumn(`${cfg.icon} ${cfg.label}`, groups[type], type))
  }

  container.appendChild(board)
}

function createColumn(title, blocks, type) {
  const col = document.createElement("div")
  col.className = "kanban-column"
  col.dataset.type = type

  const header = document.createElement("div")
  header.className = "kanban-header"
  header.innerHTML = `<span class="kanban-title">${escHtml(title)}</span><span class="kanban-count">${blocks.length}</span>`
  col.appendChild(header)

  const cards = document.createElement("div")
  cards.className = "kanban-cards"
  for (const block of blocks) {
    const card = createTileCard(block, {
      hideCollapse: true,
      onReEnrich: (id) => document.dispatchEvent(new CustomEvent("nodepad:reenrich", { detail: { blockId: id } }))
    })
    cards.appendChild(card)
  }
  col.appendChild(cards)
  return col
}

function escHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
