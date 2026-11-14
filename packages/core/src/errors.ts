import type { Pos } from "./ast";

/** A problem found in a .dan file. `severity: "warning"` never stops a program from running. */
export type Diagnostic = { severity: "error" | "warning"; message: string; pos: Pos };

/** Thrown for errors that stop parsing or linking. Carries where it happened. */
export class DanError extends Error {
  constructor(
    message: string,
    readonly pos: Pos,
  ) {
    super(`${pos.file}:${pos.line}:${pos.col}: ${message}`);
    this.name = "DanError";
  }
}

export function formatDiagnostic(d: Diagnostic): string {
  return `${d.pos.file}:${d.pos.line}:${d.pos.col} ${d.severity}: ${d.message}`;
}
