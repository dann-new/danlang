/**
 * Finds mistakes in a linked program before it runs: typos in names, branches that can never be reached, flows
 * that loop forever, confidences out of range. Errors mean "do not run this"; warnings are worth a look.
 * Messages are written for people AND for AI assistants editing .dan files, so each says how to fix it.
 */
import type { Branch, Cond, Pos, Program } from "./ast";
import type { Diagnostic } from "./errors";

export function check(program: Program): Diagnostic[] {
  const out: Diagnostic[] = [];
  const err = (message: string, pos: Pos) => out.push({ severity: "error", message, pos });
  const warn = (message: string, pos: Pos) => out.push({ severity: "warning", message, pos });
  const firstPos: Pos = { file: program.files[0] ?? "main.dan", line: 1, col: 1 };

  const entry = program.flows[program.entry];
  if (!entry) err(`There is no \`flow ${program.entry}\`. Every program starts there.`, firstPos);

  for (const c of Object.values(program.checks)) {
    if (!c.host) {
      try {
        new RegExp(c.source, c.flags);
      } catch (e) {
        err(`check "${c.name}" is not a valid regex: ${(e as Error).message}`, c.pos);
      }
    }
  }

  const usedFlows = new Set<string>([program.entry]);
  const usedChecks = new Set<string>();

  const checkCond = (cond: Cond) => {
    switch (cond.kind) {
      case "and":
      case "or":
        checkCond(cond.left);
        checkCond(cond.right);
        return;
      case "not":
        checkCond(cond.cond);
        return;
      case "has":
        usedChecks.add(cond.check);
        if (!program.checks[cond.check])
          err(`Unknown check "${cond.check}". Add \`check ${cond.check} = /regex/i\` (or \`= host\`).`, cond.pos);
        return;
      case "asked":
        if (!program.asks[cond.ask])
          err(`Unknown ask "${cond.ask}". No branch does \`-> ask ${cond.ask} "..."\`.`, cond.pos);
        return;
      case "is": {
        const allowed = program.fields[cond.field];
        if (!allowed) {
          err(`Unknown field "${cond.field}". Declare it: \`field ${cond.field} = [value1, value2]\`.`, cond.pos);
        } else {
          for (const v of cond.values)
            if (!allowed.includes(v))
              err(`"${v}" is not a value of field ${cond.field}. Allowed: ${allowed.join(", ")}.`, cond.pos);
        }
        if (typeof cond.min === "string" && !(cond.min in program.lets))
          err(`Unknown confidence "${cond.min}". Add \`let ${cond.min} = 0.8\`.`, cond.pos);
        const min = typeof cond.min === "string" ? program.lets[cond.min] : cond.min;
        if (min !== undefined && (min < 0 || min > 1))
          err(`A confidence must be between 0 and 1 (got ${min}).`, cond.pos);
      }
    }
  };

  const walk = (branches: Branch[], where: string) => {
    const ids = new Set<string>();
    branches.forEach((b, i) => {
      if (ids.has(b.id)) err(`Two branches named "${b.id}" in ${where}. Names must differ within one level.`, b.pos);
      ids.add(b.id);
      if (b.when !== "else") checkCond(b.when);
      else if (i < branches.length - 1)
        err(`Branches after \`${b.id}: else\` can never be reached. Move the else to the end.`, branches[i + 1]!.pos);
      if (b.leaf && b.children.length)
        err(`Branch "${b.id}" has both "->" and branches under it. Pick one.`, b.pos);
      if (!b.leaf && !b.children.length)
        err(`Branch "${b.id}" does nothing. Add \`-> model\` (or reply/ask/...), or branches under it.`, b.pos);
      if (b.leaf?.kind === "flow") {
        usedFlows.add(b.leaf.flow);
        if (!program.flows[b.leaf.flow])
          err(
            `"${b.leaf.flow}" is not a flow or an action. Use model, reply, ask, refuse, direct, or the name of a flow.`,
            b.pos,
          );
      }
      if (b.leaf && "texts" in b.leaf && b.leaf.texts.some((t) => !t.trim())) err(`Branch "${b.id}" has an empty text.`, b.pos);
      walk(b.children, `"${b.id}"`);
    });
    const last = branches[branches.length - 1];
    if (last && last.when !== "else")
      warn(
        `${where} has no \`else\` at the end, so a message that matches nothing falls to the model. Add \`open: else -> model\` to make it explicit.`,
        last.pos,
      );
  };

  for (const flow of Object.values(program.flows)) {
    if (!flow.branches.length) err(`flow ${flow.name} has no branches.`, flow.pos);
    walk(flow.branches, `flow ${flow.name}`);
  }

  // Flow loops: a -> b -> a would walk forever.
  const refs = (branches: Branch[], acc: Set<string>) => {
    for (const b of branches) {
      if (b.leaf?.kind === "flow") acc.add(b.leaf.flow);
      refs(b.children, acc);
    }
    return acc;
  };
  const state: Record<string, "visiting" | "done"> = {};
  const visit = (name: string, trail: string[]) => {
    const flow = program.flows[name];
    if (!flow || state[name] === "done") return;
    if (state[name] === "visiting") {
      err(`Flows loop forever: ${[...trail, name].join(" -> ")}. A flow cannot lead back to itself.`, flow.pos);
      return;
    }
    state[name] = "visiting";
    for (const r of refs(flow.branches, new Set())) visit(r, [...trail, name]);
    state[name] = "done";
  };
  for (const name of Object.keys(program.flows)) visit(name, []);

  for (const flow of Object.values(program.flows))
    if (!usedFlows.has(flow.name)) warn(`flow ${flow.name} is never used.`, flow.pos);
  for (const c of Object.values(program.checks))
    if (!usedChecks.has(c.name)) warn(`check ${c.name} is never used.`, c.pos);

  return out;
}
