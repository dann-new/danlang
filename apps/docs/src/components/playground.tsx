"use client";

/**
 * The "Try it Yourself" page. Runs the real @danlang/core in the browser: no server, no AI calls.
 * The visitor plays the part of Jev by picking each field's answer and how sure it is.
 */
import { check, createEngine, linkSources, type Decision, type Diagnostic, type Program } from "@danlang/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { decodeCode, highlightDan } from "@/lib/highlight";

const DEFAULT = `field topic = [greeting, taxes, other]

let hello_messages = ["Hi there!", "Hello! How can I help?", "Hey! 👋"]

flow main
  say-hi: when topic == greeting -> reply hello_messages
  tax: when topic == taxes >= 0.8 -> direct tax_summary
  open: else -> model
`;

type Compiled = { program: Program | null; problems: Diagnostic[] };

function compile(code: string): Compiled {
  try {
    const program = linkSources({ "main.dan": code });
    return { program, problems: check(program) };
  } catch (e) {
    const err = e as Error & { pos?: Diagnostic["pos"] };
    const message = err.message.replace(/^main\.dan:\d+:\d+: /, "");
    return { program: null, problems: [{ severity: "error", message, pos: err.pos ?? { file: "main.dan", line: 1, col: 1 } }] };
  }
}

function explain(d: Decision): { big: string; free: boolean; detail?: string } {
  switch (d.kind) {
    case "model":
      return { big: "🤖 Sent to the big AI", free: false, detail: "This one costs money. The AI reads the message and answers." };
    case "reply":
      return { big: "💬 Replied for free", free: true };
    case "refuse":
      return { big: "🙅 Politely refused, for free", free: true };
    case "ask":
      return { big: "❓ Asked a question, for free", free: true };
    case "direct":
      return { big: `⚙️ Your app answers: ${d.name}`, free: true, detail: "Your app's own code does this (no AI)." };
  }
}

export function Playground() {
  const [code, setCode] = useState(DEFAULT);
  const [message, setMessage] = useState("hello!");
  const [lastReply, setLastReply] = useState("");
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [sure, setSure] = useState<Record<string, number>>({});
  const [host, setHost] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<Decision | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Load the example from a lesson's "Try it Yourself" link.
  useEffect(() => {
    const m = /#code=([^&]+)/.exec(window.location.hash);
    if (m) {
      try {
        setCode(decodeCode(m[1]!));
      } catch {
        /* a broken link just keeps the default example */
      }
    }
  }, []);

  const { program, problems } = useMemo(() => compile(code), [code]);
  const fields = program?.fields ?? {};
  const hostChecks = Object.values(program?.checks ?? {}).filter((c) => c.host).map((c) => c.name);
  const asks = Object.values(program?.asks ?? {}).flat();
  const errors = problems.filter((p) => p.severity === "error");

  const run = () => {
    setRunError(null);
    setResult(null);
    if (!program || errors.length) {
      setRunError("Fix the problems in your code first (see the list below the editor).");
      return;
    }
    try {
      const engine = createEngine(program, {
        checks: Object.fromEntries(hostChecks.map((name) => [name, () => host[name] ?? false])),
      });
      const factValues: Record<string, string | undefined> = {};
      const conf: Record<string, number> = {};
      for (const [name, values] of Object.entries(fields)) {
        factValues[name] = facts[name] ?? values[0];
        conf[name] = sure[name] ?? 0.95;
      }
      setResult(engine.decide({ text: message, facts: factValues, confidence: conf, ...(lastReply ? { lastReply } : {}) }));
    } catch (e) {
      setRunError((e as Error).message);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const t = e.currentTarget;
      const { selectionStart: s, selectionEnd: end } = t;
      const next = code.slice(0, s) + "  " + code.slice(end);
      setCode(next);
      requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  const ex = result ? explain(result) : null;

  return (
    <main className="play">
      <section className="play-pane">
        <h2>Your danlang code</h2>
        <p className="hint">Edit the code, then press Run (or ⌘/Ctrl + Enter).</p>
        <div className="editor">
          <pre ref={preRef} aria-hidden dangerouslySetInnerHTML={{ __html: highlightDan(code) + "\n" }} />
          <textarea
            aria-label="danlang code"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        {problems.length > 0 ? (
          <>
            <h2>Problems</h2>
            <ul className="problems">
              {problems.map((p, i) => (
                <li key={i} className={p.severity}>
                  <strong>
                    Line {p.pos.line} · {p.severity === "error" ? "Error" : "Warning"}:
                  </strong>{" "}
                  {p.message}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="hint">✅ No problems found.</p>
        )}
      </section>

      <section className="play-pane">
        <h2>Send a message</h2>
        <div className="field">
          <label htmlFor="msg">Message from the person</label>
          <input id="msg" type="text" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        {Object.keys(fields).length > 0 && (
          <>
            <p className="hint">You are Jev: pick what the message is about, and how sure you are.</p>
            {Object.entries(fields).map(([name, values]) => (
              <div className="field-row" key={name}>
                <div className="field">
                  <label htmlFor={`f-${name}`}>{name}</label>
                  <select id={`f-${name}`} value={facts[name] ?? values[0]} onChange={(e) => setFacts({ ...facts, [name]: e.target.value })}>
                    {values.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <label className="range">
                  sure
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={sure[name] ?? 0.95}
                    onChange={(e) => setSure({ ...sure, [name]: Number(e.target.value) })}
                  />
                  {Math.round((sure[name] ?? 0.95) * 100)}%
                </label>
              </div>
            ))}
          </>
        )}

        {hostChecks.map((name) => (
          <label className="checkbox" key={name}>
            <input type="checkbox" checked={host[name] ?? false} onChange={(e) => setHost({ ...host, [name]: e.target.checked })} />
            Pretend the app check <code>{name}</code> passes
          </label>
        ))}

        <div className="field">
          <label htmlFor="last">Bot&apos;s last message (for &quot;asked&quot;)</label>
          {asks.length > 0 ? (
            <select id="last" value={lastReply} onChange={(e) => setLastReply(e.target.value)}>
              <option value="">(nothing yet)</option>
              {asks.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          ) : (
            <input id="last" type="text" value={lastReply} onChange={(e) => setLastReply(e.target.value)} placeholder="(nothing yet)" />
          )}
        </div>

        <button className="btn" onClick={run}>
          Run ▶
        </button>

        {runError && <div className="result paid">{runError}</div>}

        {result && ex && (
          <div className={`result ${ex.free ? "free" : "paid"}`}>
            <p className="big">{ex.big}</p>
            {"text" in result && <div className="reply">{result.text}</div>}
            {ex.detail && <p className="hint">{ex.detail}</p>}
            <p className="hint">
              Rule used: <code>{result.path}</code>
            </p>
            <details>
              <summary className="hint">Show every rule danlang checked</summary>
              <ul className="trace">
                {result.trace.map((s, i) => (
                  <li key={i} className={s.matched ? "yes" : "no"}>
                    {s.matched ? "✓" : "✗"} {s.path}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </section>
    </main>
  );
}
