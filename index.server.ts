import type { PluginServerContext } from "@getpaseo/plugin/server";
import { arbreSettings } from "./shared/prefs";

// Toute la collecte passe par le client Paseo de chaque hôte (côté app) : le serveur ne garde
// que les préférences (dépliage, réaffichage des dossiers temporaires).
export default function contribute(server: PluginServerContext) {
  server.registerSettings(arbreSettings);
  return () => {};
}
