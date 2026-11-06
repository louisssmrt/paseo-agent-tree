import type { PluginHostProps } from "@getpaseo/plugin/client";
import { createElement, useEffect, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { useT } from "./i18n";
import { isWeb } from "./web";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#abc" ou "abc" -> "#aabbcc" ; null si ce n'est pas une couleur hexadécimale. */
export function normalizeHex(text: string): string | null {
  const m = HEX.exec(text.trim());
  if (!m || !m[1]) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

interface HexColorFieldProps {
  value: string;
  theme: PluginHostProps["theme"];
  onChange(color: string): void;
}

/**
 * Couleur libre : sélecteur natif du navigateur (desktop/web) + saisie hexadécimale (partout).
 * Chaque valeur valide s'applique tout de suite ; une saisie invalide reste affichée en rouge sans rien changer.
 */
export function HexColorField({ value, theme, onChange }: HexColorFieldProps) {
  const t = useT();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const valid = normalizeHex(text) !== null;
  const s = useMemo(
    () => ({
      row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
      input: {
        flex: 1,
        height: 30,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: valid ? theme.colors.border : theme.colors.statusDanger,
        color: theme.colors.foreground,
        fontSize: 13,
        fontFamily: "monospace",
      },
      preview: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: normalizeHex(text) ?? value },
    }),
    [theme, valid, text, value],
  );
  const commit = (t: string) => {
    setText(t);
    const hex = normalizeHex(t);
    if (hex) onChange(hex);
  };
  return (
    <View style={s.row}>
      {isWeb
        ? createElement("input", {
            type: "color",
            value: normalizeHex(text) ?? value,
            "aria-label": t("pickColor"),
            onChange: (e: { target: { value: string } }) => commit(e.target.value),
            style: { width: 30, height: 30, padding: 0, border: "none", borderRadius: 6, background: "none", cursor: "pointer" },
          })
        : <View style={s.preview} />}
      <TextInput
        accessibilityLabel={t("hexColor")}
        value={text}
        onChangeText={commit}
        placeholder="#3b82f6"
        placeholderTextColor={theme.colors.foregroundMuted}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={7}
        style={s.input}
      />
    </View>
  );
}
