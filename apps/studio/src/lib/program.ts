/**
 * Loads a .dan program from a folder under the repo's examples/ (server only). Read fresh on every request, so
 * edits to the .dan files show up in the Studio right away.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { check, link, type Diagnostic, type Program } from "@danlang/core";

const REPO = join(process.cwd(), "..", "..");
const EXAMPLES = join(REPO, "examples");

/** Every folder under examples/ that has a main.dan. */
export function listFolders(): string[] {
  if (!existsSync(EXAMPLES)) return [];
  return readdirSync(EXAMPLES)
    .filter((d) => statSync(join(EXAMPLES, d)).isDirectory() && existsSync(join(EXAMPLES, d, "main.dan")))
    .sort();
}

export function defaultFolder(): string {
  const all = listFolders();
  const fromEnv = process.env.DANLANG_STUDIO_FOLDER;
  if (fromEnv && all.includes(fromEnv)) return fromEnv;
  return all.includes("juanstack") ? "juanstack" : (all[0] ?? "");
}

export type Loaded = {
  folder: string;
  program: Program | null;
  /** File text by the same path the program uses (relative to the folder), for hover tooltips. */
  sources: Record<string, string>;
  problems: Diagnostic[];
};

export function loadFolder(folder: string): Loaded {
  if (!listFolders().includes(folder)) {
    return { folder, program: null, sources: {}, problems: [{ severity: "error", message: `No folder examples/${folder} with a main.dan.`, pos: { file: "", line: 1, col: 1 } }] };
  }
  const dir = join(EXAMPLES, folder);
  const sources: Record<string, string> = {};
  try {
    const program = link("main.dan", (p) => {
      const text = readFileSync(join(dir, p), "utf8");
      sources[relative(dir, join(dir, p))] = text;
      return text;
    });
    return { folder, program, sources, problems: check(program) };
  } catch (e) {
    const err = e as Error & { pos?: Diagnostic["pos"] };
    return {
      folder,
      program: null,
      sources,
      problems: [{ severity: "error", message: err.message, pos: err.pos ?? { file: "main.dan", line: 1, col: 1 } }],
    };
  }
}
