import { getPaseoClient, useHosts, type PluginScreenProps } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { decorateHosts, flattenOptions, treeOptions } from "../shared/options";
import { buildTree, flattenRows, type HostNode, type Row } from "../shared/tree";
import { useHostInputs } from "./feed";
import { useArbrePrefs } from "./prefs";
import { useT } from "./i18n";
import { Rows } from "./rows";
import { isWeb } from "./web";

/**
 * Noms d'hôtes tels qu'enregistrés, lus dans le répertoire d'un hôte en ligne : useHosts() rend le
 * nom réseau brut de la machine quand elle est hors ligne. Rend aussi l'identifiant de la machine locale.
 */
export function useHostLabels(online: readonly string[]): { labels: ReadonlyMap<string, string>; selfId: string | null } {
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [selfId, setSelfId] = useState<string | null>(null);
  const key = online.join(",");
  useEffect(() => {
    const first = key.split(",")[0];
    if (!first) return;
    let alive = true;
    const read = async () => {
      try {
        const directory: any = await getPaseoClient(first).hosts.list();
        if (!alive) return;
        const next = new Map<string, string>();
        if (directory.self?.serverId && directory.self.label) next.set(directory.self.serverId, directory.self.label);
        for (const host of directory.hosts ?? []) if (host.serverId && host.label) next.set(host.serverId, host.label);
        setLabels(next);
        setSelfId(directory.self?.serverId ?? null);
      } catch {
        // On garde les derniers noms connus.
      }
    };
    void read();
    const timer = setInterval(() => void read(), 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [key]);
  return { labels, selfId };
}

/** Libellés de lignes d'état traduits. */
export function rowLabels(t: ReturnType<typeof useT>) {
  return { loading: t("loading"), empty: t("empty"), unreachable: t("unreachable"), offline: t("offline") };
}

/** Données + préférences + arbre construit : partagé par l'écran et la barre latérale. */
export function useArbre() {
  const hosts = useHosts();
  const { prefs, persisted, setOpen, setShowTemporary, setSidebarTree, setReplaceNative } = useArbrePrefs();
  const onlineIds = useMemo(() => hosts.filter((h) => h.status === "online").map((h) => h.serverId).sort(), [hosts]);
  const { labels, selfId } = useHostLabels(onlineIds);
  const refs = useMemo(
    () => hosts.map((h) => ({ serverId: h.serverId, label: labels.get(h.serverId) ?? h.label, online: h.status === "online" })),
    [hosts, labels],
  );
  const inputs = useHostInputs(refs, { includeArchived: prefs.archived === "dim", fetchTasks: prefs.showSubagents });
  const tree = useMemo<HostNode[]>(() => buildTree(decorateHosts(inputs, prefs, selfId), treeOptions(prefs)), [inputs, prefs, selfId]);
  return { tree, prefs, persisted, setOpen, setShowTemporary, setSidebarTree, setReplaceNative };
}

export function Arbre({ theme, layout, navigation }: PluginScreenProps) {
  const { tree, prefs, persisted, setOpen, setShowTemporary, setSidebarTree, setReplaceNative } = useArbre();
  const t = useT();
  const rows = useMemo(() => flattenRows(tree, flattenOptions(prefs, rowLabels(t))), [tree, prefs, t]);
  const hidden = tree.reduce((n, h) => n + h.hiddenAgents, 0);
  const errors = tree.flatMap((h) => (h.error ? [`${h.label} : ${h.error}`] : []));

  const s = useMemo(
    () => ({
      screen: { flex: 1, backgroundColor: theme.colors.surface0 },
      content: { padding: layout.compact ? 8 : 16, gap: 8 },
      toolbar: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, alignItems: "center" as const },
      chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border },
      chipOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
      chipText: { color: theme.colors.foreground, fontSize: 12 },
      chipTextOn: { color: theme.colors.accentForeground, fontSize: 12 },
      note: { color: theme.colors.foregroundMuted, fontSize: 12 },
      err: { color: theme.colors.statusDanger, fontSize: 12 },
    }),
    [theme, layout.compact],
  );

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress} style={[s.chip, on ? s.chipOn : null]}>
      <Text style={on ? s.chipTextOn : s.chipText}>{label}</Text>
    </Pressable>
  );

  const toggle = (row: Row) => setOpen(row.key, !row.expanded);
  const press = (row: Row) => {
    if (row.kind === "task" && !row.agentId) return;
    if (row.agentId) navigation?.openAgent({ agentId: row.agentId, serverId: row.serverId });
    else toggle(row);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.toolbar}>
        {chip(t("showTemp"), prefs.showTemporary, () => setShowTemporary(!prefs.showTemporary))}
        {isWeb ? chip(t("replaceNative"), prefs.replaceNative, () => setReplaceNative(!prefs.replaceNative)) : null}
        {chip(t("treeInSidebar"), prefs.sidebarTree, () => setSidebarTree(!prefs.sidebarTree))}
      </View>
      {persisted ? null : <Text style={s.note}>{t("memoryOnly")}</Text>}
      {errors.map((e) => (
        <Text key={e} style={s.err} numberOfLines={2}>
          {e}
        </Text>
      ))}
      <Rows rows={rows} theme={theme} height={layout.compact ? 40 : 30} onToggle={toggle} onPress={press} />
      {hidden > 0 ? <Text style={s.note}>{t("hiddenNote", { count: hidden })}</Text> : null}
    </ScrollView>
  );
}

/** Écran relais : la barre latérale n'a pas `navigation`, un écran oui. Ouvre l'agent demandé. */
export function Ouvrir({ theme, params, navigation }: PluginScreenProps) {
  const t = useT();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !navigation || !params.agentId) return;
    done.current = true;
    navigation.openAgent({ agentId: params.agentId, ...(params.serverId ? { serverId: params.serverId } : {}) });
  }, [navigation, params.agentId, params.serverId]);
  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: theme.colors.surface0 }}>
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: 14 }}>
        {navigation ? t("opening") : t("cannotOpen")}
      </Text>
    </View>
  );
}
