import { useState, useEffect } from "react";
import { Save, Loader2, RefreshCw } from "lucide-react";
import { getSettings, saveSettings, getModels } from "../api/client";

export default function Settings() {
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmBackend, setLlmBackend] = useState("ollama");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([getSettings(), getModels()]);
      setSystemPrompt(s.system_prompt ?? "");
      setLlmModel(s.llm_model ?? "");
      setLlmBackend(s.llm_backend ?? "ollama");
      setEmbeddingModel(s.embedding_model ?? "");
      setModels(m.models ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings({ system_prompt: systemPrompt, llm_model: llmModel, llm_backend: llmBackend, embedding_model: embeddingModel });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-bht-cream/30">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-bht-cream">Einstellungen</h1>
            <p className="text-sm text-bht-cream/50 mt-0.5">Modell und System-Prompt konfigurieren</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg text-bht-cream/40 hover:text-bht-cream hover:bg-white/5 transition-all">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* LLM Config */}
        <div className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-semibold text-bht-cream/80">LLM-Konfiguration</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-bht-cream/50 font-medium">Backend</label>
              <select
                value={llmBackend}
                onChange={(e) => setLlmBackend(e.target.value)}
                className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream outline-none focus:border-bht-accent/40"
              >
                <option value="ollama">Ollama (lokal)</option>
                <option value="openai">OpenAI (API)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-bht-cream/50 font-medium">Modell</label>
              {models.length > 0 ? (
                <select
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream outline-none focus:border-bht-accent/40"
                >
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="z.B. llama3"
                  className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream placeholder-bht-cream/25 outline-none focus:border-bht-accent/40"
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-bht-cream/50 font-medium">Embedding-Modell</label>
            <input
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-bht-cream outline-none focus:border-bht-accent/40"
            />
          </div>
          {models.length === 0 && (
            <p className="text-xs text-bht-cream/30">Keine Ollama-Modelle gefunden – läuft Ollama auf localhost:11434?</p>
          )}
        </div>

        {/* System Prompt */}
        <div className="bg-white/5 border border-white/8 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-bht-cream/80">System-Prompt</h2>
            <span className="text-xs text-bht-cream/30">{systemPrompt.length} Zeichen</span>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={14}
            className="w-full bg-bht-dark border border-white/10 rounded-lg px-3 py-2.5 text-sm text-bht-cream/80 placeholder-bht-cream/20 outline-none focus:border-bht-accent/40 transition-colors resize-y font-mono leading-relaxed"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-bht-accent text-bht-dark text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-bht-accent/80 active:scale-95 transition-all"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? "Gespeichert ✓" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
