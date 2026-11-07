import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useHosts } from "@getpaseo/plugin/client";
import { SettingsAction, SettingsCard, SettingsInput, SettingsRow, SettingsSection, SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { DEFAULT_PREFS, hostColor, PALETTE } from "../shared/prefs";
import { useT } from "./i18n";
import { useArbrePrefs } from "./prefs";
import { useHostLabels } from "./tree-screen";
import { isWeb } from "./web";

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange(value: boolean): void }) {
  return <SettingsSwitch label={label} {...(hint ? { hint } : {})} value={value} onValueChange={onChange} />;
}

/** Page de réglages : Réglages > Plugins > Arbre d'agents. Chaque réglage agit sur l'arbre en direct. */
export function ArbreSettings({ theme }: PluginSurfaceProps) {
  const { prefs, persisted, setPrefs, setHost } = useArbrePrefs();
  const hosts = useHosts();
  const t = useT();
  const { labels, selfId } = useHostLabels(hosts.filter((h) => h.status === "online").map((h) => h.serverId).sort());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  const rename = (serverId: string, text: string) => {
    clearTimeout(timers.current.get(serverId));
    timers.current.set(serverId, setTimeout(() => setHost(serverId, { name: text.trim() }), 500));
  };

  const s = useMemo(
    () => ({
      swatches: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, paddingVertical: 8, paddingHorizontal: 12 },
      swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
      preview: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
      bar: { width: 3, height: 18, borderRadius: 2 },
      previewText: { color: theme.colors.foreground, fontSize: 13 },
      note: { color: theme.colors.foregroundMuted, fontSize: 12, paddingHorizontal: 12, paddingVertical: 6 },
    }),
    [theme],
  );

  const number = (label: string, value: number, options: readonly number[], onChange: (n: number) => void, hint?: string) => (
    <SettingsSelect label={label} {...(hint ? { hint } : {})} value={String(value)} options={options.map((n) => ({ label: String(n), value: String(n) }))} onValueChange={(v) => onChange(Number(v))} />
  );

  return (
    <ScrollView>
      <View style={{ gap: 16, padding: 4 }}>
        {persisted ? null : <Text style={s.note}>{t("memoryOnly")}</Text>}

        <SettingsSection title={t("machines")}>
          <SettingsCard>
            {hosts.map((host) => {
              const entry = prefs.hosts[host.serverId] ?? {};
              const color = hostColor(prefs, host.serverId, selfId ?? hosts[0]?.serverId);
              const name = entry.name?.trim() || labels.get(host.serverId) || host.label;
              return (
                <View key={host.serverId}>
                  <SettingsInput label={t("nameDisplayed", { original: labels.get(host.serverId) ?? host.label })} hint={t("nameHint")} initialValue={entry.name ?? ""} placeholder={labels.get(host.serverId) ?? host.label} onChangeText={(t) => rename(host.serverId, t)} />
                  <SettingsRow label={t("color")}>
                    <View style={s.swatches}>
                      {PALETTE.map((p) => (
                        <Pressable key={p.color} accessibilityRole="button" accessibilityLabel={t("colorFor", { color: p.name, name })} accessibilityState={{ selected: p.color === color }} onPress={() => setHost(host.serverId, { color: p.color })} style={[s.swatch, { backgroundColor: p.color, borderColor: p.color === color ? theme.colors.foreground : "transparent" }]} />
                      ))}
                    </View>
                  </SettingsRow>
                  <View style={s.preview}>
                    <View style={[s.bar, { backgroundColor: color }]} />
                    <Text style={s.previewText}>{name}</Text>
                  </View>
                  <Toggle label={t("hideMachine")} value={entry.hidden === true} onChange={(v) => setHost(host.serverId, { hidden: v })} />
                  <SettingsAction label={t("resetColor")} actionLabel={t("reset")} onPress={() => setHost(host.serverId, { color: undefined })} />
                </View>
              );
            })}
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t("display")}>
          <SettingsCard>
            <Toggle label={t("treeInSidebar")} hint={t("sidebarTreeHint")} value={prefs.sidebarTree} onChange={(v) => setPrefs({ sidebarTree: v })} />
            {isWeb ? <Toggle label={t("replaceNative")} hint={t("replaceNativeHint")} value={prefs.replaceNative} onChange={(v) => setPrefs({ replaceNative: v })} /> : null}
            {number(t("topMargin"), prefs.topMargin, [0, 8, 16, 24, 32], (n) => setPrefs({ topMargin: n }))}
            {number(t("titleMax"), prefs.titleMax, [30, 40, 60], (n) => setPrefs({ titleMax: n }))}
            <Toggle label={t("statusDots")} value={prefs.statusDots} onChange={(v) => setPrefs({ statusDots: v })} />
            <Toggle label={t("subagentCount")} value={prefs.subagentCount} onChange={(v) => setPrefs({ subagentCount: v })} />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t("content")}>
          <SettingsCard>
            <Toggle label={t("tmpFolders")} hint={t("tmpHint")} value={prefs.showTemporary} onChange={(v) => setPrefs({ showTemporary: v })} />
            <Toggle label={t("subagents")} hint={t("subagentsHint")} value={prefs.showSubagents} onChange={(v) => setPrefs({ showSubagents: v })} />
            {number(t("maxSubagents"), prefs.maxSubagents, [5, 10, 20, 50], (n) => setPrefs({ maxSubagents: n }))}
            <SettingsSelect label={t("archived")} value={prefs.archived} options={[{ label: t("hidden"), value: "hide" }, { label: t("dimmed"), value: "dim" }]} onValueChange={(v) => setPrefs({ archived: v })} />
            <SettingsSelect label={t("closed")} value={prefs.closed} options={[{ label: t("hidden"), value: "hide" }, { label: t("dimmed"), value: "dim" }, { label: t("normal"), value: "show" }]} onValueChange={(v) => setPrefs({ closed: v })} />
            <SettingsSelect label={t("sort")} value={prefs.sort} options={[{ label: t("recent"), value: "recent" }, { label: t("byName"), value: "name" }]} onValueChange={(v) => setPrefs({ sort: v })} />
          </SettingsCard>
        </SettingsSection>

        <SettingsSection title={t("defaultOpen")}>
          <SettingsCard>
            <Toggle label={t("hostsOpen")} value={prefs.openHosts} onChange={(v) => setPrefs({ openHosts: v })} />
            <Toggle label={t("projectsOpen")} value={prefs.openProjects} onChange={(v) => setPrefs({ openProjects: v })} />
            <Toggle label={t("agentsOpen")} value={prefs.openAgents} onChange={(v) => setPrefs({ openAgents: v })} />
            <SettingsAction label={t("forgetToggles")} actionLabel={t("reset")} onPress={() => setPrefs({ toggled: {} })} />
            <SettingsAction label={t("allDefaults")} actionLabel={t("defaultValues")} onPress={() => setPrefs({ ...DEFAULT_PREFS, hosts: prefs.hosts, toggled: prefs.toggled })} />
          </SettingsCard>
        </SettingsSection>
        <SettingsSection title={t("demoSection")}>
          <SettingsCard>
            <Toggle label={t("demoData")} hint={t("demoHint")} value={prefs.demo} onChange={(v) => setPrefs({ demo: v })} />
          </SettingsCard>
        </SettingsSection>
      </View>
    </ScrollView>
  );
}

