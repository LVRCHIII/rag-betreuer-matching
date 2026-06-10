import { useState, useRef, useCallback, useEffect } from "react";
import { Upload as UploadIcon, FileText, CheckCircle, XCircle, Loader2, Plus } from "lucide-react";
import { getCollections, createCollection, streamUpload } from "../api/client";

interface UploadStatus {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  message: string;
  chunks?: number;
}

export default function Upload() {
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [chunkSize, setChunkSize] = useState(500);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [datentyp, setDatentyp] = useState("real");
  const [fachbereich, setFachbereich] = useState("");
  const [files, setFiles] = useState<UploadStatus[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCollections().then((cols: { name: string }[]) => {
      const names = cols.map((c) => c.name);
      setCollections(names);
      if (names.length > 0) setSelectedCollection(names[0]);
    });
  }, []);

  const handleCreateCollection = async () => {
    if (!newCollection.trim()) return;
    await createCollection(newCollection.trim());
    setCollections((prev) => [...prev, newCollection.trim()]);
    setSelectedCollection(newCollection.trim());
    setNewCollection("");
  };

  const addFiles = (dropped: FileList) => {
    const valid = Array.from(dropped).filter((f) =>
      [".pdf", ".xlsx", ".xls", ".docx", ".txt", ".csv"].some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    setFiles((prev) => [...prev, ...valid.map((f) => ({ file: f, status: "pending" as const, message: "Bereit" }))]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const target = newCollection.trim() || selectedCollection;

  const startUpload = async (idx: number) => {
    const item = files[idx];
    if (!target) return;

    setFiles((prev) => {
      const u = [...prev];
      u[idx] = { ...u[idx], status: "uploading", message: "Starte Upload..." };
      return u;
    });

    try {
      for await (const chunk of streamUpload(item.file, target, chunkSize, chunkOverlap, datentyp, fachbereich)) {
        if (chunk.event === "error") {
          setFiles((prev) => {
            const u = [...prev];
            u[idx] = { ...u[idx], status: "error", message: chunk.message ?? "Unbekannter Fehler" };
            return u;
          });
          return;
        }
        if (chunk.event === "done") {
          setFiles((prev) => {
            const u = [...prev];
            u[idx] = { ...u[idx], status: "done", message: chunk.message ?? "Fertig", chunks: chunk.chunks };
            return u;
          });
          return;
        }
        setFiles((prev) => {
          const u = [...prev];
          u[idx] = { ...u[idx], message: chunk.message ?? "" };
          return u;
        });
      }
    } catch (e) {
      setFiles((prev) => {
        const u = [...prev];
        u[idx] = { ...u[idx], status: "error", message: String(e) };
        return u;
      });
    }
  };

  const uploadAll = () => {
    files.forEach((f, i) => { if (f.status === "pending") startUpload(i); });
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-bht-cream">Dateien hochladen</h1>
          <p className="text-sm text-bht-cream/50 mt-0.5">PDF, XLSX, DOCX, TXT, CSV</p>
        </div>

        {/* Config */}
        <div className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-bht-cream/50 font-medium">Collection</label>
            <div className="flex gap-2">
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="flex-1 bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream outline-none focus:border-bht-accent/40"
              >
                {collections.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-1">
                <input
                  value={newCollection}
                  onChange={(e) => setNewCollection(e.target.value)}
                  placeholder="Neue Collection..."
                  className="bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream placeholder-bht-cream/25 outline-none focus:border-bht-accent/40"
                />
                <button onClick={handleCreateCollection} className="p-2 rounded-lg bg-bht-accent/20 text-bht-accent hover:bg-bht-accent/30 transition-colors">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-bht-cream/50 font-medium">Chunk-Größe (Zeichen)</label>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream outline-none focus:border-bht-accent/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-bht-cream/50 font-medium">Chunk-Overlap</label>
              <input
                type="number"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream outline-none focus:border-bht-accent/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-bht-cream/50 font-medium">Datentyp</label>
              <select
                value={datentyp}
                onChange={(e) => setDatentyp(e.target.value)}
                className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream outline-none focus:border-bht-accent/40"
              >
                <option value="real">Real</option>
                <option value="synthetisch">Synthetisch</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-bht-cream/50 font-medium">Fachbereich (optional)</label>
              <input
                value={fachbereich}
                onChange={(e) => setFachbereich(e.target.value)}
                placeholder="z.B. FB I"
                className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream placeholder-bht-cream/25 outline-none focus:border-bht-accent/40"
              />
            </div>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragging ? "border-bht-accent bg-bht-accent/5" : "border-white/10 hover:border-white/20 hover:bg-white/3"
          }`}
        >
          <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.docx,.txt,.csv" className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          <UploadIcon size={24} className={`mx-auto mb-3 ${dragging ? "text-bht-accent" : "text-bht-cream/30"}`} />
          <p className="text-sm text-bht-cream/50">Dateien hier ablegen oder <span className="text-bht-accent">auswählen</span></p>
          <p className="text-xs text-bht-cream/25 mt-1">PDF, XLSX, DOCX, TXT, CSV</p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bht-cream/60">{files.length} Datei{files.length !== 1 ? "en" : ""}</span>
              {pendingCount > 0 && (
                <button onClick={uploadAll} className="flex items-center gap-2 px-4 py-2 bg-bht-accent text-bht-dark text-sm font-medium rounded-xl hover:bg-bht-accent/80 active:scale-95 transition-all">
                  <UploadIcon size={13} />
                  Alle hochladen ({pendingCount})
                </button>
              )}
            </div>
            <div className="space-y-2">
              {files.map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-4 py-3">
                  <FileText size={15} className="text-bht-cream/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bht-cream truncate">{item.file.name}</p>
                    <p className="text-xs text-bht-cream/40 mt-0.5">{item.message}{item.chunks ? ` · ${item.chunks} Chunks` : ""}</p>
                  </div>
                  {item.status === "pending" && (
                    <button onClick={() => startUpload(i)} className="px-3 py-1.5 text-xs bg-bht-accent/20 text-bht-accent rounded-lg hover:bg-bht-accent/30 transition-colors">
                      Upload
                    </button>
                  )}
                  {item.status === "uploading" && <Loader2 size={16} className="animate-spin text-bht-accent flex-shrink-0" />}
                  {item.status === "done" && <CheckCircle size={16} className="text-green-400 flex-shrink-0" />}
                  {item.status === "error" && <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
