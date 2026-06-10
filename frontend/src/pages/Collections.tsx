import { useState, useEffect } from "react";
import { Plus, Trash2, FileText, ChevronRight, Loader2, Database } from "lucide-react";
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

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-bht-cream">Collections</h1>
          <p className="text-sm text-bht-cream/50 mt-0.5">Wissensdatenbanken verwalten</p>
        </div>

        {/* Create */}
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Neue Collection..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-bht-cream placeholder-bht-cream/30 outline-none focus:border-bht-accent/40 transition-colors"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="flex items-center gap-2 px-4 py-2.5 bg-bht-accent text-bht-dark text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-bht-accent/80 active:scale-95 transition-all"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Erstellen
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-bht-cream/30">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-bht-cream/30">
            <Database size={32} className="opacity-40" />
            <p className="text-sm">Noch keine Collections vorhanden</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collections.map((col) => (
              <div key={col.name} className="bg-white/5 border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center px-4 py-3">
                  <button
                    onClick={() => toggleExpand(col.name)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <ChevronRight
                      size={14}
                      className={`text-bht-cream/40 transition-transform ${expanded === col.name ? "rotate-90" : ""}`}
                    />
                    <span className="text-sm font-medium text-bht-cream">{col.name}</span>
                    <span className="text-xs text-bht-cream/40 ml-1">{col.count} Chunks</span>
                  </button>
                  <button
                    onClick={() => handleDelete(col.name)}
                    className="p-1.5 rounded-lg text-bht-cream/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {expanded === col.name && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-1.5">
                    {!files[col.name] ? (
                      <Loader2 size={14} className="animate-spin text-bht-cream/30 mx-auto" />
                    ) : files[col.name].length === 0 ? (
                      <p className="text-xs text-bht-cream/30 text-center py-2">Keine Dateien</p>
                    ) : (
                      files[col.name].map((file) => (
                        <div key={file} className="flex items-center gap-2 group">
                          <FileText size={12} className="text-bht-cream/30 flex-shrink-0" />
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
