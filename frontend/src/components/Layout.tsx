import { useEffect, useRef } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { MessageSquare, Database, Upload, Settings } from "lucide-react";
import gsap from "gsap";
import ParticleField from "./ParticleField";

const nav = [
  { to: "/", label: "Chat", icon: MessageSquare, exact: true },
  { to: "/collections", label: "Collections", icon: Database },
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/settings", label: "Einstellungen", icon: Settings },
];

export default function Layout() {
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-side-item]",
        { x: -18, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, stagger: 0.07, ease: "power3.out", delay: 0.15 }
      );
    }, asideRef);
    return () => ctx.revert();
  }, []);

  return (
    <div className="relative flex h-screen overflow-hidden">
      <ParticleField />

      {/* Sidebar */}
      <aside
        ref={asideRef}
        className="relative z-10 w-16 lg:w-60 flex-shrink-0 flex flex-col glass-deep border-r-0 m-3 mr-0 rounded-2xl"
      >
        <div data-side-item className="p-4 lg:px-5 lg:py-6">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl btn-ember flex items-center justify-center flex-shrink-0">
              <span className="font-display font-bold text-[11px] tracking-tight">BHT</span>
            </div>
            <div className="hidden lg:block">
              <p className="font-display text-[13px] font-semibold text-bht-cream leading-tight tracking-tight">
                Betreuer-Matching
              </p>
              <p className="text-[10px] text-bht-cream/40 leading-tight mt-0.5">
                RAG System · Gruppe 02
              </p>
            </div>
          </div>
        </div>

        <div className="hairline mx-4 mb-2" />

        <nav className="flex-1 p-2 lg:p-3 space-y-1.5">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              data-side-item
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-2.5 lg:px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  isActive
                    ? "text-bht-accent bg-bht-accent/[0.12] shadow-glow-sm"
                    : "text-bht-cream/45 hover:text-bht-cream hover:bg-white/[0.05]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full bg-gradient-to-b from-bht-accent-soft to-bht-accent-deep transition-all duration-300 ${
                      isActive ? "h-5 opacity-100" : "h-0 opacity-0"
                    }`}
                  />
                  <Icon
                    size={16}
                    className={`flex-shrink-0 transition-transform duration-200 ${
                      isActive ? "" : "group-hover:scale-110"
                    }`}
                  />
                  <span className="hidden lg:block font-medium tracking-wide">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div data-side-item className="p-4 hidden lg:block">
          <div className="hairline mb-3" />
          <p className="text-[10px] text-bht-cream/25 leading-relaxed">
            Berliner Hochschule für Technik
            <br />
            Fachbereich I · by Lucas Bruhn
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="relative z-10 flex-1 overflow-hidden p-3">
        <div className="h-full rounded-2xl overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
