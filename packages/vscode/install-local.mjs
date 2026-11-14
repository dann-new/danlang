// Packages this extension as danlang.vsix and installs it into every VS Code-style editor found on this Mac.
// (A plain folder link is ignored by newer editors: they only load extensions listed in their extensions.json.)
// After a grammar change, run this again, then "Developer: Reload Window".
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const vsix = `${here}danlang.vsix`;

execFileSync(
  "pnpm",
  ["dlx", "@vscode/vsce@3.6.0", "package", "--no-dependencies", "--allow-missing-repository", "--skip-license", "-o", vsix],
  { cwd: here, stdio: "inherit" },
);

const editors = [
  ["Antigravity", "/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide"],
  ["VS Code", "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"],
  ["Cursor", "/Applications/Cursor.app/Contents/Resources/app/bin/cursor"],
];

let done = 0;
for (const [name, cli] of editors) {
  if (!existsSync(cli)) continue;
  try {
    execFileSync(cli, ["--install-extension", vsix, "--force"], { stdio: "ignore" });
    console.log(`installed in ${name}`);
    done++;
  } catch {
    console.log(`could not install in ${name}`);
  }
}
console.log(done ? "Now reload the editor window (Cmd+Shift+P → Developer: Reload Window)." : "No supported editor found.");
