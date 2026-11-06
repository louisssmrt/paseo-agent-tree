import { getPaseoClient } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAgents, fetchTaskCalls, fetchWorkspaces } from "../shared/collect";
import type { HostInput, RawAgent, RawTaskCall, RawWorkspace } from "../shared/tree";
import type { PaseoApi } from "./types";

const BACKSTOP_MS = 30_000;
/** Agents dont on lit la timeline pour y trouver les sous-agents : les plus récents seulement. */
const TASK_AGENTS_MAX = 40;
const TASK_CONCURRENCY = 3;

export interface HostSnapshot {
  agents: RawAgent[];
  workspaces: RawWorkspace[];
  taskCalls: Map<string, readonly RawTaskCall[]>;
  error: string | null;
}

export interface FeedOptions {
  /** Lire aussi les agents archivés (affichés grisés). */
  includeArchived: boolean;
  /** Lire les timelines pour y trouver les sous-agents Claude Code. */
  fetchTasks: boolean;
}

export interface HostRef {
  serverId: string;
  label: string;
  online: boolean;
}

const EMPTY: HostSnapshot = { agents: [], workspaces: [], taskCalls: new Map(), error: null };

function time(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Suit en direct un hôte : agents, espaces, et sous-agents Claude Code lus dans les timelines. */
class HostController {
  private alive = true;
  private agents = new Map<string, RawAgent>();
  private workspaces: RawWorkspace[] = [];
  private taskCalls = new Map<string, readonly RawTaskCall[]>();
  private taskVersion = new Map<string, string>();
  private queue: string[] = [];
  private inFlight = 0;
  private error: string | null = null;
  private subscribedApi: PaseoApi | null = null;
  private stopAgents: (() => void) | null = null;
  private releaseList: (() => unknown) | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private publishTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly serverId: string,
    private readonly onChange: (serverId: string, snapshot: HostSnapshot) => void,
    private readonly options: FeedOptions,
  ) {}

  start(): void {
    void this.cycle();
    this.interval = setInterval(() => void this.cycle(), BACKSTOP_MS);
  }

  stop(): void {
    this.alive = false;
    if (this.interval) clearInterval(this.interval);
    if (this.publishTimer) clearTimeout(this.publishTimer);
    this.stopAgents?.();
    void Promise.resolve(this.releaseList?.()).catch(() => {});
  }

  private publish(): void {
    if (!this.alive || this.publishTimer) return;
    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      if (!this.alive) return;
      this.onChange(this.serverId, {
        agents: [...this.agents.values()],
        workspaces: this.workspaces,
        taskCalls: new Map(this.taskCalls),
        error: this.error,
      });
    }, 150);
  }

  private candidates(): RawAgent[] {
    return [...this.agents.values()]
      .filter((a) => !a.archivedAt)
      .sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
      .slice(0, TASK_AGENTS_MAX);
  }

  private versionOf(agent: RawAgent): string {
    return `${agent.updatedAt ?? ""}:${agent.status}`;
  }

  private scheduleTasks(agents: readonly RawAgent[]): void {
    if (!this.options.fetchTasks) return;
    for (const agent of agents) {
      if (this.taskVersion.get(agent.id) === this.versionOf(agent) || this.queue.includes(agent.id)) continue;
      this.queue.push(agent.id);
    }
    this.pump();
  }

  private pump(): void {
    while (this.alive && this.inFlight < TASK_CONCURRENCY && this.queue.length > 0) {
      const id = this.queue.shift()!;
      const agent = this.agents.get(id);
      if (!agent) continue;
      const version = this.versionOf(agent);
      this.inFlight += 1;
      void (async () => {
        try {
          const calls = await fetchTaskCalls(getPaseoClient(this.serverId), id);
          if (!this.alive) return;
          this.taskVersion.set(id, version);
          this.taskCalls.set(id, calls);
          this.publish();
        } catch {
          // Timeline illisible (agent fermé, hôte coupé) : on réessaiera au prochain cycle.
        } finally {
          this.inFlight -= 1;
          this.pump();
        }
      })();
    }
  }

  private onAgent = (update: any): void => {
    if (update.kind === "remove") {
      if (!this.agents.delete(update.agentId)) return;
    } else if (update.agent.archivedAt && !this.options.includeArchived) {
      if (!this.agents.delete(update.agent.id)) return;
    } else {
      this.agents.set(update.agent.id, update.agent as RawAgent);
      if (!this.workspaces.some((w) => w.id === update.agent.workspaceId)) void this.refreshWorkspaces();
      this.scheduleTasks(this.candidates().filter((a) => a.id === update.agent.id));
    }
    this.publish();
  };

  private async refreshWorkspaces(): Promise<void> {
    try {
      this.workspaces = await fetchWorkspaces(getPaseoClient(this.serverId));
      this.publish();
    } catch {
      // Le prochain cycle réessaie.
    }
  }

  // agents.subscribe n'entend que ce qu'un list(subscribe) a ouvert : sans lui, aucune mise à jour.
  private subscribe(api: PaseoApi): void {
    this.stopAgents?.();
    void Promise.resolve(this.releaseList?.()).catch(() => {});
    this.subscribedApi = api;
    this.stopAgents = api.agents.subscribe(this.onAgent);
    void api.agents
      .list({ filter: { includeArchived: this.options.includeArchived }, page: { limit: 1 }, subscribe: {} })
      .then((result) => {
        const mine = result.subscription;
        if (!mine) return;
        if (!this.alive || this.subscribedApi !== api) {
          void mine.release().catch(() => {});
          return;
        }
        this.releaseList = () => mine.release();
        mine.subscribe({
          snapshot() {},
          update() {},
          error: () => {
            if (this.subscribedApi === api) this.subscribedApi = null;
          },
        });
      })
      .catch(() => {
        if (this.subscribedApi === api) this.subscribedApi = null;
      });
  }

  private async cycle(): Promise<void> {
    try {
      const api = getPaseoClient(this.serverId);
      const [agents, workspaces] = await Promise.all([fetchAgents(api as never, this.options.includeArchived), fetchWorkspaces(api as never)]);
      if (!this.alive) return;
      this.agents = new Map(agents.map((a) => [a.id, a]));
      this.workspaces = workspaces;
      this.error = null;
      if (this.subscribedApi !== api) this.subscribe(api);
      this.scheduleTasks(this.candidates());
    } catch (cause) {
      this.error = cause instanceof Error ? cause.message : String(cause);
      this.subscribedApi = null;
    }
    this.publish();
  }
}

/** Données de tous les hôtes configurés, prêtes pour buildTree. Un hôte hors ligne reste listé, vide. */
export function useHostInputs(hosts: readonly HostRef[], options: FeedOptions): HostInput[] {
  const [snapshots, setSnapshots] = useState<ReadonlyMap<string, HostSnapshot>>(() => new Map());
  const onChange = useRef((serverId: string, snapshot: HostSnapshot) => {
    setSnapshots((current) => new Map(current).set(serverId, snapshot));
  });

  const { includeArchived, fetchTasks } = options;
  const onlineKey = hosts
    .filter((h) => h.online)
    .map((h) => h.serverId)
    .sort()
    .join(",");

  useEffect(() => {
    const ids = onlineKey ? onlineKey.split(",") : [];
    const controllers = ids.map((id) => new HostController(id, onChange.current, { includeArchived, fetchTasks }));
    controllers.forEach((c) => c.start());
    return () => controllers.forEach((c) => c.stop());
  }, [onlineKey, includeArchived, fetchTasks]);

  return useMemo(
    () =>
      hosts.map((host) => {
        const known = snapshots.get(host.serverId);
        const snapshot = host.online ? (known ?? EMPTY) : EMPTY;
        return {
          serverId: host.serverId,
          label: host.label,
          online: host.online,
          agents: snapshot.agents,
          workspaces: snapshot.workspaces,
          taskCalls: snapshot.taskCalls,
          error: snapshot.error,
          loading: host.online && !known,
        };
      }),
    [hosts, snapshots],
  );
}
