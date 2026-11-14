"use client";

/**
 * danlang Studio: your .dan tree as nodes (left to right), a test chat that uses the real classifier, and a timeline
 * of the nodes each message went through. Hover a node to see its rule and every message it can say.
 */
import type { ConversationState, Decision, Diagnostic, Program } from "@danlang/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flatten, layout, NODE_H, NODE_W, sourceBlock, type NodeKind, type TreeNode } from "@/lib/tree";

type Loaded = {
  folder: string;
  folders: string[];
  program: Program | null;
  sources: Record<string, string>;
  problems: Diagnostic[];
  classifierFields: string[];
  keys: { classifier: boolean; model: boolean };
};

type RunResult = {
  classifier: { ok: true; facts: Record<string, string>; confidence: Record<string, number>; costUsd: number | null; ms: number } | { ok: false; error: string; ms: number };
  facts: Record<string, string | undefined>;
  confidence: Record<string, number>;
  decision: Decision;
  model: { ok: true; text: string; costUsd: number | null; ms: number } | { ok: false; error: string } | null;
};

type Turn = { message: string; result?: RunResult; error?: string; botText?: string };

const KIND: Record<NodeKind, { color: string; label: string }> = {
  message: { color: "var(--k-message)", label: "Message" },
  decision: { color: "var(--k-decision)", label: "Decision" },
  free: { color: "var(--k-free)", label: "Free answer" },
  ask: { color: "var(--k-ask)", label: "Asks / refuses" },
  model: { color: "var(--k-model)", label: "Big AI" },
  uproot: { color: "var(--k-uproot)", label: "Uproot" },
};

const TOP: ConversationState = { at: [], found: [] };
const usd = (n: number | null | undefined) => (n == null ? "?" : n < 0.001 ? `$${n.toFixed(6)}` : `$${n.toFixed(4)}`);
const short = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function headline(d: Decision): { icon: string; text: string; free: boolean } {
  switch (d.kind) {
    case "model":
      return { icon: "🤖", text: "Big AI answers", free: false };
    case "reply":
      return { icon: "💬", text: "Fixed reply", free: true };
    case "refuse":
      return { icon: "🙅", text: "Refused", free: true };
    case "ask":
      return { icon: "❓", text: "Asked, now waiting", free: true };
    case "direct":
      return { icon: "⚙️", text: `App code: ${d.name}`, free: true };
  }
}

type StepKind = "resume" | "node" | "up" | "end";

/** The nodes one message went through, in order, for the timeline. */
function steps(d: Decision): { label: string; kind: StepKind }[] {
  const out: { label: string; kind: StepKind }[] = [];
  if (d.startedAt) out.push({ label: `resumed at ${d.startedAt.split("/").pop()}`, kind: "resume" });
  let moveIdx = 0;
  let prevDepth = Infinity;
  for (const s of d.trace) {
    if (!s.matched) continue;
    const depth = s.path.split("/").length;
    // A matched rule that's not deeper than the last one means an uproot happened in between.
    if (depth <= prevDepth && prevDepth !== Infinity && d.moves[moveIdx]) {
      const m = d.moves[moveIdx++]!;
      out.push({ label: `↑ uproot to ${m.to ? m.to.split("/").pop() : "top"}`, kind: "up" });
    }
    prevDepth = depth;
    out.push({ label: s.path.split("/").pop()!, kind: "node" });
  }
  if (out.length) out[out.length - 1]!.kind = "end";
  return out;
}

export function Studio() {
  const [folder, setFolder] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [state, setState] = useState<ConversationState>(TOP);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [host, setHost] = useState<Record<string, boolean>>({});
  const [useModel, setUseModel] = useState(false);
  const [hover, setHover] = useState<{ node: TreeNode; x: number; y: number } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (f: string) => {
    const res = await fetch(`/api/program${f ? `?folder=${encodeURIComponent(f)}` : ""}`, { cache: "no-store" });
    const json = (await res.json()) as Loaded;
    setData(json);
    setFolder((cur) => cur || json.folder);
  }, []);

  // Load now, then re-read every 2 seconds so .dan edits appear live.
  useEffect(() => {
    void load(folder);
    const t = setInterval(() => void load(folder), 2000);
    return () => clearInterval(t);
  }, [folder, load]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const tree = useMemo(() => (data?.program ? layout(data.program) : null), [data?.program]);
  const nodes = useMemo(() => (tree ? flatten(tree.root) : []), [tree]);
  const byPath = useMemo(() => new Map(nodes.map((n) => [n.path, n])), [nodes]);

  // Which turn the tree shows: the one clicked in the timeline, else the latest.
  const shownIdx = selected ?? turns.map((t, i) => (t.result ? i : -1)).filter((i) => i >= 0).pop() ?? null;
  const shown = shownIdx != null ? turns[shownIdx]?.result : undefined;

  const lit = useMemo(() => {
    const on = new Set<string>();
    const resumed = new Set<string>();
    const failed = new Set<string>();
    if (!shown) return { on, resumed, failed };
    on.add("");
    const d = shown.decision;
    if (d.startedAt) {
      const segs = d.startedAt.split("/");
      segs.forEach((_, i) => resumed.add(segs.slice(0, i + 1).join("/")));
    }
    for (const s of d.trace) (s.matched ? on : failed).add(s.path);
    return { on, resumed, failed };
  }, [shown]);
  const waitingAt = state.at.join("/");

  // Keep the end of the lit path in view.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !shown) return;
    const end = byPath.get(shown.decision.path);
    if (end) el.scrollTo({ left: Math.max(0, end.x - el.clientWidth / 2), top: Math.max(0, end.y - el.clientHeight / 2), behavior: "smooth" });
  }, [shown, byPath]);

  const manualFields = data?.program ? Object.keys(data.program.fields).filter((f) => !data.classifierFields.includes(f)) : [];
  const hostChecks = data?.program ? Object.values(data.program.checks).filter((c) => c.host).map((c) => c.name) : [];
  const errors = data?.problems.filter((p) => p.severity === "error") ?? [];

  const reset = () => {
    setTurns([]);
    setSelected(null);
    setState(TOP);
  };

  const send = async () => {
    const message = input.trim();
    if (!message || !data?.program || busy) return;
    setInput("");
    setBusy(true);
    setSelected(null);
    const lastReply = [...turns].reverse().find((t) => t.botText)?.botText;
    const manualValues = Object.fromEntries(manualFields.map((f) => [f, manual[f] ?? data.program!.fields[f]![0]!]));
    setTurns((t) => [...t, { message }]);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, message, lastReply, manual: manualValues, hostChecks: host, askModel: useModel, state }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Run failed");
      const result = json as RunResult;
      const d = result.decision;
      const botText = "text" in d ? d.text : result.model?.ok ? result.model.text : undefined;
      setState(d.state);
      setTurns((t) => [...t.slice(0, -1), { message, result, ...(botText ? { botText } : {}) }]);
    } catch (e) {
      setTurns((t) => [...t.slice(0, -1), { message, error: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  const edges = nodes.flatMap((n) => n.children.map((c) => ({ from: n, to: c })));

  return (
    <div className="studio">
      <header className="bar">
        <div className="logo">
          dan<span>lang</span> <b>Studio</b>
        </div>
        <select aria-label="Example folder" value={folder} onChange={(e) => { setFolder(e.target.value); reset(); }}>
          {data?.folders.map((f) => (
            <option key={f} value={f}>
              examples/{f}
            </option>
          ))}
        </select>
        <div className="legend">
          {(Object.keys(KIND) as NodeKind[]).map((k) => (
            <span key={k}>
              <i style={{ background: KIND[k].color }} />
              {KIND[k].label}
            </span>
          ))}
        </div>
        <span className="spacer" />
        <span className={`pill ${data?.keys.classifier ? "ok" : "bad"}`}>classifier {data?.keys.classifier ? "on" : "no key"}</span>
        <span className={`pill ${data?.keys.model ? "ok" : "bad"}`}>big AI {data?.keys.model ? "on" : "no key"}</span>
      </header>

      <section className="left">
        <div className={`canvas ${shown ? "dimmed" : ""}`} ref={canvasRef}>
          {tree ? (
            <svg width={tree.width} height={tree.height} role="img" aria-label="Routing tree">
              <defs>
                <filter id="glow" x="-20%" y="-50%" width="140%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {edges.map(({ from, to }) => {
                const x1 = from.x + NODE_W;
                const y1 = from.y + NODE_H / 2;
                const x2 = to.x;
                const y2 = to.y + NODE_H / 2;
                const mid = (x1 + x2) / 2;
                const on = (lit.on.has(from.path) || lit.resumed.has(from.path)) && lit.on.has(to.path);
                return (
                  <path
                    key={to.path}
                    className={`edge ${on ? "on" : ""} ${lit.resumed.has(to.path) ? "resumed" : ""}`}
                    d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  />
                );
              })}
              {nodes.map((n) => {
                const k = KIND[n.kind];
                const cls = ["node", lit.on.has(n.path) ? "on" : "", lit.resumed.has(n.path) ? "resumed" : "", lit.failed.has(n.path) ? "failed" : ""].join(" ");
                return (
                  <g
                    key={n.path || "root"}
                    className={cls}
                    transform={`translate(${n.x},${n.y})`}
                    onMouseMove={(e) => setHover({ node: n, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <rect className="card" width={NODE_W} height={NODE_H} rx={12} />
                    <rect width={6} height={NODE_H} rx={3} fill={k.color} />
                    <circle cx={22} cy={NODE_H / 2} r={6} fill={k.color} />
                    <text className="name" x={36} y={22}>
                      {short(n.name, 20)}
                    </text>
                    <text className="sub" x={36} y={39}>
                      {short(n.sub, 26)}
                    </text>
                    {n.texts.length > 0 && (
                      <text className="count" x={NODE_W - 12} y={22} textAnchor="end">
                        💬{n.texts.length}
                      </text>
                    )}
                    {waitingAt && n.path === waitingAt && (
                      <g className="pin" transform={`translate(${NODE_W - 78}, -12)`}>
                        <rect width={80} height={22} rx={11} />
                        <text x={40} y={15} textAnchor="middle">
                          ⏸ waiting
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <p className="empty">Loading…</p>
          )}
        </div>

        <div className="timeline">
          <div className="timeline-head">
            Timeline <span>{turns.length ? "click a message to see its path" : "send a message to start"}</span>
          </div>
          <div className="timeline-row">
            {turns.map((t, i) => (
              <button key={i} className={`turn ${i === shownIdx ? "active" : ""}`} onClick={() => setSelected(i)} disabled={!t.result}>
                <div className="turn-msg">
                  <b>#{i + 1}</b> {short(t.message, 42)}
                </div>
                <div className="turn-steps">
                  {t.result ? (
                    steps(t.result.decision).map((s, j) => (
                      <span key={j} className={`step ${s.kind}`}>
                        {s.label}
                      </span>
                    ))
                  ) : (
                    <span className="step">{t.error ? "error" : "…"}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {hover && hover.node.kind !== "message" && (
        <div className="tip" style={{ left: Math.min(hover.x + 18, window.innerWidth - 500), top: Math.min(hover.y + 18, window.innerHeight - 320) }}>
          <div className="tip-head">
            <i style={{ background: KIND[hover.node.kind].color }} />
            <b>{hover.node.name}</b>
            <span>{KIND[hover.node.kind].label}</span>
          </div>
          <div className="tip-where">
            {hover.node.file}:{hover.node.line} · {hover.node.path}
          </div>
          <pre>{sourceBlock(data?.sources ?? {}, hover.node.file, hover.node.line)}</pre>
          {hover.node.texts.length > 0 && (
            <>
              <div className="tip-sub">Can say (one picked at random):</div>
              <ul>
                {hover.node.texts.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <aside className="side">
        <div className={`status ${waitingAt ? "waiting" : ""}`}>
          {waitingAt ? (
            <>
              <div>
                <b>⏸ Waiting at {waitingAt}</b>
                <div className="hint">
                  The next message is checked from here.{state.found.length ? ` Remembers: ${state.found.join(", ")}.` : ""}
                </div>
              </div>
              <button onClick={() => setState(TOP)}>Back to top</button>
            </>
          ) : (
            <div>
              <b>At the top</b>
              <div className="hint">The next message starts at Message.</div>
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <ul className="problems">
            {errors.map((p, i) => (
              <li key={i}>
                {p.pos.file}:{p.pos.line} {p.message}
              </li>
            ))}
          </ul>
        )}

        <details className="controls">
          <summary>Test settings</summary>
          {manualFields.map((f) => (
            <label key={f}>
              <span>{f}</span>
              <select value={manual[f] ?? data!.program!.fields[f]![0]} onChange={(e) => setManual({ ...manual, [f]: e.target.value })}>
                {data!.program!.fields[f]!.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          {hostChecks.map((c) => (
            <label key={c} className="check">
              <input type="checkbox" checked={host[c] ?? false} onChange={(e) => setHost({ ...host, [c]: e.target.checked })} />
              app check <code>{c}</code> passes
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={useModel} onChange={(e) => setUseModel(e.target.checked)} disabled={!data?.keys.model} />
            Also get the big AI&apos;s answer (costs money)
          </label>
        </details>

        <div className="chat" ref={chatRef}>
          {turns.length === 0 && (
            <div className="empty-chat">
              <b>Test your bot</b>
              <p>Type what a user would type. The classifier ({data?.classifierFields.join(", ") || "none"}) sorts it, and its path lights up in the tree.</p>
            </div>
          )}
          {turns.map((t, i) => {
            const h = t.result ? headline(t.result.decision) : null;
            return (
              <div key={i} className={`pair ${i === shownIdx ? "active" : ""}`} onClick={() => t.result && setSelected(i)}>
                <div className="msg-user">{t.message}</div>
                {!t.result && !t.error && <div className="msg-bot thinking">thinking…</div>}
                {t.error && <div className="msg-bot">⚠️ {t.error}</div>}
                {t.result && h && (
                  <div className="msg-bot">
                    <div className="head">
                      <span>
                        {h.icon} {h.text}
                      </span>
                      <span className={`tag ${h.free ? "free" : "paid"}`}>{h.free ? "free" : "AI"}</span>
                    </div>
                    {t.botText && <div className="text">{t.botText}</div>}
                    {t.result.model && !t.result.model.ok && <div className="hint">⚠️ {t.result.model.error}</div>}
                    <div className="chips">
                      {Object.entries(t.result.facts).map(([k, v]) => (
                        <span className="chip" key={k}>
                          {k} <b>{v}</b>
                          {t.result!.confidence[k] !== undefined ? <em>{Math.round(t.result!.confidence[k]! * 100)}%</em> : null}
                        </span>
                      ))}
                    </div>
                    <div className="hint">
                      {t.result.decision.path}
                      {t.result.classifier.ok
                        ? ` · ${t.result.classifier.ms} ms · ${usd(t.result.classifier.costUsd)}`
                        : ` · classifier failed: ${t.result.classifier.error}`}
                      {t.result.model?.ok ? ` · AI ${usd(t.result.model.costUsd)}` : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a test message…" aria-label="Test message" />
          <button disabled={busy || !input.trim() || errors.length > 0}>{busy ? "…" : "Send"}</button>
        </form>
        <button className="link" onClick={reset}>
          Clear chat
        </button>
      </aside>
    </div>
  );
}
