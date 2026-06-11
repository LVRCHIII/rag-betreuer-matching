import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, FileText, ChevronRight, Loader2, Database } from "lucide-react";
import gsap from "gsap";
import { getCollections, createCollection, deleteCollection, getCollectionFiles, deleteFile } from "../api/client";

interface Collection {
  name: string;
  count: number;
}

export default function Collections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const pageRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const cols = await getCollections();
      setCollections(cols);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (loading || !pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-reveal]",
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: "power3.out" }
      );
    }, pageRef);
    return () => ctx.revert();
  }, [loading]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await createCollection(newName.trim());
    setNewName("");
    setCreating(false);
    load();
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Collection "${name}" wirklich löschen?`)) return;
    await deleteCollection(name);
    load();
  };

  const toggleExpand = async (name: string) => {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!files[name]) {
      const res = await getCollectionFiles(name);
      setFiles((prev) => ({ ...prev, [name]: res.files }));
    }
  };

  const handleDeleteFile = async (collection: string, file: string) => {
    await deleteFile(collection, file);
    const res = await getCollectionFiles(collection);
    setFiles((prev) => ({ ...prev, [collection]: res.files }));
    load();
  };

  const totalChunks = collections.reduce((sum, c) => sum + c.count, 0);

  return (
    <div ref={pageRef} className="h-full overflow-y-auto p-6 lg:p-10">
      <div className="max-w-2xl mx-auto space-y-7">
        <div data-reveal>
          <p className="text-[10px] uppercase tracking-[0.22em] text-bht-accent/70 font-semibold mb-2">
            Wissensbasis
          </p>
          <h1 className="font-display text-3xl font-bold text-bht-cream tracking-tight">Collections</h1>
          <p className="text-sm text-bht-cream/45 mt-1.5">
            {collections.length > 0
              ? `${collections.length} Collection${collections.length !== 1 ? "s" : ""} · ${totalChunks.toLocaleString("de-DE")} Chunks indexiert`
              : "Wissensdatenbanken verwalten"}
          </p>
        </div>

        {/* Create */}
        <div data-reveal className="flex gap-2.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Neue Collection..."
            className="field flex-1 px-4 py-2.5 text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="btn-ember flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40 disabled:shadow-none"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Erstellen
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-bht-cream/30">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <div data-reveal className="glass rounded-2xl flex flex-col items-center py-16 gap-3 text-bht-cream/30">
            <Database size={30} className="opacity-40" />
            <p className="text-sm">Noch keine Collections vorhanden</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {collections.map((col) => (
              <div
                key={col.name}
                data-reveal
                className={`glass rounded-2xl overflow-hidden transition-all duration-300 ${
                  expanded === col.name ? "border-bht-accent/25 shadow-glow-sm" : "hover:border-white/15"
                }`}
              >
                <div className="flex items-center px-4 py-3.5">
                  <button
                    onClick={() => toggleExpand(col.name)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <ChevronRight
                      size={14}
                      className={`text-bht-cream/40 transition-transform duration-300 flex-shrink-0 ${
                        expanded === col.name ? "rotate-90 text-bht-accent" : ""
                      }`}
                    />
                    <div className="w-8 h-8 rounded-xl bg-bht-accent/[0.12] border border-bht-accent/20 flex items-center justify-center flex-shrink-0">
                      <Database size={13} className="text-bht-accent" />
                    </div>
                    <span className="font-display text-sm font-semibold text-bht-cream truncate">{col.name}</span>
                    <span className="text-xs text-bht-cream/35 tabular-nums flex-shrink-0">
                      {col.count.toLocaleString("de-DE")} Chunks
                    </span>
                  </button>
                  <button
                    onClick={() => handleDelete(col.name)}
                    className="p-1.5 rounded-lg text-bht-cream/30 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {expanded === col.name && (
                  <div className="px-4 pb-3.5 animate-fade-up">
                    <div className="hairline mb-3" />
                    <div className="space-y-1.5">
                      {!files[col.name] ? (
                        <Loader2 size={14} className="animate-spin text-bht-cream/30 mx-auto" />
                      ) : files[col.name].length === 0 ? (
                        <p className="text-xs text-bht-cream/30 text-center py-2">Keine Dateien</p>
                      ) : (
                        files[col.name].map((file) => (
                          <div
                            key={file}
                            className="flex items-center gap-2.5 group rounded-lg px-2 py-1.5 hover:bg-white/[0.04] transition-colors"
                          >
                            <FileText size={12} className="text-bht-accent/50 flex-shrink-0" />
                            <span className="text-xs text-bht-cream/60 flex-1 truncate">{file}</span>
                            <button
                              onClick={() => handleDeleteFile(col.name, file)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded text-bht-cream/30 hover:text-red-400 transition-all"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
