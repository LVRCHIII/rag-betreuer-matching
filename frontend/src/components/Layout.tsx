import { NavLink, Outlet } from "react-router-dom";
import { MessageSquare, Database, Upload, Settings } from "lucide-react";

const nav = [
  { to: "/", label: "Chat", icon: MessageSquare, exact: true },
  { to: "/collections", label: "Collections", icon: Database },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/settings", label: "Einstellungen", icon: Settings },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 flex-shrink-0 flex flex-col bg-[#0d1f27] border-r border-white/5">
        <div className="p-4 lg:px-5 lg:py-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-bht-accent flex items-center justify-center flex-shrink-0">
              <span className="text-bht-dark font-bold text-xs">BHT</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold text-bht-cream leading-tight">Betreuer-Matching</p>
              <p className="text-[10px] text-bht-cream/40 leading-tight">RAG System · Gruppe 02</p>
            </div>
          </div>
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

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
