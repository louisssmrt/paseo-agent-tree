// Lignes affichées avec des données synthétiques : couleurs par machine, libellés courts, aucun id brut.
import assert from "node:assert/strict";
import { decorateHosts, flattenOptions, treeOptions } from "../shared/options.ts";
import { DEFAULT_PREFS } from "../shared/defaults.ts";
import { buildTree, flattenRows, LABEL_MAX, renderRows, type HostInput, type RawAgent, type RawTaskCall } from "../shared/tree.ts";

const agent = (id: string, title: string, cwd: string, extra: Partial<RawAgent> = {}): RawAgent => ({ id, title, cwd, status: "idle", updatedAt: `2026-11-0${id.length}T10:00:00Z`, ...extra });
const calls = (n: number): RawTaskCall[] => Array.from({ length: n }, (_, i) => ({ callId: `c${i}`, description: `Review part ${i} of the migration plan with a very long description that must be clipped`, subAgentType: "reviewer", status: i === 0 ? "running" : "completed", timestamp: `2026-11-06T10:0${i}:00Z` }));

const inputs: HostInput[] = [
  {
    serverId: "host-a",
    label: "Laptop",
    online: true,
    workspaces: [],
    agents: [
      agent("1", "https://github.com/acme/demo-app", "/home/dev/demo", { status: "running" }),
      agent("22", "https://video.example.com/watch/AbC123xYz9Q", "/home/dev/demo"),
      agent("333", "Refactor the billing module and its tests across the whole repository", "/home/dev/billing"),
    ],
    taskCalls: new Map([["1", calls(3)]]),
  },
  { serverId: "host-b", label: "Remote PC", online: false, workspaces: [], agents: [], taskCalls: new Map() },
  { serverId: "host-c", label: "Server", online: true, loading: true, workspaces: [], agents: [], taskCalls: new Map() },
];

const prefs = { ...DEFAULT_PREFS };
const tree = buildTree(decorateHosts(inputs, prefs, "host-a"), treeOptions(prefs));
for (const host of tree) console.log(`color ${host.label} : ${host.color}`);
assert.equal(tree[0]!.color, "#3b82f6", "the local machine is blue by default");
assert.equal(new Set(tree.map((h) => h.color)).size, tree.length, "distinct colors");

const all: Record<string, boolean> = {};
const mark = (nodes: any[]) => nodes.forEach((n) => { all[n.key] = true; mark(n.children ?? []); mark(n.agents ?? []); mark(n.projects ?? []); });
mark(tree);
for (const [title, toggled] of [["Default state", {}], ["All expanded", all]] as const) {
  const rows = flattenRows(tree, { ...flattenOptions(prefs), toggled });
  console.log(`--- ${title}\n${renderRows(rows)}`);
  assert.ok(rows.every((r) => Array.from(r.label).length <= LABEL_MAX), "labels fit");
  assert.ok(rows.every((r) => !/https?:\/\//.test(r.label)), "no raw URL");
  assert.ok(rows.filter((r) => r.kind === "host").every((r) => !/^host-[abc]/.test(r.label)), "no raw host id");
}
const labels = flattenRows(tree, flattenOptions(prefs)).map((r) => r.label);
assert.ok(labels.includes("github · demo-app"));
assert.ok(labels.includes("Loading…"));
assert.ok(labels.some((l) => l.endsWith("(offline)")));
console.log("rows.test : OK");
