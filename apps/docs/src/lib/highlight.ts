/**
 * Colors danlang code as HTML spans. Shared by the lesson pages (server) and the Try it editor (browser).
 * Same idea as the editor extension's grammar, kept small on purpose.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const span = (cls: string, s: string) => `<span class="t-${cls}">${esc(s)}</span>`;

const TOKEN =
  /("(?:\\.|[^"\\])*"?)|(#.*$)|(->|>=|==|=)|\b(flow|field|let|use|check|when|else|and|or|not|has|asked)\b|\b(model)\b|\b(reply|refuse|ask|direct)\b|(\b\d+(?:\.\d+)?\b)/g;

function line(text: string): string {
  const check = /^(check)(\s+)([A-Za-z_]\w*)(\s*=\s*)(.*)$/.exec(text);
  if (check) {
    const [, kw, sp, name, eq, rest] = check as unknown as string[];
    return span("kw", kw!) + sp + span("fn", name!) + esc(eq!) + span(rest === "host" ? "act" : "re", rest!);
  }
  let out = "";
  let i = 0;
  const branch = /^(\s+)([A-Za-z0-9_][\w-]*)(:)(?=\s|$)/.exec(text);
  if (branch) {
    out += branch[1] + span("name", branch[2]!) + esc(":");
    i = branch[0].length;
  }
  TOKEN.lastIndex = i;
  let m: RegExpExecArray | null;
  let afterArrow = false;
  while ((m = TOKEN.exec(text))) {
    let between = text.slice(i, m.index);
    // A plain word right after "->" is a jump to another flow.
    if (afterArrow) {
      between = between.replace(/^(\s*)([A-Za-z_]\w*)/, (_, s: string, w: string) => s + "\u0000" + w + "\u0001");
    }
    out += esc(between).replace(/\u0000(.*?)\u0001/, '<span class="t-flow">$1</span>');
    const [tok] = m;
    if (m[1]) out += span("str", tok);
    else if (m[2]) out += span("cmt", tok);
    else if (m[3]) out += span("op", tok);
    else if (m[4]) out += span("kw", tok);
    else if (m[5]) out += span("ai", tok);
    else if (m[6]) out += span("act", tok);
    else if (m[7]) out += span("num", tok);
    afterArrow = tok === "->";
    i = m.index + tok.length;
  }
  let tail = text.slice(i);
  if (afterArrow) {
    const w = /^(\s*)([A-Za-z_]\w*)(.*)$/.exec(tail);
    if (w) return out + esc(w[1]!) + span("flow", w[2]!) + esc(w[3]!);
  }
  return out + esc(tail);
}

export function highlightDan(code: string): string {
  return code.split("\n").map(line).join("\n");
}

/** Encodes code for the Try it link (#code=...). Works on the server and in the browser. */
export function encodeCode(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
