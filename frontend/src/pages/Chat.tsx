import { useState, useRef, useEffect } from "react";
import { Send, ChevronDown, ChevronRight, BookOpen, Loader2 } from "lucide-react";
import { streamChat, getCollections } from "../api/client";
import type { Message, SSEChunk } from "../api/client";

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

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<{ name: string; count: number }[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getCollections().then((cols) => {
      setCollections(cols);
      if (cols.length > 0) setSelectedCollections(cols.map((c: { name: string }) => c.name));
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      for await (const chunk of streamChat({ messages: apiMessages, collections: selectedCollections })) {
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
    } catch (e) {
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
    <div className="flex flex-col h-full">
      {/* Collection selector */}
      {collections.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/5 bg-[#0d1f27]/50 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-bht-cream/40 font-medium">Collections:</span>
          {collections.map((col) => (
            <button
              key={col.name}
              onClick={() => toggleCollection(col.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                selectedCollections.includes(col.name)
                  ? "bg-bht-accent/20 text-bht-accent border border-bht-accent/30"
                  : "bg-white/5 text-bht-cream/40 border border-transparent hover:border-white/10"
              }`}
            >
              <span>{col.name}</span>
              <span className="opacity-60">({col.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-16">
            <div className="w-12 h-12 rounded-2xl bg-bht-accent/15 flex items-center justify-center">
              <BookOpen size={22} className="text-bht-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-bht-cream mb-1">Betreuer-Matching</h2>
              <p className="text-sm text-bht-cream/50 max-w-sm">
                Beschreibe dein Thema und ich helfe dir, geeignete Betreuende für deine Abschlussarbeit zu finden.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["Ich suche einen Betreuer für meine Bachelorarbeit", "Welche Professoren forschen zu KI?", "Ich möchte über Webentwicklung schreiben"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 text-bht-cream/60 hover:bg-white/10 hover:text-bht-cream transition-all border border-white/5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-2xl w-full ${msg.role === "user" ? "pl-12" : "pr-12"}`}>
              {msg.role === "user" ? (
                <div className="bg-bht-accent/20 border border-bht-accent/20 rounded-2xl rounded-br-sm px-4 py-3 text-sm text-bht-cream">
                  {msg.content}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-bht-accent/20 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-bht-accent">AI</span>
                    </div>
                    <span className="text-xs text-bht-cream/40 font-medium">Betreuer-Assistent</span>
                  </div>
                  <div className="bg-white/5 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-bht-cream/90">
                    {msg.content ? (
                      <div className="prose-chat" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                    ) : (
                      <Loader2 size={14} className="animate-spin text-bht-accent" />
                    )}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setSourcesOpen((prev) => ({ ...prev, [i]: !prev[i] }))}
                        className="flex items-center gap-1.5 text-xs text-bht-cream/35 hover:text-bht-cream/60 transition-colors"
                      >
                        {sourcesOpen[i] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {msg.sources.length} Quellen verwendet
                      </button>
                      {sourcesOpen[i] && (
                        <div className="mt-2 space-y-1.5">
                          {msg.sources.map((src, j) => (
                            <div key={j} className="bg-white/3 border border-white/5 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-medium text-bht-accent/80">{src.collection}</span>
                                <span className="text-[10px] text-bht-cream/30">{src.metadata?.source_file}</span>
                                <span className="ml-auto text-[10px] text-bht-cream/25">{(src.score * 100).toFixed(0)}%</span>
                              </div>
                              <p className="text-xs text-bht-cream/50 line-clamp-2">{src.text}</p>
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
      <div className="flex-shrink-0 p-4 border-t border-white/5">
        <div className="flex items-end gap-3 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-bht-accent/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Beschreibe dein Thema oder stelle eine Frage..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-bht-cream placeholder-bht-cream/30 resize-none outline-none leading-relaxed max-h-32"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-xl bg-bht-accent disabled:opacity-30 hover:bg-bht-accent/80 active:scale-95 transition-all flex items-center justify-center"
          >
            {loading ? <Loader2 size={14} className="animate-spin text-bht-dark" /> : <Send size={14} className="text-bht-dark" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-bht-cream/20 mt-2">Enter zum Senden · Shift+Enter für neue Zeile</p>
      </div>
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
