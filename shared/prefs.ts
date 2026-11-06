import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

/**
 * Préférences de l'arbre, stockées sur l'hôte sélectionné. Tous les champs ont une valeur par
 * défaut : un document enregistré avant l'ajout d'un champ (version 1 d'origine : toggled,
 * showTemporary, sidebarTree, replaceNative) se relit tel quel, sans perte.
 */
export const arbreSettings = defineSettings({
  id: "agent-tree",
  scope: "host",
  version: 1,
  schema: z.object({
    /** Clé de nœud -> déplié (true) ou replié (false). Absent = dépliage par défaut du niveau. */
    toggled: z.record(z.string(), z.boolean()).default({}),
    /** Réafficher les agents des dossiers temporaires ou système (tmp, /tmp, C:\Windows, System32). */
    showTemporary: z.boolean().default(false),
    /** Dessiner l'arbre dans la barre latérale (sinon une seule ligne qui ouvre l'écran). */
    sidebarTree: z.boolean().default(true),
    /** Web et bureau : masquer la liste de workspaces native au profit de l'arbre. */
    replaceNative: z.boolean().default(true),
    /** Par machine (clé = serverId) : couleur hex, nom affiché, masquée. */
    hosts: z
      .record(z.string(), z.object({ color: z.string().optional(), name: z.string().optional(), hidden: z.boolean().optional() }))
      .default({}),
    /** Dépliage par défaut, par niveau (un choix mémorisé dans `toggled` l'emporte). */
    openHosts: z.boolean().default(true),
    openProjects: z.boolean().default(true),
    openAgents: z.boolean().default(false),
    /** Sous-agents Claude Code (outil Agent/Task) : afficher, et combien au plus par agent. */
    showSubagents: z.boolean().default(true),
    maxSubagents: z.number().default(20),
    /** Agents archivés : masqués, ou affichés grisés. Agents fermés : masqués, grisés ou normaux. */
    archived: z.enum(["hide", "dim"]).default("hide"),
    closed: z.enum(["hide", "dim", "show"]).default("show"),
    sort: z.enum(["recent", "name"]).default("recent"),
    titleMax: z.number().default(40),
    statusDots: z.boolean().default(true),
    subagentCount: z.boolean().default(true),
    /** Marge au-dessus de l'arbre dans la barre latérale, en px. */
    topMargin: z.number().default(16),
  }),
});

export { DEFAULT_PREFS, PALETTE, hostColor, type ArbrePrefs } from "./defaults";
