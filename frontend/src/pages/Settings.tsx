import { useState, useEffect, useRef } from "react";
import { Save, Loader2, RefreshCw, Globe, Sparkles, LayoutTemplate, Plus, X, RotateCcw } from "lucide-react";
import gsap from "gsap";
import { getSettings, saveSettings, getModels, getScraperStatus, streamScraper, updateWorkspaceTexts, resetWorkspaceTexts } from "../api/client";
import type { ScraperStatus } from "../api/client";
import { useWorkspace } from "../workspace/WorkspaceContext";

export default function Settings() {
  const { current: ws, refresh: refreshWorkspaces } = useWorkspace();
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmBackend, setLlmBackend] = useState("ollama");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  // Bereich-Darstellung (Texte des aktiven Bereichs)
  const [wsLabel, setWsLabel] = useState("");
  const [wsSubtitle, setWsSubtitle] = useState("");
  const [wsTitle, setWsTitle] = useState("");
  const [wsIntro, setWsIntro] = useState("");
  const [wsPlaceholder, setWsPlaceholder] = useState("");
  const [wsSuggestions, setWsSuggestions] = useState<string[]>([]);
  const [wsSaving, setWsSaving] = useState(false);
  const [wsSaved, setWsSaved] = useState(false);

  // Felder aus dem aktiven Bereich übernehmen, wenn er (neu) geladen ist
  useEffect(() => {
    if (!ws) return;
    setWsLabel(ws.label);
    setWsSubtitle(ws.subtitle);
    setWsTitle(ws.chat_title);
    setWsIntro(ws.chat_intro);
    setWsPlaceholder(ws.placeholder);
    setWsSuggestions(ws.suggestions.length ? ws.suggestions : [""]);
  }, [ws]);

  const handleSaveWorkspace = async () => {
    if (!ws) return;
    setWsSaving(true);
    try {
      await updateWorkspaceTexts(ws.id, {
        label: wsLabel,
        subtitle: wsSubtitle,
        chat_title: wsTitle,
        chat_intro: wsIntro,
        placeholder: wsPlaceholder,
        suggestions: wsSuggestions,
      });
      await refreshWorkspaces();
      setWsSaved(true);
      setTimeout(() => setWsSaved(false), 2000);
    } finally {
      setWsSaving(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (!ws) return;
    setWsSaving(true);
    try {
      await resetWorkspaceTexts(ws.id);
      await refreshWorkspaces();
    } finally {
      setWsSaving(false);
    }
  };

  // BHT-Scraper
  const [scraperStatus, setScraperStatus] = useState<ScraperStatus>({});
  const [scraperCollection, setScraperCollection] = useState("bht_professoren");
  const [scraperEnrich, setScraperEnrich] = useState(true);
  const [scraperRunning, setScraperRunning] = useState(false);
  const [scraperLog, setScraperLog] = useState("");
  const [scraperProgress, setScraperProgress] = useState<{ current: number; total: number } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([getSettings(), getModels()]);
      setSystemPrompt(s.system_prompt ?? "");
      setLlmModel(s.llm_model ?? "");
      setLlmBackend(s.llm_backend ?? "ollama");
      setEmbeddingModel(s.embedding_model ?? "");
      setModels(m.models ?? []);
      const sc = await getScraperStatus();
      setScraperStatus(sc);
      if (sc.collection) setScraperCollection(sc.collection);
      if (typeof sc.enrich === "boolean") setScraperEnrich(sc.enrich);
    } finally {
      setLoading(false);
    }
  };

  const handleRunScraper = async () => {
    if (scraperRunning || !scraperCollection.trim()) return;
    setScraperRunning(true);
    setScraperLog("Starte...");
    setScraperProgress(null);
    try {
      for await (const chunk of streamScraper({
        collection: scraperCollection.trim(),
        enrich: scraperEnrich,
        llm_model: llmModel || undefined,
      })) {
        if (chunk.event === "status") {
          setScraperLog(chunk.message);
        } else if (chunk.event === "progress") {
          setScraperProgress({ current: chunk.current, total: chunk.total });
          setScraperLog(
            chunk.phase === "ki"
              ? `KI-Anreicherung: ${chunk.name}`
              : `Profil ${chunk.current}/${chunk.total}: ${chunk.name}`
          );
        } else if (chunk.event === "done") {
          setScraperLog(chunk.message);
          setScraperProgress(null);
          setScraperStatus(await getScraperStatus());
        } else if (chunk.event === "error") {
          setScraperLog(`Fehler: ${chunk.message}`);
        }
      }
    } catch {
      setScraperLog("Verbindung zum Backend fehlgeschlagen.");
    } finally {
      setScraperRunning(false);
      setScraperProgress(null);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (loading || !pageRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-reveal]",
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.08, ease: "power3.out" }
      );
    }, pageRef);
    return () => ctx.revert();
  }, [loading]);

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
    <div ref={pageRef} className="h-full overflow-y-auto p-6 lg:p-10">
      <div className="max-w-2xl mx-auto space-y-7">
        <div data-reveal className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-bht-accent/70 font-semibold mb-2">
              Konfiguration
            </p>
            <h1 className="font-display text-3xl font-bold text-bht-cream tracking-tight">Einstellungen</h1>
            <p className="text-sm text-bht-cream/45 mt-1.5">Modell und System-Prompt konfigurieren</p>
          </div>
          <button
            onClick={load}
            className="p-2.5 rounded-xl glass text-bht-cream/40 hover:text-bht-accent transition-colors"
            title="Neu laden"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* LLM Config */}
        <div data-reveal className="glass rounded-2xl p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-bht-cream/85 tracking-tight">
            LLM-Konfiguration
          </h2>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Backend
              </label>
              <select
                value={llmBackend}
                onChange={(e) => setLlmBackend(e.target.value)}
                className="field w-full px-3 py-2 text-sm"
              >
                <option value="ollama">Ollama (lokal)</option>
                <option value="openai">OpenAI (API)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Modell
              </label>
              {models.length > 0 ? (
                <select
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="field w-full px-3 py-2 text-sm"
                >
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder="z.B. llama3"
                  className="field w-full px-3 py-2 text-sm"
                />
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
              Embedding-Modell
            </label>
            <input
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              className="field w-full px-3 py-2 text-sm"
            />
          </div>
          {models.length === 0 && (
            <p className="text-xs text-bht-cream/30">
              Keine Ollama-Modelle gefunden – läuft Ollama auf localhost:11434?
            </p>
          )}
        </div>

        {/* BHT Live-Daten (Scraper) */}
        <div data-reveal className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-bht-accent" />
            <h2 className="font-display text-sm font-semibold text-bht-cream/85 tracking-tight">
              BHT Live-Daten (Professoren-Scraper)
            </h2>
          </div>
          <p className="text-xs text-bht-cream/40 leading-relaxed">
            Liest das öffentliche Professuren-Verzeichnis der BHT (bht-berlin.de) und hält die
            Collection aktuell. Mit KI-Anreicherung extrahiert das lokale LLM zusätzlich
            Forschungsschwerpunkte von verlinkten Homepages — diese Inhalte werden in den Quellen
            als „KI-extrahiert" gekennzeichnet.
          </p>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Ziel-Collection
              </label>
              <input
                value={scraperCollection}
                onChange={(e) => setScraperCollection(e.target.value)}
                disabled={scraperRunning}
                className="field w-full px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                KI-Anreicherung
              </label>
              <button
                onClick={() => setScraperEnrich((v) => !v)}
                disabled={scraperRunning}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all ${
                  scraperEnrich
                    ? "bg-bht-accent/[0.14] text-bht-accent-soft border-bht-accent/30"
                    : "bg-white/[0.04] text-bht-cream/40 border-white/[0.08]"
                }`}
              >
                <Sparkles size={13} />
                {scraperEnrich ? "Aktiviert" : "Deaktiviert"}
              </button>
            </div>
          </div>

          {(scraperRunning || scraperLog) && (
            <div className="space-y-2">
              <p className="text-xs text-bht-cream/55 flex items-center gap-2">
                {scraperRunning && <Loader2 size={12} className="animate-spin text-bht-accent flex-shrink-0" />}
                <span className="truncate">{scraperLog}</span>
              </p>
              {scraperProgress && (
                <div className="w-full h-1 rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-bht-accent-deep to-bht-accent-soft transition-all duration-300"
                    style={{ width: `${(scraperProgress.current / Math.max(scraperProgress.total, 1)) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleRunScraper}
              disabled={scraperRunning || !scraperCollection.trim()}
              className="btn-ember flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl disabled:opacity-40"
            >
              {scraperRunning ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Jetzt aktualisieren
            </button>
            {scraperStatus.last_run && (
              <p className="text-[10px] text-bht-cream/30 text-right">
                Letzter Lauf: {new Date(scraperStatus.last_run).toLocaleString("de-DE")}
                {scraperStatus.stats &&
                  ` · ${scraperStatus.stats.professors} Profile, ${scraperStatus.stats.enriched} KI-angereichert`}
              </p>
            )}
          </div>
        </div>

        {/* Bereich-Darstellung */}
        {ws && (
          <div data-reveal className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <LayoutTemplate size={14} className="text-bht-accent" />
              <h2 className="font-display text-sm font-semibold text-bht-cream/85 tracking-tight">
                Darstellung — {ws.label}
              </h2>
              <span
                className="ml-1 w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: ws.accent }}
              />
            </div>
            <p className="text-xs text-bht-cream/40 leading-relaxed">
              Texte der Startseite dieses Bereichs. Änderungen sind sofort sichtbar und nur für „{ws.label}" gültig.
            </p>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                  Bereichsname
                </label>
                <input
                  value={wsLabel}
                  onChange={(e) => setWsLabel(e.target.value)}
                  className="field w-full px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                  Untertitel
                </label>
                <input
                  value={wsSubtitle}
                  onChange={(e) => setWsSubtitle(e.target.value)}
                  className="field w-full px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Große Überschrift
              </label>
              <input
                value={wsTitle}
                onChange={(e) => setWsTitle(e.target.value)}
                placeholder="z.B. Finde die passende Betreuung"
                className="field w-full px-3 py-2 text-sm"
              />
              <p className="text-[10px] text-bht-cream/30">
                Das letzte Wort wird als farbiges Akzentwort dargestellt.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Beschreibung
              </label>
              <textarea
                value={wsIntro}
                onChange={(e) => setWsIntro(e.target.value)}
                rows={2}
                className="field w-full px-3 py-2 text-sm resize-y leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Eingabe-Platzhalter
              </label>
              <input
                value={wsPlaceholder}
                onChange={(e) => setWsPlaceholder(e.target.value)}
                className="field w-full px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold">
                Vorschlags-Prompts
              </label>
              {wsSuggestions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={s}
                    onChange={(e) =>
                      setWsSuggestions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    placeholder={`Vorschlag ${i + 1}`}
                    className="field flex-1 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => setWsSuggestions((prev) => prev.filter((_, j) => j !== i))}
                    className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-bht-cream/40 hover:text-bht-accent hover:border-bht-accent/30 transition-colors flex-shrink-0"
                    title="Entfernen"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setWsSuggestions((prev) => [...prev, ""])}
                className="flex items-center gap-1.5 text-xs text-bht-cream/45 hover:text-bht-accent-soft transition-colors"
              >
                <Plus size={13} /> Vorschlag hinzufügen
              </button>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSaveWorkspace}
                disabled={wsSaving}
                className="btn-ember flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl disabled:opacity-40"
              >
                {wsSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {wsSaved ? "Gespeichert ✓" : "Texte speichern"}
              </button>
              <button
                onClick={handleResetWorkspace}
                disabled={wsSaving}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-bht-cream/45 hover:text-bht-accent rounded-xl transition-colors disabled:opacity-40"
                title="Auf Standardwerte zurücksetzen"
              >
                <RotateCcw size={13} /> Zurücksetzen
              </button>
            </div>
          </div>
        )}

        {/* System Prompt */}
        <div data-reveal className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-bht-cream/85 tracking-tight">
              System-Prompt
            </h2>
            <span className="text-xs text-bht-cream/30 tabular-nums">{systemPrompt.length} Zeichen</span>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={14}
            className="field w-full px-3.5 py-3 text-sm text-bht-cream/80 resize-y font-mono leading-relaxed"
          />
        </div>

        <div data-reveal>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-ember flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
