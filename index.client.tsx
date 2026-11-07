import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { messages } from "./client/i18n";
import { getPrefs, toggleDemo, useArbrePrefs } from "./client/prefs";
import { injectEarly, installReplace } from "./client/web";

// Dès l'évaluation du module, avant tout hook et avant que la barre n'existe : pas de flash de la liste native.
injectEarly();
import { ArbreItem, ArbreLink } from "./client/sidebar";
import { ArbreSettings } from "./client/settings-screen";
import { Arbre, Ouvrir } from "./client/tree-screen";

function SidebarEntry(props: PluginSidebarItemProps) {
  const { prefs } = useArbrePrefs();
  return prefs.sidebarTree ? <ArbreItem {...props} /> : <ArbreLink {...props} />;
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: "tree", title: messages.message("title"), Component: Arbre });
  client.addScreen({ id: "open", title: messages.message("openAgentTitle"), Component: Ouvrir });
  client.addScreen({ id: "settings", title: messages.message("settingsTitle"), Component: ArbreSettings });
  client.addSettingsScreen({ id: "settings", title: messages.message("title"), icon: "ListTree", Component: ArbreSettings });
  client.addSidebarHeaderItem({ id: "tree", title: messages.message("title"), Component: SidebarEntry });
  client.addCommandCenterItem({
    id: "open-tree",
    title: messages.message("openTree"),
    icon: "ListTree",
    keywords: ["agent", "tree", "hosts", "projects", "arbre", "agents"],
    context: "global",
    onSelect({ openScreen }) {
      openScreen({ screenId: "tree" });
    },
  });
  client.addCommandCenterItem({
    id: "open-settings",
    title: messages.message("openSettings"),
    icon: "Settings",
    keywords: ["agent tree", "settings", "color", "hosts", "arbre", "réglages"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings("settings");
    },
  });
  client.addCommandCenterItem({
    id: "toggle-demo",
    title: messages.message("demoCommand"),
    icon: "Presentation",
    keywords: ["demo", "démo", "screenshot", "capture"],
    context: "global",
    onSelect() {
      toggleDemo();
    },
  });
  // Web et bureau : masquer la liste native tant que le réglage est actif ET que l'arbre est dans la barre.
  const stopReplace = installReplace(() => getPrefs().replaceNative && getPrefs().sidebarTree);
  return () => {
    stopReplace();
  };
}
