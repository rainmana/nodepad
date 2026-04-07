// Tiling view — BSP layout, 7 tiles per page
import { createTileCard } from "../components/tile-card.js"
import { getActiveProject, updateBlock, getState, getAIConfig } from "../state.js"
import { enrichBlock } from "../api.js"

const PAGE_SIZE = 7

export function renderTilingView(container, { onReEnrich } = {}) {
  const project = getActiveProject()
  if (!project) { container.innerHTML = "<div class='empty-state'>No project selected</div>"; return }

  const blocks = project.blocks
  if (blocks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✏️</div>
        <div>Type a note below to get started</div>
      </div>`
    return
  }

  // Pagination
  const totalPages = Math.ceil(blocks.length / PAGE_SIZE)
  let currentPage = parseInt(container.dataset.page || "0", 10)
  currentPage = Math.min(currentPage, totalPages - 1)
  container.dataset.page = currentPage

  const pageBlocks = blocks.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  container.innerHTML = ""

  // Minimap / pagination dots
  if (totalPages > 1) {
    const dots = document.createElement("div")
    dots.className = "tiling-dots"
    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement("button")
      dot.className = `tiling-dot ${i === currentPage ? "active" : ""}`
      dot.title = `Page ${i + 1}`
      dot.addEventListener("click", () => {
        container.dataset.page = i
        renderTilingView(container, { onReEnrich })
      })
      dots.appendChild(dot)
    }
    container.appendChild(dots)
  }

  // BSP grid
  const bspRoot = document.createElement("div")
  bspRoot.className = "bsp-root"
  buildBSP(bspRoot, pageBlocks, 0, { onReEnrich })
  container.appendChild(bspRoot)

  // Keyboard nav for pages
  container._tilingKeyHandler = (e) => {
    if (e.target.matches("input, textarea")) return
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      const next = Math.min(currentPage + 1, totalPages - 1)
      if (next !== currentPage) { container.dataset.page = next; renderTilingView(container, { onReEnrich }) }
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      const prev = Math.max(currentPage - 1, 0)
      if (prev !== currentPage) { container.dataset.page = prev; renderTilingView(container, { onReEnrich }) }
    }
  }
}

function buildBSP(container, blocks, depth) {
  if (blocks.length === 0) return
  if (blocks.length === 1) {
    const block = blocks[0]
    const wrapper = document.createElement("div")
    wrapper.className = "bsp-leaf"
    const card = createTileCard(block, { hideCollapse: true, onReEnrich: (id) => dispatchReEnrich(id) })
    wrapper.appendChild(card)
    container.appendChild(wrapper)
    return
  }

  const split = document.createElement("div")
  split.className = `bsp-split ${depth % 2 === 0 ? "vertical" : "horizontal"}`
  const mid = Math.floor(blocks.length / 2)

  const left = document.createElement("div")
  left.className = "bsp-child"
  buildBSP(left, blocks.slice(0, mid), depth + 1)

  const right = document.createElement("div")
  right.className = "bsp-child"
  buildBSP(right, blocks.slice(mid), depth + 1)

  split.appendChild(left)
  split.appendChild(right)
  container.appendChild(split)
}

function dispatchReEnrich(blockId) {
  document.dispatchEvent(new CustomEvent("nodepad:reenrich", { detail: { blockId } }))
}
