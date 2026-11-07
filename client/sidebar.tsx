import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useMemo } from "react";
import { Text, View } from "react-native";
import { flattenOptions } from "../shared/options";
import { flattenRows, type Row } from "../shared/tree";
import { ArbrePopover } from "./popover";
import { Rows } from "./rows";
import { useT } from "./i18n";
import { DemoBanner, rowLabels, useArbre } from "./tree-screen";
import { useNativeHidden } from "./web";

const AGENTS_PER_PROJECT = 8;

/** Arbre dessiné par nos soins (View/Text) : SidebarRow n'indente pas et coupe les libellés longs. */
export function ArbreItem({ theme, layout, openScreen, openPopover }: PluginSidebarItemProps) {
  const { tree, toggled, prefs, setOpen } = useArbre();
  const t = useT();
  // Liste native masquée : l'arbre prend toute la place, sans plafond par projet.
  const replaced = useNativeHidden() && prefs.replaceNative;
  const rows = useMemo(() => flattenRows(tree, { ...flattenOptions(prefs, rowLabels(t)), toggled }, replaced ? Infinity : AGENTS_PER_PROJECT), [tree, toggled, prefs, replaced, t]);
  const toggle = (row: Row) => setOpen(row.key, !row.expanded);
  const press = (row: Row) => {
    if (row.kind === "task" && !row.agentId) return;
    if (prefs.demo) {
      if (!row.agentId) toggle(row); // démo : un agent ne s'ouvre pas
      return;
    }
    if (row.agentId) openScreen({ screenId: "open", params: { serverId: row.serverId, agentId: row.agentId } });
    else toggle(row);
  };
  // Popover du SDK (ancré à l'item sur bureau, feuille du bas sur mobile) : engrenage, clic droit ou appui long sur une machine.
  const settings = (row: Row) => {
    const focusHost = row.kind === "host" ? row.serverId : undefined;
    openPopover((props) => <ArbrePopover {...props} focusHost={focusHost} />);
  };
  // testID "arbre-root" : repère que le CSS de web.ts utilise pour placer l'arbre en dernier et le laisser défiler.
  return (
    <View testID="agent-tree-root" style={{ marginTop: prefs.topMargin, paddingTop: 6, paddingBottom: 4, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
      {prefs.demo ? <DemoBanner theme={theme} /> : null}
      {rows.length === 0 ? (
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13, paddingHorizontal: 12, paddingVertical: 6 }}>{t("loading")}</Text>
      ) : (
        <Rows rows={rows} theme={theme} gearAlways={layout.compact} onToggle={toggle} onPress={press} onSettings={settings} />
      )}
    </View>
  );
}

/** Variante sobre : une seule ligne qui ouvre l'écran. */
export function ArbreLink({ currentScreen, openScreen }: PluginSidebarItemProps) {
  const t = useT();
  return <SidebarRow icon="ListTree" label={t("title")} active={currentScreen?.screenId === "tree"} onPress={() => openScreen({ screenId: "tree" })} />;
}
