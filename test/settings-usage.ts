// Chaque réglage du schéma doit être LU par le code de rendu (pas seulement écrit par la page de réglages).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const schema = readFileSync(join(root, "shared/prefs.ts"), "utf8");
const body = schema.slice(schema.indexOf("schema: z.object({"), schema.indexOf("export type ArbrePrefs"));
const keys = [...body.matchAll(/^ {4}(\w+): z/gm)].map((m) => m[1]!);
const hostKeys = ["color", "name", "hidden"]; // champs de prefs.hosts[serverId]

const files: string[] = [];
for (const dir of ["client", "shared"]) for (const f of readdirSync(join(root, dir))) files.push(`${dir}/${f}`);
files.push("index.client.tsx");
// Lecteurs = tout sauf le schéma, le magasin de prefs et la page de réglages (qui ne font qu'écrire).
const readers = files.filter((f) => !["shared/prefs.ts", "client/prefs.ts", "client/settings-screen.tsx", "client/popover.tsx", "shared/collect.ts"].includes(f) || f === "shared/collect.ts");

function find(re: RegExp): string | null {
  for (const file of readers) {
    const lines = readFileSync(join(root, file), "utf8").split("\n");
    const at = lines.findIndex((line) => re.test(line));
    if (at >= 0) return `${file}:${at + 1}`;
  }
  return null;
}

let missing = 0;
for (const key of keys) {
  const where = find(new RegExp(`(?:prefs|settings)\\.${key}\\b`));
  console.log(`${key.padEnd(15)} -> ${where ?? "NO READER"}`);
  if (!where) missing += 1;
}
for (const key of hostKeys) {
  const where = find(new RegExp(`hosts\\[[^\\]]+\\]\\??\\.${key}\\b`));
  console.log(`hosts.${key.padEnd(9)} -> ${where ?? "NO READER"}`);
  if (!where) missing += 1;
}
console.log(`${keys.length + hostKeys.length} settings, ${missing} without a reader`);
process.exit(missing ? 1 : 0);
