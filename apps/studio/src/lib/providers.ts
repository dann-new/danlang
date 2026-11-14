/**
 * Calls the real classifier (Jev, through OpenRouter's Decisions API) and, optionally, the big AI. Server only:
 * the keys come from .env.local and never reach the browser.
 *
 * The classifier request is built from the program itself: every `field` with descriptions becomes one question,
 * and each value's description is its criterion. Fields without descriptions (like `source`) are set by the app.
 */
import type { Program } from "@danlang/core";

const JEV_MODEL = "typesafe/jev-1.13";
const JEV_URL = "https://openrouter.ai/api/alpha/decisions";
const LLM_MODEL = "google/gemini-2.5-flash-lite";
const LLM_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 15_000;

/** Fields the classifier answers: the ones whose values have descriptions. */
export function classifierFields(program: Program): string[] {
  return Object.entries(program.fieldInfo)
    .filter(([, info]) => Object.keys(info.describe).length > 0)
    .map(([name]) => name);
}

export type ClassifierResult =
  | { ok: true; facts: Record<string, string>; confidence: Record<string, number>; costUsd: number | null; ms: number }
  | { ok: false; error: string; ms: number };

export async function classify(program: Program, text: string): Promise<ClassifierResult> {
  const started = Date.now();
  const key = process.env.JEV_API_KEY;
  if (!key) return { ok: false, error: "JEV_API_KEY is not set in .env.local.", ms: 0 };
  const fields = classifierFields(program);
  if (!fields.length) return { ok: false, error: "No field has descriptions, so there is nothing to ask the classifier.", ms: 0 };

  const questions: Record<string, unknown> = {};
  for (const name of fields) {
    const info = program.fieldInfo[name]!;
    const criteria: Record<string, string> = {};
    for (const v of program.fields[name]!) criteria[v] = info.describe[v] ?? v.replace(/_/g, " ");
    questions[name] = { type: "choice", instructions: info.question ?? `Which ${name} fits \`text\`?`, criteria };
  }

  try {
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "danlang Studio" },
      body: JSON.stringify({ model: JEV_MODEL, state: { text }, questions }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `Classifier error ${res.status}: ${(await res.text()).slice(0, 200)}`, ms: Date.now() - started };
    const data = (await res.json()) as {
      answers?: Record<string, { choice?: string; confidence?: number }>;
      usage?: { cost?: number };
    };
    const facts: Record<string, string> = {};
    const confidence: Record<string, number> = {};
    for (const name of fields) {
      const a = data.answers?.[name];
      if (a?.choice && program.fields[name]!.includes(a.choice)) {
        facts[name] = a.choice;
        confidence[name] = typeof a.confidence === "number" ? a.confidence : 0;
      }
    }
    return { ok: true, facts, confidence, costUsd: typeof data.usage?.cost === "number" ? data.usage.cost : null, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, error: `Classifier failed: ${(e as Error).message}`, ms: Date.now() - started };
  }
}

export type LlmResult = { ok: true; text: string; costUsd: number | null; ms: number } | { ok: false; error: string };

export async function askModel(text: string): Promise<LlmResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, error: "OPENROUTER_API_KEY is not set in .env.local." };
  const started = Date.now();
  try {
    const res = await fetch(LLM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "danlang Studio" },
      body: JSON.stringify({
        model: LLM_MODEL,
        max_tokens: 200,
        usage: { include: true },
        messages: [
          { role: "system", content: "You are a helpful assistant being tested in a routing tool. Answer briefly." },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, error: `AI error ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } };
    return {
      ok: true,
      text: data.choices?.[0]?.message?.content?.trim() || "(empty answer)",
      costUsd: typeof data.usage?.cost === "number" ? data.usage.cost : null,
      ms: Date.now() - started,
    };
  } catch (e) {
    return { ok: false, error: `AI failed: ${(e as Error).message}` };
  }
}
