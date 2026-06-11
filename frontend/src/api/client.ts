const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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
