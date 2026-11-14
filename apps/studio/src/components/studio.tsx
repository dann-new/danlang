"use client";

/**
 * danlang Studio: your .dan tree as nodes. Hover a node to see its rule; send a test message to see the real
 * classifier sort it and the path light up. The .dan files are re-read every few seconds, so edits show up live.
 */
import type { Decision, Diagnostic, Program } from "@danlang/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flatten, layout, sourceBlock, type NodeKind, type TreeNode } from "@/lib/tree";

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

const COLORS: Record<NodeKind, string> = {
  message: "var(--message)",
  decision: "var(--decision)",
  free: "var(--free)",
  ask: "var(--ask)",
  model: "var(--model)",
};

const usd = (n: number | null | undefined) => (n == null ? "?" : n < 0.001 ? `$${n.toFixed(7)}` : `$${n.toFixed(4)}`);

function headline(d: Decision): string {
  switch (d.kind) {
    case "model":
      return "🤖 Sent to the big AI";
    case "reply":
      return "💬 Fixed reply (free)";
    case "refuse":
      return "🙅 Refused (free)";
    case "ask":
      return "❓ Asked first (free)";
    case "direct":
      return `⚙️ App code: ${d.name} (free)`;
  }
}

export function Studio() {
  const [folder, setFolder] = useState<string>("");
  const [data, setData] = useState<Loaded | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [host, setHost] = useState<Record<string, boolean>>({});
  const [useModel, setUseModel] = useState(false);
  const [hover, setHover] = useState<{ node: TreeNode; x: number; y: number } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit to screen

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
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [turns]);

  const tree = useMemo(() => (data?.program ? layout(data.program) : null), [data?.program]);
  const nodes = useMemo(() => (tree ? flatten(tree.root) : []), [tree]);

  const last = [...turns].reverse().find((t) => t.result)?.result;
  const onPath = useMemo(() => {
    if (!last) return null;
    const s = new Set<string>([""]);
    for (const step of last.decision.trace) if (step.matched) s.add(step.path);
    return s;
  }, [last]);
  const failed = useMemo(() => new Set(last?.decision.trace.filter((s) => !s.matched).map((s) => s.path) ?? []), [last]);

  const manualFields = data?.program ? Object.keys(data.program.fields).filter((f) => !data.classifierFields.includes(f)) : [];
  const hostChecks = data?.program ? Object.values(data.program.checks).filter((c) => c.host).map((c) => c.name) : [];
  const errors = data?.problems.filter((p) => p.severity === "error") ?? [];

  const send = async () => {
    const message = input.trim();
    if (!message || !data?.program || busy) return;
    setInput("");
    setBusy(true);
    const lastReply = [...turns].reverse().find((t) => t.botText)?.botText;
    const manualValues = Object.fromEntries(manualFields.map((f) => [f, manual[f] ?? data.program!.fields[f]![0]!]));
    setTurns((t) => [...t, { message }]);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, message, lastReply, manual: manualValues, hostChecks: host, askModel: useModel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Run failed");
      const result = json as RunResult;
      const d = result.decision;
      const botText = "text" in d ? d.text : result.model?.ok ? result.model.text : undefined;
      setTurns((t) => [...t.slice(0, -1), { message, result, ...(botText ? { botText } : {}) }]);
    } catch (e) {
      setTurns((t) => [...t.slice(0, -1), { message, error: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  // "Fit": scale the whole tree to the canvas width (never above 100%, never so small it can't be read).
  const [canvasW, setCanvasW] = useState(1000);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = tree ? Math.max(0.6, Math.min(1, (canvasW - 24) / tree.width)) : 1;
  const scale = zoom ?? fit;

  // Keep the interesting part in view: the root at first, then the end of the lit-up path.
  const focusX = useMemo(() => {
    if (!tree) return null;
    if (!onPath) return tree.root.x;
    const end = nodes.filter((n) => onPath.has(n.path)).sort((a, b) => b.y - a.y)[0];
    return end?.x ?? tree.root.x;
  }, [tree, nodes, onPath]);
  useEffect(() => {
    const el = canvasRef.current;
    if (el && focusX != null) el.scrollTo({ left: focusX * scale - el.clientWidth / 2, behavior: "smooth" });
  }, [focusX, scale]);

  const edges = nodes.flatMap((n) => n.children.map((c) => ({ from: n, to: c })));

  return (
    <div className="studio">
      <header className="bar">
        <div className="logo">
          dan<span>lang</span> Studio
        </div>
        <select aria-label="Example folder" value={folder} onChange={(e) => { setFolder(e.target.value); setTurns([]); }}>
          {data?.folders.map((f) => (
            <option key={f} value={f}>
              examples/{f}
            </option>
          ))}
        </select>
        <button onClick={() => setTurns([])}>Clear chat</button>
        <span className="spacer" />
        <span className="status">
          classifier {data?.keys.classifier ? "✓" : "✗ no key"} · big AI {data?.keys.model ? "✓" : "✗ no key"} · live reload
        </span>
      </header>

      <main ref={canvasRef} className={`canvas ${onPath ? "dimmed" : ""}`}>
        <div className="zoom">
          <button onClick={() => setZoom(Math.max(0.3, scale - 0.15))} aria-label="Zoom out">−</button>
          <button onClick={() => setZoom(null)}>Fit</button>
          <button onClick={() => setZoom(Math.min(2, scale + 0.15))} aria-label="Zoom in">+</button>
          <span>{Math.round(scale * 100)}%</span>
        </div>
        {tree && (
          <svg width={tree.width * scale} height={tree.height * scale} viewBox={`0 0 ${tree.width} ${tree.height}`} role="img" aria-label="Routing tree">
            {edges.map(({ from, to }) => (
              <path
                key={to.path}
                className={`edge ${onPath?.has(from.path) && onPath.has(to.path) ? "on" : ""}`}
                d={`M${from.x},${from.y + 20} C${from.x},${(from.y + to.y) / 2} ${to.x},${(from.y + to.y) / 2} ${to.x},${to.y - 20}`}
              />
            ))}
            {nodes.map((n) => (
              <g
                key={n.path || "root"}
                className={`node ${onPath?.has(n.path) ? "on" : ""} ${failed.has(n.path) ? "failed" : ""}`}
                transform={`translate(${n.x},${n.y})`}
                onMouseMove={(e) => setHover({ node: n, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
              >
                <circle r={n.kind === "message" ? 24 : 18} fill={COLORS[n.kind]} />
                <text className="name" y={n.kind === "message" ? 42 : 36} textAnchor="middle">
                  {n.name}
                </text>
                <text className="sub" y={n.kind === "message" ? 57 : 51} textAnchor="middle">
                  {n.sub.length > 24 ? n.sub.slice(0, 23) + "…" : n.sub}
                </text>
              </g>
            ))}
          </svg>
        )}
        {!tree && <p style={{ padding: 16 }}>Loading…</p>}
        <div className="legend">
          <span><i style={{ background: COLORS.message }} />Message</span>
          <span><i style={{ background: COLORS.decision }} />Decision</span>
          <span><i style={{ background: COLORS.free }} />Free (fixed reply / app code)</span>
          <span><i style={{ background: COLORS.ask }} />Asks first / refused</span>
          <span><i style={{ background: COLORS.model }} />Big AI</span>
        </div>
      </main>

      {hover && hover.node.kind !== "message" && (
        <div className="tip" style={{ left: Math.min(hover.x + 16, window.innerWidth - 540), top: hover.y + 16 }}>
          <div className="where">
            {hover.node.file}:{hover.node.line} · path <code>{hover.node.path}</code>
          </div>
          <pre>{sourceBlock(data?.sources ?? {}, hover.node.file, hover.node.line)}</pre>
        </div>
      )}

      <aside className="side">
        {errors.length > 0 && (
          <ul className="problems">
            {errors.map((p, i) => (
              <li key={i}>
                {p.pos.file}:{p.pos.line} {p.message}
              </li>
            ))}
          </ul>
        )}
        <div className="controls">
          {manualFields.map((f) => (
            <label key={f}>
              <span className="k">{f}</span>
              <select value={manual[f] ?? data!.program!.fields[f]![0]} onChange={(e) => setManual({ ...manual, [f]: e.target.value })}>
                {data!.program!.fields[f]!.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
          {hostChecks.map((c) => (
            <label key={c}>
              <input type="checkbox" checked={host[c] ?? false} onChange={(e) => setHost({ ...host, [c]: e.target.checked })} />
              app check <code>{c}</code> passes
            </label>
          ))}
          <label>
            <input type="checkbox" checked={useModel} onChange={(e) => setUseModel(e.target.checked)} disabled={!data?.keys.model} />
            Also ask the big AI when a rule says <code>model</code> (costs money)
          </label>
        </div>

        <div className="chat" ref={chatRef}>
          {turns.length === 0 && (
            <p className="meta">
              Type a message as a user would. The classifier ({data?.classifierFields.join(", ") || "none"}) sorts it, and the path it takes lights up on the left.
            </p>
          )}
          {turns.map((t, i) => (
            <div key={i} style={{ display: "contents" }}>
              <div className="msg-user">{t.message}</div>
              {!t.result && !t.error && <div className="msg-bot meta">thinking…</div>}
              {t.error && <div className="msg-bot">⚠️ {t.error}</div>}
              {t.result && (
                <div className="msg-bot">
                  <div className="head">{headline(t.result.decision)}</div>
                  {t.botText && <div className="text">{t.botText}</div>}
                  {t.result.model && !t.result.model.ok && <div className="meta">⚠️ {t.result.model.error}</div>}
                  <div className="chips">
                    {Object.entries(t.result.facts).map(([k, v]) => (
                      <span className="chip" key={k}>
                        {k}: <b>{v}</b>
                        {t.result!.confidence[k] !== undefined ? ` ${Math.round(t.result!.confidence[k]! * 100)}%` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="meta">
                    path <code>{t.result.decision.path}</code>
                    {t.result.classifier.ok
                      ? ` · classifier ${t.result.classifier.ms} ms, ${usd(t.result.classifier.costUsd)}`
                      : ` · classifier failed: ${t.result.classifier.error}`}
                    {t.result.model?.ok ? ` · big AI ${t.result.model.ms} ms, ${usd(t.result.model.costUsd)}` : ""}
                  </div>
                </div>
              )}
            </div>
          ))}
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
      </aside>
    </div>
  );
}
