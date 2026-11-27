const http = require("http"), fs = require("fs"), path = require("path");
const criar = http.createServer.bind(http);
const url = process.env.NYRA_URL || "https://api.groq.com/openai/v1/chat/completions";
http.createServer = (...args) => {
  const original = args.pop();
  return criar(...args, async (req, res) => {
    if (req.method !== "POST" || req.url !== "/imagem" || req.headers["content-type"] !== "application/json") return original(req, res);
    const fim = (n, t) => { res.writeHead(n, { "Content-Type": "text/plain; charset=utf-8" }); res.end(t); };
    try {
      req.setEncoding("utf8"); let corpo = "";
      for await (const parte of req) { corpo += parte; if (corpo.length > 3000000) throw new Error("imagem grande demais"); }
      const p = JSON.parse(corpo);
      if (!String(p.imagem).startsWith("data:image/")) throw new Error("imagem inválida");
      const msgs = p.mensagens.slice(-3).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }));
      const ultima = msgs[msgs.length - 1];
      ultima.content = [{ type: "text", text: ultima.content }, { type: "image_url", image_url: { url: p.imagem } }];
      const chave = fs.readFileSync(path.join(__dirname, "chave.txt"), "utf8").trim();
      const sistema = "Você é a NYRA CODE AI, assistente de programação criada por Murilo com a ajuda do Claude. Para ver imagens você usa o modelo Qwen na Groq. Responda em português do Brasil, com código em blocos de três crases. Se não der para ler algo na imagem, diga.";
      const r = await fetch(url, { method: "POST", headers: { Authorization: "Bearer " + chave, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "qwen/qwen3.8-27b", messages: [{ role: "system", content: sistema }, ...msgs], reasoning_effort: "none", max_completion_tokens: 2500 }) });
      const d = await r.json();
      if (!r.ok) return fim(r.status, "Erro na imagem: " + (d.error?.message || r.status));
      fim(200, d.choices[0].message.content);
    } catch (e) { fim(500, "Erro na imagem: " + e.message); }
  });
};
