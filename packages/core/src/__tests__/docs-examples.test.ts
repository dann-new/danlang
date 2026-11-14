/** Every ```dan example in docs/lessons and SKILL.md must work, and every ```dan-broken example must show an error. */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { check, linkSources } from "../index";

const dir = fileURLToPath(new URL("../../../../docs/lessons/", import.meta.url));
const skill = fileURLToPath(new URL("../../SKILL.md", import.meta.url));
const sources = [
  ...readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: f, text: readFileSync(dir + f, "utf8") })),
  { file: "SKILL.md", text: readFileSync(skill, "utf8") },
];
const blocks = sources
  .flatMap(({ file, text }) =>
    [...text.matchAll(/```(dan|dan-broken)\n([\s\S]*?)```/g)].map((m, i) => ({
      name: `${file} example ${i + 1}`,
      broken: m[1] === "dan-broken",
      code: m[2]!,
    })),
  );

describe("lesson examples", () => {
  test("there are examples", () => expect(blocks.length).toBeGreaterThan(20));
  for (const b of blocks) {
    test(b.name, () => {
      const errors = (() => {
        try {
          return check(linkSources({ "main.dan": b.code })).filter((d) => d.severity === "error").map((d) => d.message);
        } catch (e) {
          return [(e as Error).message];
        }
      })();
      if (b.broken) expect(errors.length).toBeGreaterThan(0);
      else expect(errors).toEqual([]);
    });
  }
});
