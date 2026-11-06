// Script de debug LOCAL (pas un test) : lit l'hôte réel et imprime l'arbre via la même logique que le plugin.
// Usage : node test/debug-live.ts [ws://127.0.0.1:6767/ws] [--temp]
import { createPaseoClient } from "@getpaseo/client";
import { fetchAgents, fetchTaskCalls, fetchWorkspaces, type ApiLike } from "../shared/collect.ts";
import { decorateHosts, flattenOptions, treeOptions } from "../shared/options.ts";
import { DEFAULT_PREFS } from "../shared/defaults.ts";
import { buildTree, flattenRows, renderRows, renderText, LABEL_MAX, type HostInput, type RawTaskCall } from "../shared/tree.ts";

const url = process.argv.find((a) => a.startsWith("ws://")) ?? "ws://127.0.0.1:6767/ws";
const showTemporary = process.argv.includes("--temp");

const local = createPaseoClient({ url, clientId: "cid_arbre_agents_test", reconnect: { enabled: false } });
await local.connect();

async function load(api: ApiLike, serverId: string, label: string): Promise<HostInput> {
  const [agents, workspaces] = await Promise.all([fetchAgents(api), fetchWorkspaces(api)]);
  const taskCalls = new Map<string, readonly RawTaskCall[]>();
  for (const agent of agents) {
    try {
      taskCalls.set(agent.id, await fetchTaskCalls(api, agent.id));
    } catch {
      // timeline illisible : pas de sous-agents pour cet agent
    }
  }
  return { serverId, label, online: true, agents, workspaces, taskCalls };
}

const directory: any = await local.hosts.list();
const hosts: any[] = directory.hosts ?? [];
const inputs: HostInput[] = [];
inputs.push(await load(local as unknown as ApiLike, directory.self.serverId, directory.self.label));
for (const host of hosts) {
  const serverId = host.serverId ?? host.id;
  const label = host.label ?? serverId;
  const status = host.status;
  if (host.enabled === false) continue;
  if (status !== "online") {
    inputs.push({ serverId, label, online: false, agents: [], workspaces: [], taskCalls: new Map() });
    continue;
  }
  try {
    inputs.push(await load((await local.hosts.client(serverId)) as unknown as ApiLike, serverId, label));
  } catch (cause) {
    inputs.push({ serverId, label, online: false, agents: [], workspaces: [], taskCalls: new Map(), error: String(cause) });
  }
}
if (process.argv.includes("--raw-hosts")) console.log(JSON.stringify(directory, null, 1));
const prefs = { ...DEFAULT_PREFS, showTemporary };
const tree = buildTree(decorateHosts(inputs, prefs, directory.self.serverId), treeOptions(prefs));
for (const host of tree) console.log(`couleur ${host.label} (${host.serverId}) : ${host.color}`);
if (!/^#[0-9a-f]{6}$/i.test(tree[0]?.color ?? "")) process.exitCode = 1;
if (process.argv.includes("--rows")) {
  // Lignes telles qu'affichées : tout déplié pour le contrôle, puis état par défaut.
  const all: Record<string, boolean> = {};
  const mark = (nodes: any[]) => nodes.forEach((n) => { all[n.key] = true; if (n.children) mark(n.children); if (n.agents) mark(n.agents); if (n.projects) mark(n.projects); });
  mark(tree);
  for (const [title, toggled] of [["Etat par defaut (agents et sous-agents replies)", {}], ["Tout deplie", all]] as const) {
    const rows = flattenRows(tree, { ...flattenOptions(prefs), toggled });
    console.log(`--- ${title}`);
    console.log(renderRows(rows));
    const long = rows.filter((r) => Array.from(r.label).length > LABEL_MAX);
    const rawHosts = rows.filter((r) => r.kind === "host" && r.label.replace(/  (offline)$/, "") === r.serverId);
    const urls = rows.filter((r) => /https?:\/\//.test(r.label));
    console.log(`couleurs distinctes entre hotes : ${new Set(tree.map((h) => h.color)).size}/${tree.length}`);
    console.log(`controle : ${rows.length} lignes, libelles >${LABEL_MAX}: ${long.length}, ids d'hote bruts: ${rawHosts.length}, URL brutes: ${urls.length}`);
    if (long.length || rawHosts.length || urls.length) process.exitCode = 1;
  }
} else console.log(renderText(tree));
await local.close();
process.exit(0);
