import { useState, useRef, useEffect } from "react";
import {
  Send, ChevronDown, ChevronRight, Loader2, Settings, X, Save, Trash2, Plus,
  Sparkles, ArrowRight, FileText, BarChart3, Layers,
} from "lucide-react";
import gsap from "gsap";
import { streamChat, streamEval, getCollections, getSettings, saveSettings, savePreset, deletePreset, getModels } from "../api/client";
import type { Message, SSEChunk, EvalEntry, EvalResult } from "../api/client";
import { useWorkspace } from "../workspace/WorkspaceContext";

interface Source {
  text: string;
  metadata: Record<string, string>;
  score: number;
  collection: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

interface Preset {
  name: string;
  prompt: string;
}

const SUGGESTIONS = [
  { title: "Betreuer finden", text: "Ich suche einen Betreuer für meine Bachelorarbeit" },
  { title: "Forschung erkunden", text: "Welche Professoren forschen zu KI?" },
  { title: "Thema einordnen", text: "Ich möchte über Webentwicklung schreiben" },
];

export default function Chat() {
  const { workspaces, current: currentWorkspace, setWorkspace } = useWorkspace();
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<{ name: string; count: number }[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState<Record<number, boolean>>({});

  // Settings panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmBackend, setLlmBackend] = useState("ollama");
  const [models, setModels] = useState<string[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  // Evaluation panel
  const [evalOpen, setEvalOpen] = useState(false);
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalResults, setEvalResults] = useState<EvalResult[]>([]);
  const [evalProgress, setEvalProgress] = useState<{ current: number; total: number } | null>(null);
  const [evalAverage, setEvalAverage] = useState<number | null>(null);
  const [evalError, setEvalError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCollections().then((cols) => {
      setCollections(cols);
      if (cols.length > 0) setSelectedCollections(cols.map((c: { name: string }) => c.name));
    });
    loadSettings();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Hero-Entrance, sobald (und solange) der Leerzustand sichtbar ist
  useEffect(() => {
    if (messages.length > 0 || !heroRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo("[data-hero-kicker]", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
        .fromTo(
          "[data-hero-word]",
          { y: 38, opacity: 0, rotateX: -40 },
          { y: 0, opacity: 1, rotateX: 0, duration: 0.7, stagger: 0.08 },
          "-=0.35"
        )
        .fromTo("[data-hero-sub]", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.4")
        .fromTo(
          "[data-hero-card]",
          { y: 26, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, stagger: 0.09 },
          "-=0.35"
        );
    }, heroRef);
    return () => ctx.revert();
  }, [messages.length]);

  // Settings-Panel Slide-in
  useEffect(() => {
    if (panelOpen && panelRef.current) {
      gsap.fromTo(
        panelRef.current,
        { x: 48, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" }
      );
    }
  }, [panelOpen]);

  const loadSettings = async () => {
    const [s, m] = await Promise.all([getSettings(), getModels()]);
    setSystemPrompt(s.system_prompt ?? "");
    setLlmModel(s.llm_model ?? "");
    setLlmBackend(s.llm_backend ?? "ollama");
    setModels(m.models ?? []);
    setPresets(s.prompt_presets ?? []);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    await saveSettings({ system_prompt: systemPrompt, llm_model: llmModel, llm_backend: llmBackend });
    setSaving(false);
    flash("Gespeichert ✓");
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    const updated = await savePreset(newPresetName.trim(), systemPrompt);
    setPresets(updated.prompt_presets ?? []);
    setNewPresetName("");
    flash("Preset gespeichert ✓");
  };

  const handleDeletePreset = async (name: string) => {
    const updated = await deletePreset(name);
    setPresets(updated.prompt_presets ?? []);
  };

  const handleLoadPreset = (preset: Preset) => {
    setSystemPrompt(preset.prompt);
    flash(`"${preset.name}" geladen`);
  };

  const flash = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(""), 2000);
  };

  const buildEvalEntries = (): EvalEntry[] => {
    const entries: EvalEntry[] = [];
    messages.forEach((msg, i) => {
      if (msg.role !== "assistant" || !msg.content) return;
      const userMsg = [...messages.slice(0, i)].reverse().find((m) => m.role === "user");
      if (!userMsg) return;
      entries.push({
        id: `q${entries.length + 1}`,
        question: userMsg.content,
        answer: msg.content,
        contexts: msg.sources?.map((s) => s.text) ?? [],
      });
    });
    return entries;
  };

  const handleRunEval = async () => {
    const entries = buildEvalEntries();
    if (entries.length === 0 || evalRunning) return;

    setPanelOpen(false);
    setEvalOpen(true);
    setEvalRunning(true);
    setEvalResults([]);
    setEvalAverage(null);
    setEvalError("");
    setEvalProgress({ current: 0, total: entries.length });

    try {
      for await (const chunk of streamEval(entries, llmModel || undefined)) {
        if (chunk.event === "progress") {
          setEvalProgress({ current: chunk.current, total: chunk.total });
        } else if (chunk.event === "result") {
          setEvalResults((prev) => [...prev, chunk.result]);
        } else if (chunk.event === "done") {
          setEvalAverage(chunk.average_score);
        }
      }
    } catch {
      setEvalError("Evaluation fehlgeschlagen. Läuft das Backend?");
    } finally {
      setEvalRunning(false);
      setEvalProgress(null);
    }
  };

  const toggleCollection = (name: string) => {
    setSelectedCollections((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setLoading(true);

    const assistantIdx = allMessages.length;
    setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

    try {
      const apiMessages: Message[] = allMessages.map((m) => ({ role: m.role, content: m.content }));
      for await (const chunk of streamChat({
        messages: apiMessages,
        collections: selectedCollections,
        llm_model: llmModel || undefined,
        llm_backend: llmBackend || undefined,
      })) {
        const c = chunk as SSEChunk;
        if (c.event === "sources") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIdx] = { ...updated[assistantIdx], sources: c.sources };
            return updated;
          });
        } else if (c.event === "token") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIdx] = {
              ...updated[assistantIdx],
              content: updated[assistantIdx].content + c.token,
            };
            return updated;
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = {
          ...updated[assistantIdx],
          content: "Fehler bei der Verbindung zum Backend. Bitte prüfe ob der Server läuft.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full overflow-hidden gap-3">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar: collections + settings toggle */}
        <div className="flex-shrink-0 glass rounded-2xl px-4 py-2.5 flex items-center gap-2.5 flex-wrap">
          {/* Workspace switcher */}
          {workspaces.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setWsDropdownOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                  wsDropdownOpen
                    ? "bg-bht-accent/[0.14] text-bht-accent-soft border-bht-accent/30 shadow-glow-sm"
                    : "bg-white/[0.04] text-bht-cream/60 border-white/[0.06] hover:border-white/15 hover:text-bht-cream"
                }`}
              >
                <Layers size={11} />
                <span>{currentWorkspace?.label ?? "Bereich"}</span>
                <ChevronDown size={11} className={`transition-transform duration-200 ${wsDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {wsDropdownOpen && (
                <div className="absolute top-full mt-2 left-0 z-50 glass-deep rounded-xl overflow-hidden border border-white/[0.08] shadow-xl min-w-[180px]">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => { setWorkspace(ws.id); setWsDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-all duration-150 flex items-center gap-2.5 ${
                        currentWorkspace?.id === ws.id
                          ? "text-bht-accent bg-bht-accent/[0.1]"
                          : "text-bht-cream/60 hover:text-bht-cream hover:bg-white/[0.05]"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: ws.accent }}
                      />
                      <div>
                        <div className="font-medium">{ws.label}</div>
                        <div className="text-[10px] opacity-50 mt-0.5">{ws.subtitle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="w-px h-3.5 bg-white/[0.08]" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/35 font-semibold">
            Wissensbasis
          </span>
          {collections.map((col) => {
            const active = selectedCollections.includes(col.name);
            return (
              <button
                key={col.name}
                onClick={() => toggleCollection(col.name)}
                className={`group flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                  active
                    ? "bg-bht-accent/[0.14] text-bht-accent-soft border-bht-accent/30 shadow-glow-sm"
                    : "bg-white/[0.04] text-bht-cream/40 border-white/[0.06] hover:border-white/15 hover:text-bht-cream/70"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                    active ? "bg-bht-accent shadow-glow-sm" : "bg-bht-cream/20"
                  }`}
                />
                <span>{col.name}</span>
                <span className={`text-[10px] tabular-nums ${active ? "text-bht-accent/60" : "opacity-50"}`}>
                  {col.count}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => {
              if (evalOpen) { setEvalOpen(false); return; }
              if (evalResults.length > 0 || evalRunning) { setPanelOpen(false); setEvalOpen(true); return; }
              handleRunEval();
            }}
            disabled={!evalOpen && !evalRunning && evalResults.length === 0 && buildEvalEntries().length === 0}
            title="RAGAS-Evaluation der aktuellen Konversation"
            className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border disabled:opacity-30 disabled:cursor-not-allowed ${
              evalOpen
                ? "bg-bht-accent/[0.14] text-bht-accent-soft border-bht-accent/30 shadow-glow-sm"
                : "bg-white/[0.04] text-bht-cream/40 border-white/[0.06] hover:border-white/15 hover:text-bht-cream/70"
            }`}
          >
            {evalRunning ? <Loader2 size={12} className="animate-spin" /> : <BarChart3 size={12} />}
            Auswertung
          </button>
          <button
            onClick={() => { setEvalOpen(false); setPanelOpen((v) => !v); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
              panelOpen
                ? "bg-bht-accent/[0.14] text-bht-accent-soft border-bht-accent/30 shadow-glow-sm"
                : "bg-white/[0.04] text-bht-cream/40 border-white/[0.06] hover:border-white/15 hover:text-bht-cream/70"
            }`}
          >
            <Settings size={12} />
            Einstellungen
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-2 lg:px-6 py-6 space-y-7">
          {messages.length === 0 && (
            <div ref={heroRef} className="flex flex-col items-center justify-center h-full text-center gap-7 py-10" style={{ perspective: "800px" }}>
              <div data-hero-kicker className="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass text-[10px] uppercase tracking-[0.22em] text-bht-cream/50 font-semibold">
                <Sparkles size={11} className="text-bht-accent" />
                BHT · Fachbereich I · by Lucas Bruhn
              </div>

              <h1 className="font-display text-4xl lg:text-[56px] font-bold leading-[1.08] tracking-tight max-w-2xl">
                {"Finde die passende".split(" ").map((w) => (
                  <span key={w} data-hero-word className="inline-block mr-[0.28em]">{w}</span>
                ))}
                <br />
                <span data-hero-word className="inline-block text-ember">Betreuung.</span>
              </h1>

              <p data-hero-sub className="text-sm lg:text-base text-bht-cream/50 max-w-md leading-relaxed">
                Beschreibe dein Thema — ich durchsuche die Wissensbasis der BHT und
                schlage dir passende Betreuende für deine Abschlussarbeit vor.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 w-full max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    data-hero-card
                    onClick={() => { setInput(s.text); textareaRef.current?.focus(); }}
                    className="group glass rounded-2xl p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-glow-sm hover:border-bht-accent/25"
                  >
                    <p className="font-display text-[13px] font-semibold text-bht-cream/85 mb-1.5 flex items-center justify-between">
                      {s.title}
                      <ArrowRight size={13} className="text-bht-accent opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                    </p>
                    <p className="text-xs text-bht-cream/40 leading-relaxed">{s.text}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex animate-msg-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl w-full ${msg.role === "user" ? "pl-14" : "pr-10"}`}>
                {msg.role === "user" ? (
                  <div className="relative ml-auto w-fit max-w-full bg-gradient-to-br from-bht-accent/[0.22] to-bht-accent-deep/[0.12] border border-bht-accent/25 rounded-2xl rounded-br-md px-4 py-3 text-sm text-bht-cream shadow-inner-hl">
                    {msg.content}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="relative w-7 h-7 rounded-full btn-ember flex items-center justify-center flex-shrink-0">
                        <Sparkles size={12} />
                        {loading && i === messages.length - 1 && (
                          <span className="absolute inset-0 rounded-full animate-pulse-ring" />
                        )}
                      </div>
                      <span className="font-display text-xs text-bht-cream/45 font-medium tracking-wide">
                        Betreuer-Assistent
                      </span>
                    </div>

                    <div className="glass rounded-2xl rounded-tl-md px-5 py-4 text-sm text-bht-cream/90">
                      {msg.content ? (
                        <div
                          className={`prose-chat ${loading && i === messages.length - 1 ? "stream-caret" : ""}`}
                          dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                        />
                      ) : (
                        <div className="flex items-center gap-2.5 text-bht-cream/40 text-xs py-0.5">
                          <span className="flex gap-1">
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                className="w-1.5 h-1.5 rounded-full bg-bht-accent animate-bounce"
                                style={{ animationDelay: `${d * 0.15}s`, animationDuration: "0.9s" }}
                              />
                            ))}
                          </span>
                          Durchsuche Wissensbasis …
                        </div>
                      )}
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2.5">
                        <button
                          onClick={() => setSourcesOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                          className="flex items-center gap-1.5 text-xs text-bht-cream/35 hover:text-bht-accent-soft transition-colors"
                        >
                          {sourcesOpen[i] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          {msg.sources.length} Quellen verwendet
                        </button>
                        {sourcesOpen[i] && (
                          <div className="mt-2.5 grid gap-2">
                            {msg.sources.map((src, j) => (
                              <div
                                key={j}
                                className="glass rounded-xl px-3.5 py-2.5 animate-fade-up"
                                style={{ animationDelay: `${j * 0.05}s` }}
                              >
                                <div className="flex items-center gap-2 mb-1.5">
                                  <FileText size={11} className="text-bht-accent/70 flex-shrink-0" />
                                  <span className="text-[10px] font-semibold text-bht-accent/80 uppercase tracking-wider">
                                    {src.collection}
                                  </span>
                                  {src.metadata?.source_url ? (
                                    <a
                                      href={src.metadata.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-bht-cream/40 hover:text-bht-accent-soft underline decoration-bht-cream/20 underline-offset-2 truncate transition-colors"
                                      title={`Quelle öffnen: ${src.metadata.source_url}`}
                                    >
                                      {src.metadata?.source_file}
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-bht-cream/30 truncate">
                                      {src.metadata?.source_file}
                                    </span>
                                  )}
                                  {src.metadata?.scraped_at && (
                                    <span className="text-[10px] text-bht-cream/25 flex-shrink-0">
                                      Stand {src.metadata.scraped_at}
                                    </span>
                                  )}
                                  {src.metadata?.llm_enriched === "ja" && (
                                    <span
                                      className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-bht-accent/[0.12] text-bht-accent-soft border border-bht-accent/25 flex-shrink-0"
                                      title="Forschungsinfos wurden per lokalem LLM von der verlinkten Homepage extrahiert"
                                    >
                                      KI-extrahiert
                                    </span>
                                  )}
                                  <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                                    <div className="w-12 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-gradient-to-r from-bht-accent-deep to-bht-accent-soft"
                                        style={{ width: `${Math.round(src.score * 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-bht-cream/35 tabular-nums">
                                      {(src.score * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                                <p className="text-xs text-bht-cream/45 line-clamp-2 leading-relaxed">{src.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 pb-1 px-2 lg:px-6">
          <div className="field glass flex items-end gap-3 rounded-2xl px-4 py-3 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Beschreibe dein Thema oder stelle eine Frage..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-bht-cream placeholder-bht-cream/30 resize-none outline-none border-none leading-relaxed max-h-32"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              className="btn-ember flex-shrink-0 w-9 h-9 rounded-xl disabled:opacity-30 disabled:shadow-none flex items-center justify-center"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-center text-[10px] text-bht-cream/20 mt-2">
            Enter zum Senden · Shift+Enter für neue Zeile
          </p>
        </div>
      </div>

      {/* Evaluation side panel */}
      {evalOpen && (
        <div className="w-80 flex-shrink-0 glass-deep rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="font-display text-sm font-semibold text-bht-cream tracking-tight flex items-center gap-2">
              <BarChart3 size={14} className="text-bht-accent" />
              RAGAS-Auswertung
            </span>
            <button
              onClick={() => setEvalOpen(false)}
              className="p-1 rounded-lg text-bht-cream/40 hover:text-bht-cream hover:bg-white/[0.06] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
          <div className="hairline mx-4" />

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {evalError && <p className="text-xs text-red-400">{evalError}</p>}

            {evalRunning && evalProgress && (
              <div className="glass rounded-xl px-3.5 py-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-bht-cream/60">
                  <Loader2 size={12} className="animate-spin text-bht-accent" />
                  Bewerte Paar {evalProgress.current} / {evalProgress.total} …
                </div>
                <div className="w-full h-1 rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-bht-accent-deep to-bht-accent-soft transition-all duration-500"
                    style={{ width: `${(evalProgress.current / Math.max(evalProgress.total, 1)) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-bht-cream/30 leading-relaxed">
                  Der Judge (LLM) bewertet jede Antwort — das kann pro Paar etwas dauern.
                </p>
              </div>
            )}

            {evalAverage !== null && (
              <div className="glass rounded-xl px-3.5 py-3 text-center">
                <p className="text-[10px] uppercase tracking-[0.18em] text-bht-cream/40 font-semibold mb-1">
                  Gesamt-Score
                </p>
                <p className="font-display text-3xl font-bold text-ember tabular-nums">
                  {(evalAverage * 100).toFixed(0)}%
                </p>
              </div>
            )}

            {evalResults.map((r) => (
              <div key={r.id} className="glass rounded-xl px-3.5 py-3 space-y-2.5 animate-fade-up">
                <p className="text-xs text-bht-cream/70 line-clamp-2 leading-relaxed">
                  <span className="text-bht-accent/80 font-semibold mr-1.5">{r.id}</span>
                  {r.question}
                </p>
                {r.error ? (
                  <p className="text-[10px] text-red-400 leading-relaxed">{r.error}</p>
                ) : (
                  <div className="space-y-1.5">
                    <ScoreBar label="Answer Relevancy" value={r.answer_relevancy} />
                    <ScoreBar label="Faithfulness" value={r.faithfulness} />
                  </div>
                )}
              </div>
            ))}

            {!evalRunning && evalResults.length === 0 && !evalError && (
              <p className="text-xs text-bht-cream/40 leading-relaxed">
                Noch keine Ergebnisse. Starte die Auswertung, sobald mindestens eine Antwort im Chat vorliegt.
              </p>
            )}
          </div>

          <div className="flex-shrink-0 p-4">
            <div className="hairline mb-3" />
            <button
              onClick={handleRunEval}
              disabled={evalRunning || buildEvalEntries().length === 0}
              className="btn-ember w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl disabled:opacity-40"
            >
              {evalRunning ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />}
              {evalResults.length > 0 ? "Neu auswerten" : "Auswertung starten"}
            </button>
          </div>
        </div>
      )}

      {/* Settings side panel */}
      {panelOpen && (
        <div ref={panelRef} className="w-80 flex-shrink-0 glass-deep rounded-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="font-display text-sm font-semibold text-bht-cream tracking-tight">Einstellungen</span>
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1 rounded-lg text-bht-cream/40 hover:text-bht-cream hover:bg-white/[0.06] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
          <div className="hairline mx-4" />

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Model */}
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-semibold text-bht-cream/40 uppercase tracking-[0.18em]">Modell</h3>
              <div className="space-y-2">
                <select
                  value={llmBackend}
                  onChange={(e) => setLlmBackend(e.target.value)}
                  className="field w-full px-3 py-2 text-xs"
                >
                  <option value="ollama">Ollama (lokal)</option>
                  <option value="openai">OpenAI (API)</option>
                </select>
                {models.length > 0 ? (
                  <select
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    className="field w-full px-3 py-2 text-xs"
                  >
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    value={llmModel}
                    onChange={(e) => setLlmModel(e.target.value)}
                    placeholder="z.B. llama3"
                    className="field w-full px-3 py-2 text-xs"
                  />
                )}
              </div>
            </div>

            {/* Prompt Presets */}
            {presets.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-semibold text-bht-cream/40 uppercase tracking-[0.18em]">
                  Gespeicherte Presets
                </h3>
                <div className="space-y-1.5">
                  {presets.map((p) => (
                    <div key={p.name} className="flex items-center gap-2 group">
                      <button
                        onClick={() => handleLoadPreset(p)}
                        className="flex-1 text-left px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-bht-accent/[0.1] border border-white/[0.07] hover:border-bht-accent/30 text-xs text-bht-cream/70 hover:text-bht-cream transition-all truncate"
                      >
                        {p.name}
                      </button>
                      <button
                        onClick={() => handleDeletePreset(p.name)}
                        className="opacity-0 group-hover:opacity-100 text-bht-cream/30 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* System Prompt */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-semibold text-bht-cream/40 uppercase tracking-[0.18em]">
                  System-Prompt
                </h3>
                <span className="text-[10px] text-bht-cream/25 tabular-nums">{systemPrompt.length} Z.</span>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={10}
                className="field w-full px-3 py-2.5 text-xs text-bht-cream/80 resize-y font-mono leading-relaxed"
              />

              {/* Save as preset */}
              <div className="flex gap-2">
                <input
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Preset-Name..."
                  onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                  className="field flex-1 px-3 py-1.5 text-xs"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!newPresetName.trim()}
                  title="Als Preset speichern"
                  className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-bht-cream/50 hover:text-bht-accent hover:border-bht-accent/30 disabled:opacity-30 transition-all"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Save + status */}
          <div className="flex-shrink-0 p-4 space-y-2">
            <div className="hairline mb-3" />
            {savedMsg && (
              <p className="text-xs text-bht-accent text-center animate-fade-up">{savedMsg}</p>
            )}
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="btn-ember w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Einstellungen speichern
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-bht-cream/40 w-28 flex-shrink-0">{label}</span>
      {value === null ? (
        <span className="text-[10px] text-bht-cream/25">—</span>
      ) : (
        <>
          <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-bht-accent-deep to-bht-accent-soft"
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-bht-cream/55 tabular-nums w-8 text-right">
            {(value * 100).toFixed(0)}%
          </span>
        </>
      )}
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}
