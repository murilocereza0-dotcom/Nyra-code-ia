const http = require("http"), { AsyncLocalStorage } = require("async_hooks");
const guia = require("./guia.js"), pedido = new AsyncLocalStorage(), criar = http.createServer.bind(http);
http.createServer = (...args) => {
  const original = args.pop();
  return criar(...args, (req, res) => {
    if (req.url !== "/chat") return original(req, res);
    let info = {};
    try { info = JSON.parse(decodeURIComponent(req.headers["x-nyra"] || "{}")); } catch {}
    return pedido.run(info, () => original(req, res));
  });
};
const antigo = globalThis.fetch, espera = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
globalThis.fetch = async (url, op) => {
  const info = pedido.getStore();
  if (!info || !String(url).includes("chat/completions")) return antigo(url, op);
  const b = JSON.parse(op.body), s = b.messages[0];
  s.content += " " + guia;
  if (info.memoria) s.content += " Memória sobre o usuário (use quando ajudar): " + info.memoria;
  if (info.antes) s.content += " Assuntos de outras conversas: " + info.antes;
  if (info.pensar && String(b.model).includes("gpt-oss")) {
    b.reasoning_effort = "medium";
    s.content += " Pense com calma, compare soluções e revise antes de responder.";
  }
  const tamanho = () => Math.ceil(JSON.stringify(b.messages).length / 3.5);
  while (tamanho() > 4000 && b.messages.length > 2) b.messages.splice(1, 1);
  delete b.max_tokens;
  const quer = info.pensar ? 6000 : b.max_completion_tokens || 3500;
  b.max_completion_tokens = Math.max(1000, Math.min(quer, 7600 - tamanho()));
  for (let i = 0; ; i++) {
    let r, pausa = i + 1;
    try {
      r = await antigo(url, { ...op, body: JSON.stringify(b) });
      if (r.status !== 429 && r.status < 500) return r;
      pausa = Number(r.headers.get("retry-after")) || pausa * 2;
      if (i >= 2 || pausa > 15) return r;
    } catch (e) { if (i >= 2 || e.name === "AbortError") throw e; }
    await espera(pausa);
  }
};
