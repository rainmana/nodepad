// Graph view — force-directed graph using D3
// D3 must be loaded globally as window.d3 (from vendor/d3.min.js)
import { TYPE_CONFIG } from "../content-types.js"
import { getActiveProject } from "../state.js"

export function renderGraphView(container) {
  const project = getActiveProject()
  container.innerHTML = ""

  if (!project || project.blocks.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⬡</div><div>Add connected notes to see the graph</div></div>`
    return
  }

  if (!window.d3) {
    container.innerHTML = `<div class="empty-state">D3 not loaded — run <code>mise run setup</code> to download vendor libs.</div>`
    return
  }

  const d3 = window.d3
  const blocks = project.blocks
  const W = container.clientWidth || 900
  const H = container.clientHeight || 600
  const cx = W / 2, cy = H / 2, outerR = Math.min(W, H) * 0.42

  // Build nodes + links from influencedBy
  const nodeMap = new Map()
  for (const b of blocks) {
    nodeMap.set(b.id, {
      id: b.id,
      block: b,
      degree: 0,
      x: cx + (Math.random() - 0.5) * 200,
      y: cy + (Math.random() - 0.5) * 200,
    })
  }

  const links = []
  for (const b of blocks) {
    for (const tid of (b.influencedBy || [])) {
      if (nodeMap.has(tid)) {
        links.push({ source: b.id, target: tid })
        nodeMap.get(b.id).degree++
        nodeMap.get(tid).degree++
      }
    }
  }

  const nodes = [...nodeMap.values()]
  const maxDeg = Math.max(...nodes.map(n => n.degree), 1)

  // Detail panel
  let selectedId = null
  const detail = document.createElement("div")
  detail.className = "graph-detail"
  detail.style.display = "none"
  container.appendChild(detail)

  // SVG
  const svg = d3.select(container)
    .append("svg")
    .attr("width", W)
    .attr("height", H)
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0)

  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -4 8 8")
    .attr("refX", 18)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-4L8,0L0,4")
    .attr("fill", "rgba(255,255,255,0.2)")

  const linkEl = svg.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "graph-link")
    .attr("marker-end", "url(#arrow)")

  const nodeEl = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "graph-node")
    .call(d3.drag()
      .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y })
      .on("end", (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
    )
    .on("click", (event, d) => {
      event.stopPropagation()
      selectedId = d.id
      showDetail(detail, d.block)
      nodeEl.classed("selected", n => n.id === d.id)
    })

  // Node circles
  nodeEl.append("circle")
    .attr("r", d => nodeRadius(d.degree, maxDeg))
    .attr("fill", d => {
      const cfg = TYPE_CONFIG[d.block.contentType] || TYPE_CONFIG.general
      return cfg.accent + "cc"
    })
    .attr("stroke", d => {
      const cfg = TYPE_CONFIG[d.block.contentType] || TYPE_CONFIG.general
      return cfg.accent
    })
    .attr("stroke-width", 1.5)

  // Node labels
  nodeEl.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", d => nodeRadius(d.degree, maxDeg) + 14)
    .attr("font-size", "10px")
    .attr("fill", "rgba(255,255,255,0.7)")
    .text(d => truncate(d.block.text, 22))

  // Type icon
  nodeEl.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("font-size", d => `${Math.round(nodeRadius(d.degree, maxDeg) * 0.9)}px`)
    .text(d => (TYPE_CONFIG[d.block.contentType] || TYPE_CONFIG.general).icon)

  // Force simulation
  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id(d => d.id).distance(120).strength(0.5))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(cx, cy).strength(0.05))
    .force("radial", d3.forceRadial(d => radialTarget(d.degree, maxDeg, outerR), cx, cy).strength(0.3))
    .force("collision", d3.forceCollide(d => nodeRadius(d.degree, maxDeg) + 20))
    .on("tick", () => {
      linkEl
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y)
      nodeEl.attr("transform", d => `translate(${d.x},${d.y})`)
    })

  // Click background to deselect
  svg.on("click", () => {
    selectedId = null
    detail.style.display = "none"
    nodeEl.classed("selected", false)
  })

  // Zoom
  svg.call(d3.zoom()
    .scaleExtent([0.3, 3])
    .on("zoom", ({ transform }) => {
      svg.selectAll("g").attr("transform", transform)
    })
  )
}

function showDetail(detailEl, block) {
  if (!block) { detailEl.style.display = "none"; return }
  const cfg = TYPE_CONFIG[block.contentType] || TYPE_CONFIG.general
  detailEl.style.display = "block"
  detailEl.innerHTML = `
    <button class="graph-detail-close" id="graph-detail-close">✕</button>
    <div class="graph-detail-type" style="color:${cfg.accent}">${cfg.icon} ${cfg.label}</div>
    ${block.category ? `<div class="graph-detail-category">${escHtml(block.category)}</div>` : ""}
    <div class="graph-detail-text">${escHtml(block.text)}</div>
    ${block.annotation ? `<div class="graph-detail-annotation">${escHtml(block.annotation)}</div>` : ""}
    ${block.confidence != null ? `<div class="graph-detail-confidence">Confidence: ${Math.round(block.confidence)}%</div>` : ""}
    ${block.influencedBy?.length ? `<div class="graph-detail-connections">⬡ ${block.influencedBy.length} connections</div>` : ""}
  `
  detailEl.querySelector("#graph-detail-close")?.addEventListener("click", e => {
    e.stopPropagation()
    detailEl.style.display = "none"
  })
}

function nodeRadius(degree, maxDeg, rMin = 18, rMax = 34) {
  if (maxDeg === 0) return rMin
  return rMin + (rMax - rMin) * Math.sqrt(degree / maxDeg)
}

function radialTarget(degree, maxDeg, outerR) {
  if (maxDeg === 0) return outerR * 0.72
  return outerR * (1 - (degree / maxDeg) * 0.82)
}

function truncate(text, maxLen) {
  if (!text) return ""
  return text.length <= maxLen ? text : text.slice(0, maxLen) + "…"
}

function escHtml(str = "") {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
