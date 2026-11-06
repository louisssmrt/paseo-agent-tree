// Préférences -> options de construction et d'affichage de l'arbre (lecture de chaque réglage).
import { hostColor, type ArbrePrefs } from "./defaults.ts";
import { DEFAULT_FLATTEN, type FlattenOptions, type HostInput, type TreeOptions } from "./tree.ts";

export function treeOptions(prefs: ArbrePrefs): TreeOptions {
  return {
    showTemporary: prefs.showTemporary,
    maxTasksPerAgent: prefs.showSubagents ? prefs.maxSubagents : 0,
    archived: prefs.archived,
    closed: prefs.closed,
    sort: prefs.sort,
    titleMax: prefs.titleMax,
  };
}

export function flattenOptions(prefs: ArbrePrefs, labels?: FlattenOptions["labels"]): FlattenOptions {
  return {
    toggled: prefs.toggled,
    open: { host: prefs.openHosts, project: prefs.openProjects, agent: prefs.openAgents },
    statusDots: prefs.statusDots,
    subagentCount: prefs.subagentCount,
    titleMax: prefs.titleMax,
    labels: labels ?? DEFAULT_FLATTEN.labels,
  };
}

/** Applique nom affiché, couleur et masquage par machine. */
export function decorateHosts(inputs: readonly HostInput[], prefs: ArbrePrefs, selfId?: string | null): HostInput[] {
  const primary = selfId ?? inputs[0]?.serverId ?? null;
  return inputs
    .filter((input) => !prefs.hosts[input.serverId]?.hidden)
    .map((input) => ({
      ...input,
      label: prefs.hosts[input.serverId]?.name?.trim() || input.label,
      color: hostColor(prefs, input.serverId, primary),
    }));
}
