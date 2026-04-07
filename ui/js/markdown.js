// Minimal markdown renderer (bold, italic, inline code, links)
export function renderMarkdown(text) {
  if (!text) return ""
  let html = escHtml(text)
  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  // *italic*
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>")
  // `code`
  html = html.replace(/`(.+?)`/g, "<code>$1</code>")
  // newlines
  html = html.replace(/\n/g, "<br>")
  return html
}

function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
