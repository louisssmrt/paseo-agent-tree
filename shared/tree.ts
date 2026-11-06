// Logique pure de l'arbre Hôte > Projet > Agent > Sous-agents. Aucun import d'exécution :
// le client Paseo, le serveur et le script de test (node) la partagent telle quelle.

export interface RawAgent {
  id: string;
  title?: string | null;
  cwd?: string | null;
  workspaceId?: string | null;
  status: string;
  updatedAt?: string | null;
  createdAt?: string | null;
  archivedAt?: string | null;
  labels?: Record<string, string> | null;
  pendingPermissions?: readonly unknown[] | null;
  attentionReason?: string | null;
}

export interface RawWorkspace {
  id: string;
  name?: string | null;
  workspaceDirectory?: string | null;
  projectRootPath?: string | null;
  archivingAt?: string | null;
}

/** Un appel d'outil Agent/Task lu dans la timeline d'un agent Claude Code. */
export interface RawTaskCall {
  callId: string;
  description: string;
  subAgentType: string | null;
  /** running | completed | failed | canceled (statut Paseo du tool_call). */
  status: string;
  timestamp: string | null;
}

export interface HostInput {
  serverId: string;
  label: string;
  online: boolean;
  agents: readonly RawAgent[];
  workspaces: readonly RawWorkspace[];
  taskCalls: ReadonlyMap<string, readonly RawTaskCall[]>;
  error?: string | null;
  /** Hôte en ligne dont les premières données n'ont pas encore répondu. */
  loading?: boolean;
  /** Couleur de la machine (hex). */
  color?: string;
}

export type NodeStatus = "running" | "attention" | "error" | "idle" | "closed";

export interface TaskNode {
  kind: "task";
  key: string;
  title: string;
  subtype: string | null;
  status: NodeStatus;
  at: string;
}

export interface AgentNode {
  kind: "agent";
  key: string;
  serverId: string;
  id: string;
  title: string;
  status: NodeStatus;
  updatedAt: string;
  /** Archivé ou fermé et à afficher grisé. */
  dim: boolean;
  children: ChildNode[];
}

export type ChildNode = AgentNode | TaskNode;

export interface ProjectNode {
  key: string;
  name: string;
  path: string;
  agents: AgentNode[];
  /** Agents et sous-agents en cours dans ce projet. */
  running: number;
}

export interface HostNode {
  key: string;
  serverId: string;
  label: string;
  online: boolean;
  error: string | null;
  projects: ProjectNode[];
  /** Agents masqués parce que leur dossier est temporaire ou système. */
  hiddenAgents: number;
  hiddenFolders: string[];
  running: number;
  loading: boolean;
  color: string;
}

export interface TreeOptions {
  showTemporary: boolean;
  /** 0 = ne pas montrer les sous-agents Claude Code. */
  maxTasksPerAgent: number;
  archived: "hide" | "dim";
  closed: "hide" | "dim" | "show";
  sort: "recent" | "name";
  titleMax: number;
}

export const DEFAULT_OPTIONS: TreeOptions = { showTemporary: false, maxTasksPerAgent: 20, archived: "hide", closed: "show", sort: "recent", titleMax: 40 };

export const PARENT_LABEL = "paseo.parent-agent-id";

/** Chemin en minuscules, séparateurs `/`, sans barre finale : Windows et POSIX se comparent pareil. */
export function normalizePath(path: string): string {
  let out = path.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
  while (out.length > 1 && out.endsWith("/") && !/^[a-z]:\/$/.test(out)) out = out.slice(0, -1);
  return out;
}

export function baseName(path: string): string {
  const parts = path.trim().replace(/\\/g, "/").split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return path.trim() || "?";
  return last;
}

/** Dossier temporaire ou système : basename tmp/temp, /tmp, /private/tmp, /var/folders, C:\Windows (System32 compris). */
export function isTemporaryPath(path: string): boolean {
  const p = normalizePath(path);
  if (!p) return false;
  const base = p.split("/").filter(Boolean).pop() ?? "";
  if (base === "tmp" || base === "temp" || base === "system32" || base === "syswow64") return true;
  if (p === "/tmp" || p.startsWith("/tmp/")) return true;
  if (p === "/private/tmp" || p.startsWith("/private/tmp/")) return true;
  if (p.startsWith("/private/var/folders/") || p.startsWith("/var/folders/")) return true;
  if (/^[a-z]:\/windows(\/|$)/.test(p)) return true;
  if (/^[a-z]:\/users\/[^/]+\/appdata\/local\/temp(\/|$)/.test(p)) return true;
  return false;
}

export function nodeStatus(agent: RawAgent): NodeStatus {
  if ((agent.pendingPermissions?.length ?? 0) > 0 || agent.attentionReason === "permission") return "attention";
  if (agent.status === "error" || agent.attentionReason === "error") return "error";
  if (agent.status === "running" || agent.status === "initializing") return "running";
  if (agent.status === "closed") return "closed";
  return "idle";
}

export function taskStatus(status: string): NodeStatus {
  if (status === "running" || status === "pending" || status === "in_progress") return "running";
  if (status === "failed" || status === "error") return "error";
  if (status === "canceled" || status === "cancelled") return "closed";
  return "idle";
}

export const STATUS_WORD: Record<NodeStatus, string> = {
  running: "running",
  attention: "permission",
  error: "error",
  idle: "idle",
  closed: "closed",
};

export const LABEL_MAX = 40;

export function clip(text: string, max = LABEL_MAX): string {
  const chars = Array.from(text.replace(/\s+/g, " ").trim());
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/** Segment qui ressemble à un identifiant opaque (DfDPwNVOe1v, 4e6f7bdf-c39e-...) plutôt qu'à un nom. */
function looksOpaque(segment: string): boolean {
  if (/^[0-9a-f]{8}-[0-9a-f-]{20,}$/i.test(segment)) return true;
  if (segment.length < 8 || segment.includes("-") || segment.includes("_")) return false;
  return /[0-9]/.test(segment) && /[a-z]/.test(segment) && /[A-Z]/.test(segment);
}

/** URL -> « domaine · dernier segment utile » (github · paseo-app-wallpaper, instagram · reel). */
export function shortUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const labels = url.hostname.replace(/^www\./, "").split(".");
    const domain = labels.length >= 2 ? labels[labels.length - 2]! : labels[0]!;
    const segments = url.pathname.split("/").filter(Boolean).map((x) => decodeURIComponent(x));
    let last = segments.pop();
    if (last && looksOpaque(last) && segments.length > 0) last = segments.pop();
    if (last && looksOpaque(last)) last = undefined;
    return last ? `${domain} · ${last}` : domain;
  } catch {
    return raw;
  }
}

/** Titre court d'une ligne : titre ou premier prompt nettoyé, URL raccourcie, 40 caractères max. */
export function shortTitle(text: string | null | undefined, fallback: string, max = LABEL_MAX): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return fallback;
  const cleaned = flat.replace(/https?:\/\/[^\s]+/g, (url) => shortUrl(url.replace(/[).,;]+$/, "")));
  return clip(cleaned, max);
}

function agentTitle(agent: RawAgent, max: number): string {
  return shortTitle(agent.title, `Agent ${agent.id.slice(0, 8)}`, max);
}

function time(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function childTitle(child: ChildNode): string {
  return child.title;
}

function countRunning(children: readonly ChildNode[]): number {
  let n = 0;
  for (const child of children) {
    if (child.status === "running") n += 1;
    if (child.kind === "agent") n += countRunning(child.children);
  }
  return n;
}

function taskNodes(calls: readonly RawTaskCall[] | undefined, agentKey: string, max: number, titleMax: number): TaskNode[] {
  if (!calls || max <= 0) return [];
  const seen = new Set<string>();
  const nodes: TaskNode[] = [];
  for (const call of calls) {
    if (seen.has(call.callId)) continue;
    seen.add(call.callId);
    nodes.push({
      kind: "task",
      key: `${agentKey}/task/${call.callId}`,
      title: shortTitle(call.description, call.subAgentType || "Subagent", titleMax),
      subtype: call.subAgentType,
      status: taskStatus(call.status),
      at: call.timestamp ?? "",
    });
  }
  nodes.sort((a, b) => time(b.at) - time(a.at));
  // Les sous-agents en cours restent toujours ; le reste est plafonné aux plus récents.
  const running = nodes.filter((n) => n.status === "running");
  const rest = nodes.filter((n) => n.status !== "running").slice(0, Math.max(0, max - running.length));
  return [...running, ...rest].sort((a, b) => time(b.at) - time(a.at));
}

export function buildHost(input: HostInput, options: TreeOptions = DEFAULT_OPTIONS): HostNode {
  const host: HostNode = {
    key: `host:${input.serverId}`,
    serverId: input.serverId,
    label: input.label,
    online: input.online,
    error: input.error ?? null,
    projects: [],
    hiddenAgents: 0,
    hiddenFolders: [],
    running: 0,
    loading: input.loading ?? false,
    color: input.color ?? "#94a3b8",
  };
  const workspaces = new Map(input.workspaces.map((w) => [w.id, w]));
  const live = input.agents.filter((a) => {
    if (a.archivedAt) return options.archived === "dim";
    return !(a.status === "closed" && options.closed === "hide");
  });

  const folderOf = (agent: RawAgent): string => {
    const ws = agent.workspaceId ? workspaces.get(agent.workspaceId) : undefined;
    return ws?.workspaceDirectory || ws?.projectRootPath || agent.cwd || "";
  };

  // Agents visibles d'abord (hors dossiers temporaires), les enfants suivent leur parent.
  const hiddenFolders = new Set<string>();
  const visible: RawAgent[] = [];
  for (const agent of live) {
    const folder = folderOf(agent);
    if (!options.showTemporary && isTemporaryPath(folder)) {
      host.hiddenAgents += 1;
      hiddenFolders.add(baseName(folder));
      continue;
    }
    visible.push(agent);
  }
  host.hiddenFolders = [...hiddenFolders].sort();

  const nodes = new Map<string, AgentNode>();
  for (const agent of visible) {
    const key = `${input.serverId}::${agent.id}`;
    nodes.set(agent.id, {
      kind: "agent",
      key,
      serverId: input.serverId,
      id: agent.id,
      title: agentTitle(agent, options.titleMax),
      status: agent.archivedAt ? "closed" : nodeStatus(agent),
      dim: Boolean(agent.archivedAt) || (agent.status === "closed" && options.closed === "dim"),
      updatedAt: agent.updatedAt ?? agent.createdAt ?? "",
      children: [],
    });
  }

  const parentOf = (agent: RawAgent): string | null => {
    const id = agent.labels?.[PARENT_LABEL];
    return id && id !== agent.id && nodes.has(id) ? id : null;
  };
  // Un cycle de parents (A -> B -> A) ferait disparaître les deux : on le coupe.
  const reachesSelf = (agent: RawAgent): boolean => {
    const seen = new Set<string>([agent.id]);
    let current: RawAgent | undefined = agent;
    for (;;) {
      const pid: string | null = current ? parentOf(current) : null;
      if (!pid) return false;
      if (seen.has(pid)) return true;
      seen.add(pid);
      current = visible.find((a) => a.id === pid);
    }
  };

  const topLevel: RawAgent[] = [];
  for (const agent of visible) {
    const pid = reachesSelf(agent) ? null : parentOf(agent);
    if (pid) nodes.get(pid)!.children.push(nodes.get(agent.id)!);
    else topLevel.push(agent);
  }

  for (const agent of visible) {
    const node = nodes.get(agent.id)!;
    const tasks = taskNodes(input.taskCalls.get(agent.id), node.key, options.maxTasksPerAgent, options.titleMax);
    node.children = [...node.children, ...tasks].sort((a, b) => {
      if (options.sort === "name") return childTitle(a).localeCompare(childTitle(b));
      const ta = a.kind === "agent" ? time(a.updatedAt) : time(a.at);
      const tb = b.kind === "agent" ? time(b.updatedAt) : time(b.at);
      return tb - ta;
    });
  }

  const projects = new Map<string, ProjectNode>();
  for (const agent of topLevel) {
    const folder = folderOf(agent) || "(no folder)";
    const key = `${input.serverId}::project::${normalizePath(folder)}`;
    let project = projects.get(key);
    if (!project) {
      project = { key, name: baseName(folder), path: folder, agents: [], running: 0 };
      projects.set(key, project);
    }
    project.agents.push(nodes.get(agent.id)!);
  }
  for (const project of projects.values()) {
    project.agents.sort((a, b) => (options.sort === "name" ? a.title.localeCompare(b.title) : time(b.updatedAt) - time(a.updatedAt)));
    project.running = countRunning(project.agents);
  }
  host.projects = [...projects.values()].sort((a, b) => {
    if (options.sort === "name") return a.name.localeCompare(b.name);
    const latest = (p: ProjectNode) => Math.max(...p.agents.map((x) => time(x.updatedAt)), 0);
    return latest(b) - latest(a);
  });
  host.running = host.projects.reduce((n, p) => n + p.running, 0);
  return host;
}

export function buildTree(inputs: readonly HostInput[], options: TreeOptions = DEFAULT_OPTIONS): HostNode[] {
  return inputs.map((input) => buildHost(input, options));
}

function dot(status: NodeStatus): string {
  return `[${STATUS_WORD[status]}]`;
}

function renderChildren(children: readonly ChildNode[], depth: number, lines: string[]): void {
  for (const child of children) {
    const indent = "  ".repeat(depth + 1);
    if (child.kind === "task") {
      lines.push(`${indent}${">".repeat(depth + 1)} Subagent : ${child.title}${child.subtype ? ` (${child.subtype})` : ""} ${dot(child.status)}`);
    } else {
      lines.push(`${indent}${">".repeat(depth + 1)} Agent : ${child.title} ${dot(child.status)}`);
      renderChildren(child.children, depth + 1, lines);
    }
  }
}

/** L'arbre en texte brut, tel que le test l'imprime. */
export function renderText(hosts: readonly HostNode[]): string {
  const lines: string[] = [];
  for (const host of hosts) {
    lines.push(`${host.label}${host.online ? "" : "  (offline)"}`);
    if (host.error) lines.push(`  ! ${host.error}`);
    for (const project of host.projects) {
      lines.push(`  > ${project.name}${project.running ? `  (${project.running} en cours)` : ""}`);
      renderChildren(project.agents, 1, lines);
    }
    if (host.hiddenAgents > 0) {
      lines.push(`  (${host.hiddenAgents} agent(s) hidden: temporary or system folders${host.hiddenFolders.length ? `: ${host.hiddenFolders.join(", ")}` : ""})`);
    }
  }
  return lines.join("\n");
}

// ---- Lignes à plat : une ligne = une ligne, partagées par la barre latérale, l'écran et le test.

export interface Row {
  key: string;
  level: number;
  kind: "host" | "project" | "agent" | "task";
  /** Libellé déjà tronqué à LABEL_MAX caractères. */
  label: string;
  /** Point de statut à droite ; null = rien (au repos, fermé, hôte, projet). */
  dot: "running" | "attention" | "error" | null;
  expandable: boolean;
  expanded: boolean;
  /** Nombre d'enfants, affiché seulement sur une ligne repliée. */
  count: number;
  serverId: string;
  /** Agent à ouvrir au clic (le parent pour un sous-agent Claude Code). */
  agentId: string | null;
  dim: boolean;
  /** Couleur de la machine : liseré à gauche de toute la ligne. */
  color: string;
}

export interface FlattenOptions {
  toggled: Readonly<Record<string, boolean>>;
  open: { host: boolean; project: boolean; agent: boolean };
  statusDots: boolean;
  subagentCount: boolean;
  titleMax: number;
  labels: { loading: string; empty: string; unreachable: string; offline: string };
}

export const DEFAULT_FLATTEN: FlattenOptions = { toggled: {}, open: { host: true, project: true, agent: false }, statusDots: true, subagentCount: true, titleMax: 40, labels: { loading: "Loading…", empty: "No active agents", unreachable: "Host unreachable", offline: "offline" } };

function dotOf(status: NodeStatus): Row["dot"] {
  return status === "running" || status === "attention" || status === "error" ? status : null;
}

export function flattenRows(hosts: readonly HostNode[], options: FlattenOptions = DEFAULT_FLATTEN, agentsPerProject = Infinity): Row[] {
  const rows: Row[] = [];
  const open = (key: string, kind: "host" | "project" | "agent") => options.toggled[key] ?? options.open[kind];
  const label = (text: string) => clip(text, options.titleMax);
  const dot = (status: NodeStatus) => (options.statusDots ? dotOf(status) : null);
  const count = (n: number) => (options.subagentCount ? n : 0);

  for (const host of hosts) {
    const color = host.color;
    const pushChildren = (children: readonly ChildNode[], level: number, serverId: string, parentId: string) => {
      for (const child of children) {
        if (child.kind === "task") {
          rows.push({ key: child.key, level, kind: "task", label: label(child.title), dot: dot(child.status), expandable: false, expanded: false, count: 0, serverId, agentId: parentId, dim: false, color });
        } else pushAgent(child, level, serverId);
      }
    };
    const pushAgent = (agent: AgentNode, level: number, serverId: string) => {
      const expandable = agent.children.length > 0;
      const expanded = expandable && open(agent.key, "agent");
      rows.push({ key: agent.key, level, kind: "agent", label: label(agent.title), dot: dot(agent.status), expandable, expanded, count: count(agent.children.length), serverId, agentId: agent.id, dim: agent.dim, color });
      if (expanded) pushChildren(agent.children, level + 1, serverId, agent.id);
    };

    const hostOpen = open(host.key, "host");
    rows.push({ key: host.key, level: 0, kind: "host", label: label(host.online ? host.label : `${host.label} (${options.labels.offline})`), dot: null, expandable: host.online, expanded: host.online && hostOpen, count: host.projects.length, serverId: host.serverId, agentId: null, dim: !host.online, color });
    if (!host.online || !hostOpen) continue;
    // Jamais de zone vide : une ligne d'état tant qu'il n'y a rien d'autre à montrer.
    if (host.projects.length === 0) {
      rows.push({ key: `${host.key}/state`, level: 1, kind: "task", label: host.loading ? options.labels.loading : host.error ? options.labels.unreachable : options.labels.empty, dot: null, expandable: false, expanded: false, count: 0, serverId: host.serverId, agentId: null, dim: true, color });
    }
    for (const project of host.projects) {
      const projectOpen = open(project.key, "project");
      rows.push({ key: project.key, level: 1, kind: "project", label: label(project.name), dot: null, expandable: true, expanded: projectOpen, count: project.agents.length, serverId: host.serverId, agentId: null, dim: false, color });
      if (!projectOpen) continue;
      for (const agent of project.agents.slice(0, agentsPerProject)) pushAgent(agent, 2, host.serverId);
    }
  }
  return rows;
}

/** Les lignes telles qu'affichées : niveau, libellé, statut. */
export function renderRows(rows: readonly Row[]): string {
  return rows
    .map((r) => `L${r.level} ${"  ".repeat(r.level)}${r.expandable ? (r.expanded ? "v " : "> ") : "  "}${r.label}${r.expandable && !r.expanded && r.kind !== "host" ? ` (${r.count})` : ""}  [${r.dot ?? (r.dim ? "offline" : "-")}]`)
    .join("\n");
}
