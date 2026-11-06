/**
 * Web et bureau (Electron = page web) seulement : masque la liste de workspaces native pour que
 * l'arbre prenne sa place. Sur iPhone et Android il n'y a pas de page : tout est inerte.
 *
 * Fragile par nature (Paseo n'a pas d'API pour ça) : on s'appuie sur les data-testid de la barre.
 * Dans Paseo 0.15.x, la liste est un ScrollView `sidebar-project-workspace-list-scroll` (groupement
 * par projet) ou `sidebar-status-list-scroll` (groupement par statut) ; l'en-tête « Workspaces » +
 * menu d'affichage et la section épinglée sont DANS ce ScrollView, donc masqués avec lui.
 * `projects-list` est la liste des Réglages > Projets, pas celle de la barre.
 */
import { Platform } from "react-native";
import { useSyncExternalStore } from "react";

interface Rect {
  top: number;
  height: number;
}
interface El {
  parentElement: El | null;
  querySelector(selector: string): El | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getBoundingClientRect(): Rect;
  remove(): void;
  appendChild(el: El): void;
  textContent: string | null;
  id: string;
}
declare const document: {
  head: El;
  createElement(tag: "style"): El;
  getElementById(id: string): El | null;
  querySelector(selector: string): El | null;
  querySelectorAll(selector: string): ArrayLike<El>;
};
declare const window: { innerHeight: number };
declare function setInterval(cb: () => void, ms: number): number;
declare function clearInterval(id: number): void;

export const isWeb = Platform.OS === "web" && typeof document !== "undefined";

const STYLE_ID = "agent-tree-hide";
const MARK = "data-agent-tree-hide";
const ROOT = '[data-testid="agent-tree-root"]';
const NAV_ANCHOR = '[data-testid="sidebar-global-new-workspace"]';
const LIST_SELECTOR = '[data-testid="sidebar-project-workspace-list-scroll"], [data-testid="sidebar-status-list-scroll"]';
const GIVE_UP_AFTER_MS = 15_000;

const LS = ["sidebar-project-workspace-list-scroll", "sidebar-status-list-scroll"];
const hasList = (prefix: string, suffix: string) => LS.map((id) => `${prefix}:has(${suffix}[data-testid="${id}"])`).join(", ");

/**
 * CSS purement déclaratif (sélecteurs :has, Chromium/Electron) : actif dès son injection, sans
 * attendre ni marquage JS ni rendu de l'arbre. Les règles `[data-arbre-hide]` ne sont qu'un filet
 * posé par apply() si :has ne suffisait pas.
 *  - liste native : son conteneur est masqué ;
 *  - zone d'en-tête (frère juste avant la liste) et son groupe de navigation : flex 1, minHeight 0 ;
 *  - notre racine : en dernier (order), prend le reste, défile seule.
 */
const REPLACE_CSS = [
  `${hasList("div", "> ")} { display: none !important; }`,
  `${LS.map((id) => `div:has(+ div > [data-testid="${id}"])`).join(", ")} { flex: 1 1 0% !important; min-height: 0 !important; }`,
  `${LS.map((id) => `div:has(+ div > [data-testid="${id}"]) > div:has([data-testid="agent-tree-root"])`).join(", ")} { flex: 1 1 0% !important; min-height: 0 !important; }`,
  `[data-testid="agent-tree-root"] { order: 99 !important; flex: 1 1 0% !important; min-height: 0 !important; overflow-y: auto !important; }`,
  `[${MARK}="list"] { display: none !important; }`,
  `[${MARK}="area"], [${MARK}="nav"] { flex: 1 1 0% !important; min-height: 0 !important; }`,
  `[${MARK}="item"] { order: 99 !important; flex: 1 1 0% !important; min-height: 0 !important; overflow-y: auto !important; }`,
].join("\n");

/** À appeler à l'évaluation du module client : la liste native n'est jamais dessinée avant d'être masquée. */
export function injectEarly(): void {
  if (!isWeb || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = REPLACE_CSS;
  document.head.appendChild(style);
}

let hidden = false;
const listeners = new Set<() => void>();
function setHidden(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
  listeners.forEach((listener) => listener());
}

/** Vrai quand la liste native est effectivement masquée (l'arbre peut alors prendre toute la place). */
export function useNativeHidden(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => hidden,
  );
}

function removeAll(): void {
  document.getElementById(STYLE_ID)?.remove();
  for (const el of Array.from(document.querySelectorAll(`[${MARK}]`))) el.removeAttribute(MARK);
  setHidden(false);
}

/**
 * Mise en page, par CSS seulement (aucune hauteur calculée en JS). Structure de Paseo 0.15 :
 *   colonne de la barre (flex:1) > [ zone d'en-tête (position:relative) > groupe de navigation
 *   (lignes natives + items de plugins, colonne) ] , [ liste de workspaces (flex:1) ] , callout , footer.
 * La liste est masquée (display:none) : la zone d'en-tête prend l'espace libre, le groupe de navigation
 * la remplit, et NOTRE item passe en dernier (order) en prenant le reste, avec son propre défilement.
 * Les items des autres plugins restent donc compacts au-dessus de l'arbre, jamais poussés en bas.
 */
function apply(): boolean {
  const lists = Array.from(document.querySelectorAll(LIST_SELECTOR));
  const root = document.querySelector(ROOT);
  if (lists.length === 0 || !root) return false;
  // Le groupe de navigation = plus petit ancêtre de notre racine qui contient aussi la ligne native « nouveau workspace ».
  let item: El = root;
  let nav: El | null = root.parentElement;
  while (nav && !nav.querySelector(NAV_ANCHOR)) {
    item = nav;
    nav = nav.parentElement;
  }
  const area = nav?.parentElement ?? null;
  if (!nav || !area) return false;
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = REPLACE_CSS;
    document.head.appendChild(style);
  }
  // On masque le conteneur (View flex:1) du ScrollView, sinon il garderait sa place vide.
  for (const list of lists) (list.parentElement ?? list).setAttribute(MARK, "list");
  area.setAttribute(MARK, "area");
  nav.setAttribute(MARK, "nav");
  item.setAttribute(MARK, "item");
  setHidden(true);
  return true;
}

/**
 * Applique le masquage tant que `enabled()` est vrai, et le retire dès qu'il ne l'est plus ou au
 * déchargement (la fonction rendue). Si aucun sélecteur ne trouve rien (Paseo mis à jour), rien
 * n'est masqué et un avertissement est écrit une seule fois.
 */
export function installReplace(enabled: () => boolean): () => void {
  if (!isWeb) return () => {};
  const started = Date.now();
  let warned = false;
  const tick = () => {
    if (!enabled()) {
      if (hidden || document.getElementById(STYLE_ID)) removeAll();
      return;
    }
    if (apply()) return;
    // Pas encore de liste ni de racine : le style précoce reste pendant un délai de grâce, puis on rend la main.
    if (Date.now() - started <= GIVE_UP_AFTER_MS) return;
    if (hidden || document.getElementById(STYLE_ID)) removeAll();
    if (!warned) {
      warned = true;
      console.warn("[agent-tree] liste de workspaces native introuvable (sélecteurs sidebar-*-list-scroll, agent-tree-root, sidebar-global-new-workspace) : rien n'est masqué. Paseo a peut-être changé.");
    }
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => {
    clearInterval(timer);
    removeAll();
  };
}

