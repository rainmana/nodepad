use serde::{Deserialize, Serialize};

// ── Content types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ContentType {
    Entity,
    Claim,
    Question,
    Task,
    Idea,
    Reference,
    Quote,
    Definition,
    Opinion,
    Reflection,
    Narrative,
    Comparison,
    Thesis,
    General,
}

impl Default for ContentType {
    fn default() -> Self {
        ContentType::General
    }
}

// ── Sub-task ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubTask {
    pub id: String,
    pub text: String,
    pub is_done: bool,
    pub timestamp: i64,
}

// ── Source citation ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub url: String,
    pub title: String,
    pub site_name: String,
}

// ── Block (tile) ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Block {
    pub id: String,
    pub text: String,
    pub timestamp: i64,
    #[serde(default)]
    pub content_type: ContentType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub annotation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<Source>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub influenced_by: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_unrelated: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_pinned: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sub_tasks: Option<Vec<SubTask>>,
    // Transient UI state — never persisted
    #[serde(skip)]
    #[allow(dead_code)]
    pub is_enriching: bool,
}

// ── Ghost note ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhostNote {
    pub id: String,
    pub text: String,
    pub category: String,
    pub is_generating: bool,
}

// ── Project ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub blocks: Vec<Block>,
    #[serde(default)]
    pub collapsed_ids: Vec<String>,
    #[serde(default)]
    pub ghost_notes: Vec<GhostNote>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_ghost_texts: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_ghost_block_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_ghost_timestamp: Option<i64>,
}

// ── Persisted store ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectsStore {
    pub projects: Vec<Project>,
    pub active_project_id: String,
}

// ── AI types ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AIConfig {
    pub api_key: String,
    pub model_id: String,
    pub provider: String, // "openrouter" | "openai"
    pub web_grounding: bool,
    pub custom_base_url: Option<String>,
}

impl AIConfig {
    pub fn base_url(&self) -> String {
        if let Some(ref custom) = self.custom_base_url {
            if !custom.is_empty() {
                return custom.clone();
            }
        }
        match self.provider.as_str() {
            "openai" => "https://api.openai.com/v1".to_string(),
            _ => "https://openrouter.ai/api/v1".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichContext {
    pub id: String,
    pub text: String,
    pub category: Option<String>,
    pub annotation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichResult {
    pub content_type: ContentType,
    pub category: String,
    pub annotation: String,
    pub confidence: Option<f64>,
    pub influenced_by_indices: Vec<usize>,
    pub is_unrelated: bool,
    pub merge_with_index: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<Source>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhostContext {
    pub text: String,
    pub category: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GhostResult {
    pub text: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UrlMeta {
    pub title: String,
    pub description: String,
    pub excerpt: String,
    pub status_code: u16,
}

// ── Export types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBlock {
    pub id: String,
    pub text: String,
    pub content_type: ContentType,
    pub category: Option<String>,
    pub annotation: Option<String>,
    pub confidence: Option<f64>,
    pub sources: Option<Vec<Source>>,
    pub is_pinned: Option<bool>,
    pub timestamp: Option<i64>,
}
