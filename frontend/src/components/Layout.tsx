import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { MessageSquare, Database, Upload, Settings, ChevronsUpDown, Check } from "lucide-react";
import { useWorkspace } from "../workspace/WorkspaceContext";

const nav = [
  { to: "/", label: "Chat", icon: MessageSquare, exact: true },
  { to: "/collections", label: "Collections", icon: Database },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/settings", label: "Einstellungen", icon: Settings },
];

function WorkspaceSwitcher() {
  const { workspaces, current, setWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!current) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 hover:bg-white/5 rounded-lg p-1.5 -m-1.5 transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-bht-accent flex items-center justify-center flex-shrink-0">
          <span className="text-bht-dark font-bold text-xs">BHT</span>
        </div>
        <div className="hidden lg:block flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-bht-cream leading-tight truncate">{current.label}</p>
          <p className="text-[10px] text-bht-cream/40 leading-tight truncate">{current.subtitle}</p>
        </div>
        <ChevronsUpDown size={14} className="hidden lg:block text-bht-cream/30 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-[#15303b] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => { setWorkspace(w.id); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: w.accent }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-bht-cream leading-tight truncate">{w.label}</p>
                <p className="text-[10px] text-bht-cream/40 leading-tight truncate">{w.subtitle}</p>
              </div>
              {w.id === current.id && <Check size={13} className="text-bht-accent flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { current } = useWorkspace();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 flex-shrink-0 flex flex-col bg-[#0d1f27] border-r border-white/5">
        <div className="p-4 lg:px-5 lg:py-6 border-b border-white/5">
          <WorkspaceSwitcher />
        </div>

        <nav className="flex-1 p-2 lg:p-3 space-y-1">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-bht-accent/15 text-bht-accent"
                    : "text-bht-cream/50 hover:text-bht-cream hover:bg-white/5"
                }`
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              <span className="hidden lg:block font-medium">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5 hidden lg:block">
          <p className="text-[10px] text-bht-cream/25 leading-relaxed">
            Berliner Hochschule für Technik<br />
            Fachbereich VI · 2026
          </p>
        </div>
      </aside>

      {/* Main – Key erzwingt Remount (und damit Neu-Laden) beim Bereichswechsel */}
      <main key={current?.id ?? "loading"} className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
