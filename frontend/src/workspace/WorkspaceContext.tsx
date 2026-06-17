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
  refresh: () => Promise<void>;
  ready: boolean;
}

const STORAGE_KEY = "rag-workspace";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function triplet([r, g, b]: [number, number, number]): string {
  return `${r} ${g} ${b}`;
}

function mix(base: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(base[0] + (255 - base[0]) * t),
    Math.round(base[1] + (255 - base[1]) * t),
    Math.round(base[2] + (255 - base[2]) * t),
  ];
}

function darken(base: [number, number, number], t: number): [number, number, number] {
  return [Math.round(base[0] * (1 - t)), Math.round(base[1] * (1 - t)), Math.round(base[2] * (1 - t))];
}

function applyAccent(hex: string) {
  const rgb = parseHex(hex);
  const el = document.documentElement;
  el.style.setProperty("--bht-accent", triplet(rgb));
  el.style.setProperty("--bht-accent-soft", triplet(mix(rgb, 0.33)));
  el.style.setProperty("--bht-accent-deep", triplet(darken(rgb, 0.15)));
  el.style.setProperty("--bht-accent-glow", triplet(mix(rgb, 0.70)));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) ?? ""
  );
  const [ready, setReady] = useState(false);

  // Bereiche vom Backend laden (Single Source of Truth)
  const refresh = useCallback(async () => {
    const data: { default: string; workspaces: Workspace[] } = await getWorkspaces();
    setWorkspaces(data.workspaces);
    setCurrentId((prev) => {
      const valid = prev && data.workspaces.some((w) => w.id === prev);
      return valid ? prev : data.default;
    });
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    <WorkspaceContext.Provider value={{ workspaces, current, setWorkspace, refresh, ready }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
