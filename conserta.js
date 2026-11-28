const antigo = globalThis.fetch;
globalThis.fetch = async (url, op) => {
  if (!String(url).includes("chat/completions")) return antigo(url, op);
  const b = JSON.parse(op.body);
  if ("reasoning" in b) {
    const e = b.reasoning && b.reasoning.effort;
    if (String(b.model).includes("gpt-oss") && ["low", "medium", "high"].includes(e)) b.reasoning_effort = e;
    delete b.reasoning;
  }
  for (let i = 0; ; i++) {
    const r = await antigo(url, { ...op, body: JSON.stringify(b) });
    if (r.status !== 400 || i > 4) return r;
    const m = (await r.clone().text()).match(/property \W*(\w+)\W* is unsupported/);
    if (!m || !(m[1] in b)) return r;
    delete b[m[1]];
  }
};
