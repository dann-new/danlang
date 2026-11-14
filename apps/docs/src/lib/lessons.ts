/**
 * Reads the lessons from the repo's docs/lessons folder (the single source: the website only displays them).
 * Server only: uses the file system.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Marked } from "marked";
import { encodeCode, highlightDan } from "./highlight";

const DIR = join(process.cwd(), "..", "..", "docs", "lessons");

export type LessonMeta = { slug: string; title: string; summary: string; order: number };
export type Lesson = LessonMeta & { html: string };

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(m[0].length) };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      if (lang === "dan" || lang === "dan-broken") {
        return `<div class="example"><div class="example-head">Example</div><pre class="code dan">${highlightDan(
          text,
        )}</pre><a class="try" href="/playground#code=${encodeCode(text)}">Try it Yourself »</a></div>`;
      }
      if (lang === "text") return `<pre class="code dan">${highlightDan(text)}</pre>`;
      return `<pre class="code"><code>${esc(text)}</code></pre>`;
    },
  },
});

function files(): string[] {
  return readdirSync(DIR)
    .filter((f) => /^\d+-.+\.md$/.test(f))
    .sort();
}

function toMeta(file: string, meta: Record<string, string>): LessonMeta {
  const slug = file.replace(/^\d+-/, "").replace(/\.md$/, "");
  return { slug, title: meta.title ?? slug, summary: meta.summary ?? "", order: Number(file.split("-")[0]) };
}

export function listLessons(): LessonMeta[] {
  return files().map((f) => toMeta(f, parseFrontmatter(readFileSync(join(DIR, f), "utf8")).meta));
}

export function getLesson(slug: string): Lesson | null {
  const file = files().find((f) => f.replace(/^\d+-/, "").replace(/\.md$/, "") === slug);
  if (!file) return null;
  const { meta, body } = parseFrontmatter(readFileSync(join(DIR, file), "utf8"));
  // The page shows the title itself, so drop the first "# Title" line.
  const html = marked.parse(body.replace(/^\s*#\s.+\n/, ""), { async: false }) as string;
  return { ...toMeta(file, meta), html };
}
