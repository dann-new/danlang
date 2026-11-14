// Links this extension into every VS Code-style editor found on this Mac (Antigravity, VS Code, Cursor).
// Because it is a link, edits to the grammar show up after "Developer: Reload Window". No build or marketplace needed.
import { existsSync, lstatSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const pkg = JSON.parse(await import("node:fs").then((fs) => fs.readFileSync(new URL("./package.json", import.meta.url), "utf8")));
const here = resolve(new URL(".", import.meta.url).pathname);
const folder = `${pkg.publisher}.${pkg.name}-${pkg.version}`;
const editors = [".antigravity", ".vscode", ".cursor"];

let done = 0;
for (const editor of editors) {
  const dir = join(homedir(), editor, "extensions");
  if (!existsSync(dir)) continue;
  const target = join(dir, folder);
  if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) {
    if (!lstatSync(target).isSymbolicLink()) {
      console.log(`skip ${target}: a real folder is there, not a link`);
      continue;
    }
    rmSync(target);
  }
  symlinkSync(here, target, "dir");
  console.log(`linked ${target}`);
  done++;
}
console.log(done ? "Now reload the editor window (Cmd+Shift+P → Developer: Reload Window)." : "No editor extension folders found.");
