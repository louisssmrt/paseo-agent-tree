// Mode démo : données synthétiques neutres pour les captures d'écran. Rien de réel n'y entre.
import type { ArbrePrefs } from "./defaults.ts";
import { treeOptions } from "./options.ts";
import { buildTree, type HostInput, type HostNode, type RawAgent, type RawTaskCall } from "./tree.ts";

const BLUE = "#3b82f6";
const ORANGE = "#f97316";

const agent = (id: string, title: string, cwd: string, minutesAgo: number, extra: Partial<RawAgent> = {}): RawAgent => ({
  id,
  title,
  cwd,
  status: "idle",
  updatedAt: new Date(Date.UTC(2026, 0, 15, 12, 0, 0) - minutesAgo * 60_000).toISOString(),
  ...extra,
});

const call = (callId: string, description: string, subAgentType: string, status: string, minutesAgo: number): RawTaskCall => ({
  callId,
  description,
  subAgentType,
  status,
  timestamp: new Date(Date.UTC(2026, 0, 15, 12, 0, 0) - minutesAgo * 60_000).toISOString(),
});

/** Les deux machines de démonstration, avec leurs agents et sous-agents. */
export function demoInputs(): HostInput[] {
  return [
    {
      serverId: "demo-laptop",
      label: "MacBook Pro",
      online: true,
      color: BLUE,
      workspaces: [],
      agents: [
        agent("demo-1", "Fix checkout flow on Safari", "/home/demo/web-app", 1, { status: "running" }),
        agent("demo-2", "Add dark mode to settings page", "/home/demo/web-app", 40),
        agent("demo-3", "github · paseo-agent-tree", "/home/demo/web-app", 95),
        agent("demo-4", "Add rate limiting to /login", "/home/demo/api", 8, { pendingPermissions: [{}] }),
        agent("demo-5", "Migrate users table to UUIDs", "/home/demo/api", 180),
      ],
      taskCalls: new Map([
        [
          "demo-4",
          [
            call("t1", "Review auth middleware (code-reviewer)", "code-reviewer", "completed", 12),
            call("t2", "Write login load tests (general-purpose)", "general-purpose", "completed", 20),
            call("t3", "Update API docs (general-purpose)", "general-purpose", "completed", 30),
          ],
        ],
      ]),
    },
    {
      serverId: "demo-desktop",
      label: "Workstation",
      online: true,
      color: ORANGE,
      workspaces: [],
      agents: [
        agent("demo-6", "Refactor button tokens", "/home/demo/design-system", 15),
        agent("demo-7", "Document the color palette", "/home/demo/design-system", 70),
        agent("demo-8", "Export the icon set as SVG", "/home/demo/design-system", 210),
      ],
      taskCalls: new Map(),
    },
  ];
}

/** Clés de nœuds à déplier d'office en démo : l'agent qui montre ses trois sous-agents. */
export const DEMO_TOGGLED: Readonly<Record<string, boolean>> = { "demo-laptop::demo-4": true };

/**
 * Arbre à afficher. En mode démo, `real` n'est JAMAIS lu : ni agents, ni noms, ni couleurs, ni
 * réglages par machine (nom, masquage). `real` est un thunk pour que le test puisse le prouver.
 */
export function selectTree(prefs: ArbrePrefs, real: () => HostNode[]): { tree: HostNode[]; toggled: Record<string, boolean> } {
  if (prefs.demo) {
    return { tree: buildTree(demoInputs(), { ...treeOptions(prefs), showTemporary: false }), toggled: { ...prefs.toggled, ...DEMO_TOGGLED } };
  }
  return { tree: real(), toggled: prefs.toggled };
}
