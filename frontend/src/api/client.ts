const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

// Aktiver Bereich (Workspace) – wird vom WorkspaceContext gesetzt und an alle
// bereichs-abhängigen Requests angehängt.
let currentWorkspace = "g02";

export function setApiWorkspace(id: string) {
  currentWorkspace = id;
}

/** Hängt ?workspace=<id> (plus optionale weitere Params) an einen Pfad an. */
function ws(path: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ workspace: currentWorkspace, ...(extra ?? {}) });
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE}${path}${sep}${params}`;
}

export async function getWorkspaces() {
  const res = await fetch(`${BASE}/api/workspaces`);
  return res.json();
}

export async function getCollections() {
  const res = await fetch(ws("/api/collections"));
  return res.json();
}

export async function createCollection(name: string) {
  const res = await fetch(ws("/api/collections"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteCollection(name: string) {
  const res = await fetch(ws(`/api/collections/${encodeURIComponent(name)}`), { method: "DELETE" });
  return res.json();
}

export async function getCollectionFiles(name: string) {
  const res = await fetch(ws(`/api/collections/${encodeURIComponent(name)}/files`));
  return res.json();
}

export async function deleteFile(collection: string, file: string) {
  const res = await fetch(
    ws(`/api/collections/${encodeURIComponent(collection)}/files/${encodeURIComponent(file)}`),
    { method: "DELETE" }
  );
  return res.json();
}

export interface Chunk {
  id: string;
  text: string;
  metadata: Record<string, string | number>;
}

export interface ChunkPage {
  collection: string;
  total: number;
  offset: number;
  limit: number;
  chunks: Chunk[];
}

export async function getCollectionChunks(
  name: string,
  opts: { file?: string; limit?: number; offset?: number } = {}
): Promise<ChunkPage> {
  const extra: Record<string, string> = {
    limit: String(opts.limit ?? 25),
    offset: String(opts.offset ?? 0),
  };
  if (opts.file) extra.file = opts.file;
  const res = await fetch(ws(`/api/collections/${encodeURIComponent(name)}/chunks`, extra));
  if (!res.ok) throw new Error("Chunks konnten nicht geladen werden");
  return res.json();
}

export interface ChatAttachment {
  name: string;
  text: string;
  truncated?: boolean;
}

export async function parseAttachment(file: File): Promise<ChatAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/chat/parse`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Datei konnte nicht gelesen werden");
  }
  return res.json();
}

export async function getModels() {
  const res = await fetch(`${BASE}/api/models`);
  return res.json();
}

export async function getSettings() {
  const res = await fetch(ws("/api/settings"));
  return res.json();
}

export async function saveSettings(data: Record<string, string>) {
  const res = await fetch(ws("/api/settings"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  collections: string[];
  workspace?: string;
  attachments?: ChatAttachment[];
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
    body: JSON.stringify({ workspace: currentWorkspace, ...req }),
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
  form.append("workspace", currentWorkspace);
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
