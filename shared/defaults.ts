// Valeurs par défaut, palette et couleur d'hôte : aucun import, utilisable tel quel par node (tests).

export type ArbrePrefs = {
  toggled: Record<string, boolean>;
  showTemporary: boolean;
  sidebarTree: boolean;
  replaceNative: boolean;
  hosts: Record<string, { color?: string; name?: string; hidden?: boolean }>;
  openHosts: boolean;
  openProjects: boolean;
  openAgents: boolean;
  showSubagents: boolean;
  maxSubagents: number;
  archived: "hide" | "dim";
  closed: "hide" | "dim" | "show";
  sort: "recent" | "name";
  titleMax: number;
  statusDots: boolean;
  subagentCount: boolean;
  topMargin: number;
};

export const DEFAULT_PREFS: ArbrePrefs = {
  toggled: {},
  showTemporary: false,
  sidebarTree: true,
  replaceNative: true,
  hosts: {},
  openHosts: true,
  openProjects: true,
  openAgents: false,
  showSubagents: true,
  maxSubagents: 20,
  archived: "hide",
  closed: "show",
  sort: "recent",
  titleMax: 40,
  statusDots: true,
  subagentCount: true,
  topMargin: 16,
};

/** Palette proposée dans la page de réglages (sobre, lisible sur fond clair et sombre). */
export const PALETTE: ReadonlyArray<{ name: string; color: string }> = [
  { name: "Blue", color: "#3b82f6" },
  { name: "Red", color: "#ef4444" },
  { name: "Green", color: "#22c55e" },
  { name: "Orange", color: "#f97316" },
  { name: "Purple", color: "#8b5cf6" },
  { name: "Teal", color: "#14b8a6" },
  { name: "Pink", color: "#ec4899" },
  { name: "Yellow", color: "#eab308" },
  { name: "Gray", color: "#94a3b8" },
  { name: "Brown", color: "#a16207" },
];

const BLUE = PALETTE[0]!.color;

/** Couleur d'un hôte : choix de l'utilisateur, sinon bleu pour la machine locale, sinon couleur stable dérivée de l'identifiant. */
export function hostColor(prefs: Pick<ArbrePrefs, "hosts">, serverId: string, primaryId?: string | null): string {
  const chosen = prefs.hosts[serverId]?.color;
  if (chosen) return chosen;
  if (serverId === primaryId) return BLUE; // la machine locale (self) est bleue
  let hash = 0;
  for (const ch of serverId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const rest = PALETTE.slice(1); // le bleu est réservé à la machine locale
  return rest[hash % rest.length]!.color;
}
