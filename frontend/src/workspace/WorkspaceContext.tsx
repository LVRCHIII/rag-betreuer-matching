import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { getWorkspaces, setApiWorkspace } from "../api/client";

export interface Workspace {
  id: string;
  label: string;
  subtitle: string;
  accent: string; // Hex
  chat_title: string;
  chat_intro: string;
  assistant_name: string;
  placeholder: string;
  suggestions: string[];
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  current: Workspace | null;
  setWorkspace: (id: string) => void;
  ready: boolean;
}

const STORAGE_KEY = "rag-workspace";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** "#B58CE0" → "181 140 224" für die CSS-Variable --bht-accent */
function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function applyAccent(hex: string) {
  document.documentElement.style.setProperty("--bht-accent", hexToRgbTriplet(hex));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? ""
  );
  const [ready, setReady] = useState(false);

  // Bereiche vom Backend laden (Single Source of Truth)
  useEffect(() => {
    getWorkspaces().then((data: { default: string; workspaces: Workspace[] }) => {
      setWorkspaces(data.workspaces);
      setCurrentId((prev) => {
        const valid = prev && data.workspaces.some((w) => w.id === prev);
        return valid ? prev : data.default;
      });
      setReady(true);
    });
  }, []);

  const current = workspaces.find((w) => w.id === currentId) ?? null;

  // API-Client + Akzentfarbe synchron halten
  useEffect(() => {
    if (!current) return;
    setApiWorkspace(current.id);
    applyAccent(current.accent);
    localStorage.setItem(STORAGE_KEY, current.id);
  }, [current]);

  const setWorkspace = useCallback((id: string) => setCurrentId(id), []);

  return (
    <WorkspaceContext.Provider value={{ workspaces, current, setWorkspace, ready }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
