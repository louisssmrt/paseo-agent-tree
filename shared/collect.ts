// Collecte des données d'un hôte à partir d'un PaseoApi (client du plugin ou client Node du test).
import type { RawAgent, RawTaskCall, RawWorkspace } from "./tree";

/** La partie de PaseoApi que la collecte utilise (structurelle : le vrai PaseoApi la satisfait). */
export interface ApiLike {
  agents: {
    list(options?: any): Promise<{
      entries: Array<{ agent: any }>;
      pageInfo: { hasMore?: boolean; nextCursor?: string | null };
    }>;
    ref(id: string): {
      timeline: { refetch(options?: any): Promise<{ entries: Array<{ item: any; timestamp?: string }> }> };
    };
  };
  workspaces: {
    list(options?: any): Promise<{
      entries: any[];
      pageInfo: { hasMore?: boolean; nextCursor?: string | null };
    }>;
  };
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

export async function fetchAgents(api: ApiLike, includeArchived = false): Promise<RawAgent[]> {
  const out = new Map<string, RawAgent>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await api.agents.list({
      filter: { includeArchived },
      sort: [{ key: "updated_at", direction: "desc" }],
      page: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) },
    });
    for (const entry of result.entries) out.set(entry.agent.id, entry.agent as RawAgent);
    if (!result.pageInfo.hasMore || !result.pageInfo.nextCursor) break;
    cursor = result.pageInfo.nextCursor;
  }
  return [...out.values()];
}

export async function fetchWorkspaces(api: ApiLike): Promise<RawWorkspace[]> {
  const out = new Map<string, RawWorkspace>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await api.workspaces.list({ page: { limit: PAGE_LIMIT, ...(cursor ? { cursor } : {}) } });
    for (const workspace of result.entries) out.set(workspace.id, workspace as RawWorkspace);
    if (!result.pageInfo.hasMore || !result.pageInfo.nextCursor) break;
    cursor = result.pageInfo.nextCursor;
  }
  return [...out.values()];
}

const TASK_TOOLS = new Set(["Agent", "Task"]);

/**
 * Sous-agents Claude Code d'un agent : appels d'outil `Agent` / `Task` (détail `sub_agent`)
 * lus dans la fin de sa timeline. `SendMessage` partage le même détail mais n'en lance pas.
 */
export async function fetchTaskCalls(api: ApiLike, agentId: string, tail = 300): Promise<RawTaskCall[]> {
  const page = await api.agents.ref(agentId).timeline.refetch({ direction: "tail", limit: tail, projection: "projected" });
  const calls = new Map<string, RawTaskCall>();
  for (const entry of page.entries) {
    const item = entry.item;
    if (!item || item.type !== "tool_call" || !TASK_TOOLS.has(item.name)) continue;
    if (item.detail?.type !== "sub_agent") continue;
    const description = String(item.detail.description ?? "").trim();
    calls.set(item.callId, {
      callId: String(item.callId),
      description,
      subAgentType: typeof item.detail.subAgentType === "string" ? item.detail.subAgentType : null,
      status: String(item.status ?? "completed"),
      timestamp: entry.timestamp ?? null,
    });
  }
  return [...calls.values()];
}
