import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { isValidEntry } from "@/lib/workspace-schema";

// Everything the user enters stays in this browser. Nothing is sent anywhere.
const PREFIX = "opensecmaturity:v1:";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValidEntry(key, parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** useState that survives a refresh. Falls back to plain memory if storage is blocked. */
export function usePersistedState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Private window or storage full: keep working in memory.
    }
  }, [key, value]);
  return [value, setValue];
}

type Workspace = { app: "OpenSecMaturity"; format: 1; saved: string; data: Record<string, unknown> };

function storedKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
  } catch {
    // Storage unavailable.
  }
  return keys;
}

/** Download the saved assessment as a JSON file the user controls. */
export function exportWorkspace(): void {
  const data: Record<string, unknown> = {};
  for (const key of storedKeys()) {
    try {
      data[key.slice(PREFIX.length)] = JSON.parse(window.localStorage.getItem(key) ?? "null");
    } catch {
      // Skip an unreadable entry.
    }
  }
  const workspace: Workspace = { app: "OpenSecMaturity", format: 1, saved: new Date().toISOString(), data };
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" }));
  link.download = "opensecmaturity-assessment.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Replace the saved assessment with one from a file, then reload to show it. */
/** Replace the saved assessment with known-good data (used by the example company). */
export function loadWorkspaceData(data: Record<string, unknown>): void {
  const entries = Object.entries(data).filter(([key, value]) => isValidEntry(key, value));
  for (const key of storedKeys()) window.localStorage.removeItem(key);
  for (const [key, value] of entries) window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  window.location.reload();
}

const MAX_WORKSPACE_BYTES = 5 * 1024 * 1024;

export async function importWorkspace(file: File): Promise<void> {
  if (file.size > MAX_WORKSPACE_BYTES) throw new Error("That file is too large to be an OpenSecMaturity assessment.");
  const parsed = JSON.parse(await file.text()) as Partial<Workspace>;
  if (parsed.app !== "OpenSecMaturity" || parsed.format !== 1 || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("That file is not an OpenSecMaturity assessment.");
  }
  // Keep only known keys with the expected shape; anything else is dropped.
  const entries = Object.entries(parsed.data).filter(([key, value]) => isValidEntry(key, value));
  for (const key of storedKeys()) window.localStorage.removeItem(key);
  for (const [key, value] of entries) window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  window.location.reload();
}

/** Forget the saved assessment and start over. */
export function resetWorkspace(): void {
  for (const key of storedKeys()) window.localStorage.removeItem(key);
  window.location.reload();
}

export type Theme = "system" | "light" | "dark";

const THEME_KEY = "opensecmaturity:theme";

/** Per-viewer theme. Stored apart from the assessment so it is not exported or reset. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      return saved === "light" || saved === "dark" ? saved : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  }, [theme]);
  return [theme, setThemeState];
}
