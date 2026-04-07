// Content type definitions — mirrors lib/content-types.ts

export const CONTENT_TYPES = [
  "entity","claim","question","task","idea","reference",
  "quote","definition","opinion","reflection","narrative",
  "comparison","thesis","general"
]

export const TYPE_CONFIG = {
  entity:     { label: "Entity",      icon: "🌐", accent: "#6366f1" },
  claim:      { label: "Claim",       icon: "⚡", accent: "#f59e0b" },
  question:   { label: "Question",    icon: "❓", accent: "#3b82f6" },
  task:       { label: "Task",        icon: "✅", accent: "#10b981" },
  idea:       { label: "Idea",        icon: "💡", accent: "#f97316" },
  reference:  { label: "Reference",   icon: "🔗", accent: "#8b5cf6" },
  quote:      { label: "Quote",       icon: "💬", accent: "#06b6d4" },
  definition: { label: "Definition",  icon: "📖", accent: "#84cc16" },
  opinion:    { label: "Opinion",     icon: "🗣️", accent: "#ec4899" },
  reflection: { label: "Reflection",  icon: "✨", accent: "#a78bfa" },
  narrative:  { label: "Narrative",   icon: "📜", accent: "#d97706" },
  comparison: { label: "Comparison",  icon: "⚖️", accent: "#0ea5e9" },
  thesis:     { label: "Thesis",      icon: "🔬", accent: "#c084fc" },
  general:    { label: "Note",        icon: "📝", accent: "#6b7280" },
}

export function detectContentType(text) {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  if (/^["'\u201C\u201D\u2018\u2019]/.test(trimmed)) return "quote"
  if (/^\[[\sx]?\]/i.test(trimmed) || /^(todo|fixme|buy|call|send|finish|complete|remind|need to)\b/i.test(trimmed)) return "task"
  if (trimmed.startsWith("?") || /^[^.!]{3,}\?/.test(trimmed)) return "question"
  if (/\b(is defined as|means|refers to|is the)\b/i.test(lower)) return "definition"
  if (/\b(vs\.?|versus|compared to|on the other hand|differs from|difference between)\b/i.test(lower)) return "comparison"
  if (/^https?:\/\//i.test(trimmed)) return "reference"
  if (/^(what if|could we|imagine|how about|maybe we)\b/i.test(trimmed)) return "idea"
  if (/\b(i remember|looking back|in retrospect|upon reflection)\b/i.test(lower)) return "reflection"
  if (/\b(i think|i feel|i believe|imo|imho|in my opinion|personally)\b/i.test(lower)) return "opinion"

  const wordCount = trimmed.split(/\s+/).length
  if (wordCount <= 3 && !trimmed.includes(".") && !trimmed.includes("!")) return "entity"
  if (wordCount >= 4 && wordCount <= 25 && !trimmed.endsWith("?")) return "claim"
  if (wordCount > 25) return "narrative"

  return "general"
}
