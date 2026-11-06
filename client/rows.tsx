import type { PluginHostProps } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { memo, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Row } from "../shared/tree";
import { useT } from "./i18n";

const INDENT = 14;
const FONT = 13;

type Theme = PluginHostProps["theme"];

function dotColor(theme: Theme, dot: NonNullable<Row["dot"]>): string {
  return dot === "running" ? theme.colors.statusSuccess : dot === "attention" ? theme.colors.statusWarning : theme.colors.statusDanger;
}


interface RowViewProps {
  row: Row;
  theme: Theme;
  height: number;
  /** Ligne qui porte l'engrenage (la première machine). */
  gear: boolean;
  /** Engrenage toujours visible (mobile) ; sinon au survol seulement. */
  gearAlways: boolean;
  onToggle(row: Row): void;
  onPress(row: Row): void;
  onSettings?: ((row: Row) => void) | undefined;
}

function RowView({ row, theme, height, gear, gearAlways, onToggle, onPress, onSettings }: RowViewProps) {
  const [hover, setHover] = useState(false);
  const t = useT();
  const dotWord = { running: t("dotRunning"), attention: t("dotAttention"), error: t("dotError") } as const;
  // Clic droit (web) et appui long (tactile) sur une machine : réglages de cette machine.
  const hostMenu =
    row.kind === "host" && onSettings
      ? {
          onLongPress: () => onSettings(row),
          ...({ onContextMenu: (event: { preventDefault?: () => void }) => { event.preventDefault?.(); onSettings(row); } } as object),
        }
      : {};
  const s = useMemo(
    () => ({
      row: { flexDirection: "row" as const, alignItems: "center" as const, height, paddingLeft: 6 + row.level * INDENT, paddingRight: 10, opacity: row.dim ? 0.5 : 1 },
      chev: { width: 20, height, alignItems: "center" as const, justifyContent: "center" as const },
      chevText: { color: theme.colors.foregroundMuted, fontSize: 12 },
      label: { color: row.kind === "host" && row.color ? row.color : row.kind === "task" ? theme.colors.foregroundMuted : theme.colors.foreground, fontSize: FONT, fontWeight: row.kind === "host" ? ("600" as const) : ("400" as const) },
      press: { flex: 1, height, justifyContent: "center" as const },
      count: { color: theme.colors.foregroundMuted, fontSize: 11, marginLeft: 6 },
      dot: { width: 7, height: 7, borderRadius: 4, marginLeft: 8 },
      gear: { width: 26, height, alignItems: "center" as const, justifyContent: "center" as const },
    }),
    [theme, height, row.level, row.dim, row.kind, row.color],
  );
  return (
    <View style={s.row} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      {row.expandable ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t(row.expanded ? "collapse" : "expand", { label: row.label })} hitSlop={4} onPress={() => onToggle(row)} style={s.chev}>
          <Text style={s.chevText}>{row.expanded ? "▾" : "▸"}</Text>
        </Pressable>
      ) : (
        <View style={s.chev} />
      )}
      <Pressable accessibilityRole="button" accessibilityLabel={`${row.label}${row.dot ? `, ${dotWord[row.dot]}` : ""}`} onPress={() => onPress(row)} style={s.press} {...hostMenu}>
        <Text style={s.label} numberOfLines={1} ellipsizeMode="tail">
          {row.label}
        </Text>
      </Pressable>
      {row.expandable && !row.expanded && row.kind !== "host" && row.count > 0 ? <Text style={s.count}>{row.count}</Text> : null}
      {gear && onSettings ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t("treeSettings")} hitSlop={6} onPress={() => onSettings(row)} style={[s.gear, { opacity: gearAlways || hover ? 0.8 : 0 }]}>
          <Icon name="Settings" size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
      ) : null}
      {row.dot ? <View style={[s.dot, { backgroundColor: dotColor(theme, row.dot) }]} /> : null}
    </View>
  );
}

const Memo = memo(RowView);

/** L'arbre à plat : même rendu dans la barre latérale et dans l'écran. */
export function Rows({
  rows,
  theme,
  height = 28,
  gearAlways = false,
  onToggle,
  onPress,
  onSettings,
}: {
  rows: readonly Row[];
  theme: Theme;
  height?: number;
  gearAlways?: boolean;
  onToggle(row: Row): void;
  onPress(row: Row): void;
  onSettings?: (row: Row) => void;
}) {
  const firstHost = rows.find((r) => r.kind === "host")?.key;
  return (
    <View>
      {rows.map((row) => (
        <Memo key={row.key} row={row} theme={theme} height={height} gear={row.key === firstHost} gearAlways={gearAlways} onToggle={onToggle} onPress={onPress} onSettings={onSettings} />
      ))}
    </View>
  );
}
