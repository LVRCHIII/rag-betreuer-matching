import { useState, useRef, useCallback, useEffect } from "react";
import { Upload as UploadIcon, FileText, CheckCircle, XCircle, Loader2, Plus } from "lucide-react";
import gsap from "gsap";
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
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCollections().then((cols: { name: string }[]) => {
      const names = cols.map((c) => c.name);
      setCollections(names);
      if (names.length > 0) setSelectedCollection(names[0]);
    });
  }, []);

  useEffect(() => {
    if (!pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-reveal]",
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: "power3.out" }
      );
    }, pageRef);
    return () => ctx.revert();
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
    <div ref={pageRef} className="h-full overflow-y-auto p-6 lg:p-10">
      <div className="max-w-2xl mx-auto space-y-7">
        <div data-reveal>
          <p className="text-[10px] uppercase tracking-[0.22em] text-bht-accent/70 font-semibold mb-2">
            Ingestion
          </p>
          <h1 className="font-display text-3xl font-bold text-bht-cream tracking-tight">Dateien hochladen</h1>
          <p className="text-sm text-bht-cream/45 mt-1.5">PDF, XLSX, DOCX, TXT, CSV</p>
        </div>

        {/* Config */}
        <div data-reveal className="glass rounded-2xl p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
              Collection
            </label>
            <div className="flex gap-2">
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="field flex-1 px-3 py-2 text-sm"
              >
                {collections.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div className="flex gap-1.5">
                <input
                  value={newCollection}
                  onChange={(e) => setNewCollection(e.target.value)}
                  placeholder="Neue Collection..."
                  className="field px-3 py-2 text-sm w-44"
                />
                <button
                  onClick={handleCreateCollection}
                  className="p-2 rounded-xl bg-bht-accent/[0.15] border border-bht-accent/25 text-bht-accent hover:bg-bht-accent/25 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Chunk-Größe (Zeichen)
              </label>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="field w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Chunk-Overlap
              </label>
              <input
                type="number"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="field w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Datentyp
              </label>
              <select
                value={datentyp}
                onChange={(e) => setDatentyp(e.target.value)}
                className="field w-full px-3 py-2 text-sm"
              >
                <option value="real">Real</option>
                <option value="synthetisch">Synthetisch</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Fachbereich (optional)
              </label>
              <input
                value={fachbereich}
                onChange={(e) => setFachbereich(e.target.value)}
                placeholder="z.B. FB I"
                className="field w-full px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          data-reveal
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`relative rounded-[20px] p-12 text-center cursor-pointer transition-all duration-300 border-2 border-dashed ${
            dragging
              ? "border-bht-accent bg-bht-accent/[0.07] shadow-glow scale-[1.01]"
              : "border-white/12 hover:border-bht-accent/40 hover:bg-white/[0.03]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.xlsx,.xls,.docx,.txt,.csv"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <div
            className={`mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              dragging ? "btn-ember scale-110" : "bg-bht-accent/[0.12] border border-bht-accent/20"
            }`}
          >
            <UploadIcon size={22} className={dragging ? "" : "text-bht-accent"} />
          </div>
          <p className="font-display text-sm font-semibold text-bht-cream/75">
            Dateien hier ablegen oder <span className="text-ember">auswählen</span>
          </p>
          <p className="text-xs text-bht-cream/30 mt-1.5">PDF, XLSX, DOCX, TXT, CSV</p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-bht-cream/55">
                {files.length} Datei{files.length !== 1 ? "en" : ""}
              </span>
              {pendingCount > 0 && (
                <button
                  onClick={uploadAll}
                  className="btn-ember flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl"
                >
                  <UploadIcon size={13} />
                  Alle hochladen ({pendingCount})
                </button>
              )}
            </div>
            <div className="space-y-2">
              {files.map((item, i) => (
                <div
                  key={i}
                  className={`glass flex items-center gap-3.5 rounded-2xl px-4 py-3 animate-fade-up transition-colors duration-300 ${
                    item.status === "done" ? "border-emerald-400/25" : item.status === "error" ? "border-red-400/25" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-bht-accent/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bht-cream truncate">{item.file.name}</p>
                    <p className="text-xs text-bht-cream/40 mt-0.5 truncate">
                      {item.message}{item.chunks ? ` · ${item.chunks} Chunks` : ""}
                    </p>
                  </div>
                  {item.status === "pending" && (
                    <button
                      onClick={() => startUpload(i)}
                      className="px-3.5 py-1.5 text-xs font-medium bg-bht-accent/[0.15] border border-bht-accent/25 text-bht-accent rounded-lg hover:bg-bht-accent/25 transition-colors flex-shrink-0"
                    >
                      Upload
                    </button>
                  )}
                  {item.status === "uploading" && (
                    <Loader2 size={16} className="animate-spin text-bht-accent flex-shrink-0" />
                  )}
                  {item.status === "done" && <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />}
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
