const fs = require("fs");
const ler = (n) => { try { return fs.readFileSync(__dirname + "/" + n, "utf8").trim(); } catch { return ""; } };
const antigo = globalThis.fetch;
globalThis.fetch = async (url, op) => {
  if (!String(url).includes("chat/completions")) return antigo(url, op);
  let r, erro;
  try { r = await antigo(url, op); } catch (e) { erro = e; }
  const chave = ler("omni-chave.txt"), b = JSON.parse(op.body);
  const falhou = !r || [401, 403, 413, 429].includes(r.status) || r.status >= 500;
  if (falhou && chave && !JSON.stringify(b.messages).includes("image_url")) {
    let u = (ler("omni-url.txt") || "http://localhost:20128/v1").replace(/\/+$/, "");
    if (!u.endsWith("/chat/completions")) u += "/chat/completions";
    b.model = ler("omni-modelo.txt") || "auto";
    if (b.max_completion_tokens) b.max_tokens = b.max_completion_tokens;
    for (const k of ["max_completion_tokens", "reasoning_effort", "include_reasoning"]) delete b[k];
    try {
      const o = await antigo(u, { ...op, headers: { "Content-Type": "application/json", Authorization: "Bearer " + chave }, body: JSON.stringify(b) });
      console.log("Groq falhou, OmniRoute respondeu com status " + o.status);
      if (o.ok) return o;
    } catch { console.log("OmniRoute desligado ou endereco errado"); }
  }
  if (r) return r;
  throw erro;
};
