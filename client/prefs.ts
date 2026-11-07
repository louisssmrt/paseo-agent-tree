import { useSettings } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { arbreSettings, DEFAULT_PREFS, type ArbrePrefs } from "../shared/prefs";

type Settings = ReturnType<typeof useSettings<typeof arbreSettings.schema>>;

const DEFAULTS: ArbrePrefs = DEFAULT_PREFS;

// Magasin partagé par la barre latérale et l'écran : un clic dans l'un met l'autre à jour sur
// l'instant. L'état local fait foi ; les réglages de l'hôte ne servent qu'à la reprise et à la
// persistance (écritures en série, une seule en vol).
let state: ArbrePrefs = DEFAULTS;
let latest: Settings | null = null;
let adopted: string | null = null;
let saving = false;
let dirty = false;
const listeners = new Set<() => void>();

function emit(next: ArbrePrefs): void {
  state = next;
  listeners.forEach((listener) => listener());
}

async function flush(): Promise<void> {
  if (saving) {
    dirty = true;
    return;
  }
  saving = true;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      dirty = false;
      const current = latest;
      if (!current || current.status !== "ready") return;
      const ok = await current.save(state, current.revision);
      if (ok && !dirty) return;
      await new Promise((resolve) => setTimeout(resolve, 300)); // laisse le rendu rapporter la nouvelle révision
    }
  } finally {
    saving = false;
  }
}

function change(patch: (current: ArbrePrefs) => ArbrePrefs): void {
  emit(patch(state));
  void flush();
}

/** Bascule le mode démo (Command Center). */
export function toggleDemo(): void {
  change((p) => ({ ...p, demo: !p.demo }));
}

export function getPrefs(): ArbrePrefs {
  return state;
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useArbrePrefs() {
  const settings = useSettings(arbreSettings);
  const prefs = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );

  useEffect(() => {
    latest = settings;
    if (settings.status === "ready" && adopted === null && !saving) {
      adopted = settings.revision;
      emit({ ...DEFAULTS, ...(settings.values as Partial<ArbrePrefs>) });
    }
  }, [settings]);

  return {
    prefs,
    persisted: settings.status === "ready",
    setOpen: useCallback((key: string, open: boolean) => change((p) => ({ ...p, toggled: { ...p.toggled, [key]: open } })), []),
    setShowTemporary: useCallback((value: boolean) => change((p) => ({ ...p, showTemporary: value })), []),
    /** Modifie n'importe quel réglage (page de réglages). */
    setPrefs: useCallback((patch: Partial<ArbrePrefs>) => change((p) => ({ ...p, ...patch })), []),
    setHost: useCallback(
      (serverId: string, patch: { color?: string | undefined; name?: string | undefined; hidden?: boolean | undefined }) =>
        change((p) => {
          const next = { ...p.hosts[serverId], ...patch };
          for (const key of Object.keys(next) as Array<keyof typeof next>) if (next[key] === undefined || next[key] === "") delete next[key];
          return { ...p, hosts: { ...p.hosts, [serverId]: next } };
        }),
      [],
    ),
    setReplaceNative: useCallback((value: boolean) => change((p) => ({ ...p, replaceNative: value })), []),
    setSidebarTree: useCallback((value: boolean) => change((p) => ({ ...p, sidebarTree: value })), []),
  };
}

/** Un nœud est déplié selon le choix mémorisé, sinon selon son niveau. */
export function isOpen(toggled: Record<string, boolean>, key: string, fallback: boolean): boolean {
  const value = toggled[key];
  return value === undefined ? fallback : value;
}
