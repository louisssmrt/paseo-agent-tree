// Mode démo : données synthétiques seulement, jamais les vraies, et mêmes contrôles que l'arbre réel.
import assert from "node:assert/strict";
import { DEMO_TOGGLED, selectTree } from "../shared/demo.ts";
import { DEFAULT_PREFS } from "../shared/defaults.ts";
import { flattenOptions } from "../shared/options.ts";
import { flattenRows, LABEL_MAX, renderRows, type HostNode } from "../shared/tree.ts";

// Les vraies données sont un thunk qui explose si on y touche ; les réglages par machine sont piégés aussi.
const real = (): HostNode[] => {
  throw new Error("real data must not be read in demo mode");
};
const prefs = { ...DEFAULT_PREFS, demo: true, hosts: { "demo-laptop": { name: "Secret name", hidden: true, color: "#000000" } }, showTemporary: true };
const { tree, toggled } = selectTree(prefs, real);

assert.deepEqual(tree.map((h) => h.label), ["MacBook Pro", "Workstation"]);
assert.deepEqual(tree.map((h) => h.color), ["#3b82f6", "#f97316"]);
assert.ok(tree.every((h) => h.online));
assert.deepEqual(tree.flatMap((h) => h.projects.map((p) => p.name)).sort(), ["api", "design-system", "web-app"]);
const agents = tree.flatMap((h) => h.projects.flatMap((p) => p.agents));
assert.ok(agents.length >= 6 && agents.length <= 8, `agents: ${agents.length}`);
assert.equal(agents.filter((a) => a.status === "running").length, 1);
assert.equal(agents.filter((a) => a.status === "attention").length, 1);
assert.ok(agents.every((a) => ["running", "attention", "idle"].includes(a.status)));
assert.equal(agents.find((a) => a.children.length === 3)?.title, "Add rate limiting to /login");

const rows = flattenRows(tree, { ...flattenOptions(prefs), toggled });
console.log(renderRows(rows));
assert.equal(rows.filter((r) => r.kind === "task").length, 3, "one agent shows three subagents");
assert.ok(toggled["demo-laptop::demo-4"] === DEMO_TOGGLED["demo-laptop::demo-4"]);
assert.ok(rows.every((r) => Array.from(r.label).length <= LABEL_MAX), "labels fit");
assert.ok(rows.every((r) => !/https?:\/\//.test(r.label)), "no raw URL");
assert.ok(rows.every((r) => r.kind !== "host" || !/^demo-/.test(r.label)), "no raw host id");
assert.ok(rows.every((r) => !r.label.includes("Secret")), "per-machine real prefs are ignored");

// Hors démo, les vraies données passent telles quelles.
const sentinel: HostNode[] = [];
assert.equal(selectTree({ ...prefs, demo: false }, () => sentinel).tree, sentinel);
console.log("demo.test : OK");
