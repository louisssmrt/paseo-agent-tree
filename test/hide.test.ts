// Cas synthétiques : dossiers temporaires/système masqués, liens parent, cycle, hôte hors ligne.
import assert from "node:assert/strict";
import { DEFAULT_OPTIONS, shortTitle, buildHost, isTemporaryPath, renderText, type HostInput, type RawAgent } from "../shared/tree.ts";

for (const path of ["C:\\Windows\\System32", "c:\\windows", "C:\\Users\\dev\\AppData\\Local\\Temp", "/tmp/x", "/private/tmp", "/var/folders/ab/T", "D:\\Dev\\tmp", "/home/u/Temp", "C:\\Windows\\System32\\"]) {
  assert.equal(isTemporaryPath(path), true, path);
}
for (const path of ["/home/dev/work", "C:\\Users\\dev\\work", "D:\\Dev\\tmpl", "/home/dev/windows-app", "/home/dev/work/temporal"]) {
  assert.equal(isTemporaryPath(path), false, path);
}

assert.equal(shortTitle("https://github.com/acme/demo-app", "x"), "github · demo-app");
assert.equal(shortTitle("https://www.instagram.com/reel/DfDPwNVOe1v/?mdxt=ZmdtOHphcXR", "x"), "instagram · reel");
assert.ok(Array.from(shortTitle("a ".repeat(100), "x")).length <= 40);
const a = (id: string, cwd: string, extra: Partial<RawAgent> = {}): RawAgent => ({ id, title: `T-${id}`, cwd, status: "idle", updatedAt: `2026-11-0${id.length}T10:00:00Z`, ...extra });
const input: HostInput = {
  serverId: "host-b",
  label: "Remote PC",
  online: true,
  workspaces: [{ id: "w1", name: "master", workspaceDirectory: "C:\\Users\\dev\\work" }],
  agents: [
    a("1", "C:\\Users\\dev\\work", { workspaceId: "w1", status: "running" }),
    a("22", "C:\\Windows\\System32"),
    a("333", "C:\\Users\\dev\\AppData\\Local\\Temp"),
    a("4444", "C:\\Users\\dev\\work", { workspaceId: "w1", labels: { "paseo.parent-agent-id": "1" } }),
    a("55555", "x", { labels: { "paseo.parent-agent-id": "666666" } }),
    a("666666", "x", { labels: { "paseo.parent-agent-id": "55555" } }),
    a("7", "C:\\Users\\dev\\work", { archivedAt: "2026-11-01T00:00:00Z" }),
  ],
  taskCalls: new Map([["1", [{ callId: "c1", description: "Relire", subAgentType: "blog-reviewer", status: "running", timestamp: "2026-11-06T10:00:00Z" }]]]),
};
const host = buildHost(input);
assert.equal(host.hiddenAgents, 2);
assert.deepEqual(host.projects.map((p) => p.name).sort(), ["work", "x"]);
const claude = host.projects.find((p) => p.name === "work")!;
assert.equal(claude.agents.length, 1, "l'agent enfant et l'archivé ne sont pas au premier niveau");
assert.equal(claude.agents[0]!.children.length, 2, "un agent enfant + un sous-agent Task");
assert.equal(host.projects.find((p) => p.name === "x")!.agents.length, 2, "cycle coupé : les deux restent visibles");
assert.equal(buildHost(input, { ...DEFAULT_OPTIONS, showTemporary: true }).hiddenAgents, 0);
console.log(renderText([host]));
console.log("hide.test : OK");
