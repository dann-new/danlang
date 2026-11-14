import { createEngine, type ConversationState } from "@danlang/core";
import { askModel, classify } from "@/lib/providers";
import { loadFolder } from "@/lib/program";

type Body = {
  folder: string;
  message: string;
  lastReply?: string;
  /** Answers for fields the classifier doesn't answer (picked in the UI), and overrides. */
  manual?: Record<string, string>;
  hostChecks?: Record<string, boolean>;
  askModel?: boolean;
  /** Where the conversation is waiting (from the previous answer). */
  state?: ConversationState;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const { program, problems } = loadFolder(body.folder);
  const errors = problems.filter((p) => p.severity === "error");
  if (!program || errors.length) return Response.json({ error: "Fix the errors in your .dan files first.", problems }, { status: 400 });

  const classifier = await classify(program, body.message);
  const facts: Record<string, string | undefined> = { ...(body.manual ?? {}) };
  const confidence: Record<string, number> = {};
  if (classifier.ok) {
    Object.assign(facts, classifier.facts);
    Object.assign(confidence, classifier.confidence);
  } else if (program.fields.source?.includes("fallback")) {
    // Same as a real app: when the classifier fails, mark it so the tree can play safe.
    facts.source = "fallback";
  }

  const hostNames = Object.values(program.checks).filter((c) => c.host).map((c) => c.name);
  const engine = createEngine(program, {
    checks: Object.fromEntries(hostNames.map((n) => [n, () => body.hostChecks?.[n] ?? false])),
  });
  const decision = engine.decide({
    text: body.message,
    facts,
    confidence,
    ...(body.lastReply ? { lastReply: body.lastReply } : {}),
    ...(body.state ? { state: body.state } : {}),
  });

  const model = decision.kind === "model" && body.askModel ? await askModel(body.message) : null;
  return Response.json({ classifier, facts, confidence, decision, model });
}
