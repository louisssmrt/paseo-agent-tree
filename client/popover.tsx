import type { PluginPopoverProps } from "@getpaseo/plugin/client";
import { useHosts } from "@getpaseo/plugin/client";
import { SettingsAction, SettingsCard, SettingsInput, SettingsRow, SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { hostColor, PALETTE } from "../shared/defaults";
import { HexColorField } from "./hex-color";
import { useT } from "./i18n";
import { useArbrePrefs } from "./prefs";
import { useHostLabels } from "./tree-screen";
import { isWeb } from "./web";

/**
 * Réglages rapides, ouverts depuis l'arbre (engrenage, clic droit ou appui long sur une machine).
 * Même magasin que la page complète : l'arbre derrière se met à jour à chaque changement.
 * `focusHost` met la machine visée en premier.
 */
export function ArbrePopover({ theme, layout, close, openScreen, focusHost }: PluginPopoverProps & { focusHost?: string | undefined }) {
  const { prefs, setPrefs, setHost } = useArbrePrefs();
  const hosts = useHosts();
  const t = useT();
  const { labels, selfId } = useHostLabels(hosts.filter((h) => h.status === "online").map((h) => h.serverId).sort());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const rename = (serverId: string, text: string) => {
    clearTimeout(timers.current.get(serverId));
    timers.current.set(serverId, setTimeout(() => setHost(serverId, { name: text.trim() }), 400));
  };
  const ordered = useMemo(() => [...hosts].sort((a, b) => Number(b.serverId === focusHost) - Number(a.serverId === focusHost)), [hosts, focusHost]);

  const s = useMemo(
    () => ({
      box: { width: layout.compact ? undefined : 340, maxHeight: layout.compact ? 560 : 520, backgroundColor: theme.colors.surface1 },
      head: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 12, paddingVertical: 8 },
      title: { color: theme.colors.foreground, fontSize: 14, fontWeight: "600" as const },
      close: { width: 28, height: 28, alignItems: "center" as const, justifyContent: "center" as const },
      closeText: { color: theme.colors.foregroundMuted, fontSize: 16 },
      group: { color: theme.colors.foregroundMuted, fontSize: 11, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4, textTransform: "uppercase" as const },
      swatches: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, paddingVertical: 6, paddingHorizontal: 12 },
      swatch: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
    }),
    [theme, layout.compact],
  );
  const num = (label: string, value: number, options: readonly number[], on: (n: number) => void) => (
    <SettingsSelect label={label} value={String(value)} options={options.map((n) => ({ label: String(n), value: String(n) }))} onValueChange={(v) => on(Number(v))} />
  );

  return (
    <View style={s.box}>
      <View style={s.head}>
        <Text style={s.title}>{t("title")}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("close")} onPress={close} hitSlop={6} style={s.close}>
          <Text style={s.closeText}>×</Text>
        </Pressable>
      </View>
      <ScrollView>
        <Text style={s.group}>{t("machines")}</Text>
        {ordered.map((host) => {
          const entry = prefs.hosts[host.serverId] ?? {};
          const color = hostColor(prefs, host.serverId, selfId ?? hosts[0]?.serverId);
          const original = labels.get(host.serverId) ?? host.label;
          return (
            <SettingsCard key={host.serverId}>
              <SettingsInput label={t("name", { original })} initialValue={entry.name ?? ""} placeholder={original} onChangeText={(t) => rename(host.serverId, t)} />
              <SettingsRow label={t("color")}>
                <View style={s.swatches}>
                  {PALETTE.map((p) => (
                    <Pressable key={p.color} accessibilityRole="button" accessibilityLabel={t("colorFor", { color: p.name, name: entry.name || original })} accessibilityState={{ selected: p.color === color }} onPress={() => setHost(host.serverId, { color: p.color })} style={[s.swatch, { backgroundColor: p.color, borderColor: p.color === color ? theme.colors.foreground : "transparent" }]} />
                  ))}
                </View>
              </SettingsRow>
              <HexColorField value={color} theme={theme} onChange={(c) => setHost(host.serverId, { color: c })} />
              <SettingsSwitch label={t("hideMachine")} value={entry.hidden === true} onValueChange={(v) => setHost(host.serverId, { hidden: v })} />
            </SettingsCard>
          );
        })}
        <Text style={s.group}>{t("display")}</Text>
        <SettingsCard>
          {isWeb ? <SettingsSwitch label={t("replaceNative")} value={prefs.replaceNative} onValueChange={(v) => setPrefs({ replaceNative: v })} /> : null}
          <SettingsSwitch label={t("tmpFolders")} value={prefs.showTemporary} onValueChange={(v) => setPrefs({ showTemporary: v })} />
          <SettingsSwitch label={t("subagents")} value={prefs.showSubagents} onValueChange={(v) => setPrefs({ showSubagents: v })} />
          {num(t("titleMax"), prefs.titleMax, [30, 40, 60], (n) => setPrefs({ titleMax: n }))}
          <SettingsSwitch label={t("statusDots")} value={prefs.statusDots} onValueChange={(v) => setPrefs({ statusDots: v })} />
          <SettingsSwitch label={t("subagentCount")} value={prefs.subagentCount} onValueChange={(v) => setPrefs({ subagentCount: v })} />
          {num(t("topMargin"), prefs.topMargin, [0, 8, 16, 24, 32], (n) => setPrefs({ topMargin: n }))}
        </SettingsCard>
        <SettingsCard>
          <SettingsAction
            label={t("allSettings")}
            actionLabel={t("open")}
            onPress={() => {
              close();
              openScreen({ screenId: "settings" });
            }}
          />
        </SettingsCard>
      </ScrollView>
    </View>
  );
}
