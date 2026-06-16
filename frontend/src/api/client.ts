// Standard: relative URLs — Anfragen laufen über den Vite-Proxy (vite.config.ts)
// zum Backend. Funktioniert dadurch auch von anderen Geräten (LAN/Tailscale).
const BASE = import.meta.env.VITE_API_URL ?? "";

export async function getCollections() {
  const res = await fetch(`${BASE}/api/collections`);
  return res.json();
}

export async function createCollection(name: string) {
  const res = await fetch(`${BASE}/api/collections`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteCollection(name: string) {
  const res = await fetch(`${BASE}/api/collections/${encodeURIComponent(name)}`, { method: "DELETE" });
  return res.json();
}

export async function getCollectionFiles(name: string) {
  const res = await fetch(`${BASE}/api/collections/${encodeURIComponent(name)}/files`);
  return res.json();
}

export async function deleteFile(collection: string, file: string) {
  const res = await fetch(
    `${BASE}/api/collections/${encodeURIComponent(collection)}/files/${encodeURIComponent(file)}`,
    { method: "DELETE" }
  );
  return res.json();
}

export async function getModels() {
  const res = await fetch(`${BASE}/api/models`);
  return res.json();
}

export async function getSettings() {
  const res = await fetch(`${BASE}/api/settings`);
  return res.json();
}

export async function saveSettings(data: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function savePreset(name: string, prompt: string) {
  const res = await fetch(`${BASE}/api/settings/presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, prompt }),
  });
  return res.json();
}

export async function deletePreset(name: string) {
  const res = await fetch(`${BASE}/api/settings/presets/${encodeURIComponent(name)}`, { method: "DELETE" });
  return res.json();
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  collections: string[];
  k?: number;
  similarity_threshold?: number;
  llm_model?: string;
  llm_backend?: string;
}

export type SSEChunk =
  | { event: "sources"; sources: Array<{ text: string; metadata: Record<string, string>; score: number; collection: string }> }
  | { event: "token"; token: string }
  | { event: "done" }
  | { event: "error"; message: string };

export async function* streamChat(req: ChatRequest): AsyncGenerator<SSEChunk> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok || !res.body) throw new Error("Chat-Anfrage fehlgeschlagen");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip malformed
        }
      }
    }
  }
}

export interface EvalEntry {
  id: string;
  question: string;
  answer: string;
  contexts: string[];
  ground_truth?: string;
}

export interface EvalResult {
  id: string;
  question: string;
  answer_relevancy: number | null;
  faithfulness: number | null;
  overall_score: number | null;
  error?: string;
}

export type EvalChunk =
  | { event: "status"; message: string; total: number }
  | { event: "progress"; current: number; total: number; id: string }
  | { event: "result"; result: EvalResult }
  | { event: "done"; results: EvalResult[]; average_score: number | null };

export async function* streamEval(entries: EvalEntry[], llmModel?: string): AsyncGenerator<EvalChunk> {
  const res = await fetch(`${BASE}/api/eval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries, llm_model: llmModel || undefined }),
  });

  if (!res.ok || !res.body) throw new Error("Evaluation fehlgeschlagen");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip malformed
        }
      }
    }
  }
}

export interface ScraperStatus {
  last_run?: string;
  collection?: string;
  enrich?: boolean;
  stats?: { professors: number; enriched: number; removed: number; errors: number; duration_s: number };
  error_details?: string[];
}

export type ScraperChunk =
  | { event: "status"; message: string; total?: number }
  | { event: "progress"; current: number; total: number; name: string; phase: "profil" | "ki" }
  | { event: "done"; message: string; professors: number; enriched: number; removed: number; errors: number; duration_s: number }
  | { event: "error"; message: string };

export async function getScraperStatus(): Promise<ScraperStatus> {
  const res = await fetch(`${BASE}/api/scraper/status`);
  return res.json();
}

export async function* streamScraper(opts: {
  collection: string;
  limit?: number;
  enrich: boolean;
  llm_model?: string;
}): AsyncGenerator<ScraperChunk> {
  const res = await fetch(`${BASE}/api/scraper/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });

  if (!res.ok || !res.body) throw new Error("Scraper-Lauf fehlgeschlagen");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip malformed
        }
      }
    }
  }
}

export async function* streamUpload(
  file: File,
  collection: string,
  chunkSize: number,
  chunkOverlap: number,
  datentyp: string,
  fachbereich: string,
): AsyncGenerator<{ event: string; message?: string; chunks?: number }> {
  const form = new FormData();
  form.append("file", file);
  form.append("collection", collection);
  form.append("chunk_size", String(chunkSize));
  form.append("chunk_overlap", String(chunkOverlap));
  form.append("datentyp", datentyp);
  form.append("fachbereich", fachbereich);

  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
  if (!res.ok || !res.body) throw new Error("Upload fehlgeschlagen");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // skip
        }
      }
    }
  }
}
