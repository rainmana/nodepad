// Ghost panel — AI-suggested emergent thesis notes
import { getActiveProject, updateActiveProject, getState, getAIConfig } from "../state.js"
import { generateGhost } from "../api.js"
import { TYPE_CONFIG } from "../content-types.js"

export function createGhostPanel() {
  const el = document.createElement("div")
  el.id = "ghost-panel"
  el.className = "ghost-panel"
  el.setAttribute("aria-hidden", "true")

  el.innerHTML = `
    <div class="ghost-header">
      <span class="ghost-title">✨ Ghost Notes</span>
      <button class="btn-icon" id="ghost-close">✕</button>
    </div>
    <div id="ghost-list" class="ghost-list"></div>
    <div class="ghost-footer">
      <button class="btn-primary" id="btn-generate-ghost">Generate thesis</button>
    </div>
  `

  el.querySelector("#ghost-close").addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("nodepad:ghost-toggle"))
  })

  el.querySelector("#btn-generate-ghost").addEventListener("click", () => {
    generateGhostNote()
  })

  return el
}

export function renderGhostList(el) {
  const list = el.querySelector("#ghost-list")
  if (!list) return
  const project = getActiveProject()
  if (!project) return

  const ghosts = project.ghostNotes || []
  if (ghosts.length === 0) {
    list.innerHTML = `<div class="ghost-empty">Generate a thesis from your notes</div>`
    return
  }

  list.innerHTML = ghosts.map(g => `
    <div class="ghost-item ${g.isGenerating ? "generating" : ""}" data-gid="${g.id}">
      <div class="ghost-category">${escHtml(g.category)}</div>
      <div class="ghost-text">${g.isGenerating ? `<span class="spinner"></span> Generating…` : escHtml(g.text)}</div>
      <div class="ghost-actions">
        <button class="btn-secondary tiny" data-action="adopt" data-gid="${g.id}">Adopt as note</button>
        <button class="btn-icon danger tiny" data-action="dismiss" data-gid="${g.id}">✕</button>
      </div>
    </div>
  `).join("")

  list.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action
      const gid = btn.dataset.gid
      const project = getActiveProject()
      const ghost = project.ghostNotes.find(g => g.id === gid)

      if (action === "dismiss") {
        updateActiveProject({ ghostNotes: project.ghostNotes.filter(g => g.id !== gid) })
      } else if (action === "adopt" && ghost) {
        // Add ghost as a thesis block
        const newBlock = {
          id: Math.random().toString(36).slice(2, 10),
          text: ghost.text,
          timestamp: Date.now(),
          contentType: "thesis",
          category: ghost.category,
          isEnriching: false,
          isError: false,
        }
        updateActiveProject({
          blocks: [newBlock, ...(project.blocks || [])],
          ghostNotes: project.ghostNotes.filter(g => g.id !== gid),
        })
      }
    })
  })
}

async function generateGhostNote() {
  const project = getActiveProject()
  if (!project || project.blocks.length < 3) {
    alert("Add at least 3 annotated notes to generate a thesis.")
    return
  }

  const settings = getState().settings
  const config = getAIConfig(settings)
  if (!config) {
    alert("Configure your AI API key in Settings first.")
    return
  }

  // Add a placeholder
  const placeholderId = Math.random().toString(36).slice(2, 10)
  const placeholder = { id: placeholderId, text: "", category: "thesis", isGenerating: true }
  updateActiveProject({ ghostNotes: [...(project.ghostNotes || []), placeholder] })

  const annotated = project.blocks
    .filter(b => b.annotation && b.category)
    .slice(0, 30)

  const context = annotated.map(b => ({
    text: b.text,
    category: b.category,
    contentType: b.contentType,
  }))

  const previousTexts = (project.lastGhostTexts || []).slice(0, 10)

  try {
    const result = await generateGhost(context, previousTexts, config)
    const freshProject = getActiveProject()
    const updatedGhosts = (freshProject.ghostNotes || []).map(g =>
      g.id === placeholderId
        ? { ...g, text: result.text, category: result.category, isGenerating: false }
        : g
    )
    updateActiveProject({
      ghostNotes: updatedGhosts,
      lastGhostTexts: [...(freshProject.lastGhostTexts || []), result.text].slice(-20),
      lastGhostTimestamp: Date.now(),
      lastGhostBlockCount: freshProject.blocks.length,
    })
  } catch (err) {
    const freshProject = getActiveProject()
    updateActiveProject({
      ghostNotes: (freshProject.ghostNotes || []).filter(g => g.id !== placeholderId)
    })
    alert("Ghost generation failed: " + err.message)
  }
}

function escHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
