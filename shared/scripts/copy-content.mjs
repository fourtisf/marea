// Copies the JSON content next to the compiled JS so both Node (server) and
// Vite (client) can resolve the `import ... from "./map.json"` statements that
// tsc preserves in dist/content/index.js.
import { mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(here, "../src/content");
const outDir = resolve(here, "../dist/content");
mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(srcDir)) {
  if (f.endsWith(".json")) copyFileSync(resolve(srcDir, f), resolve(outDir, f));
}
console.log("copied content json -> dist/content");
