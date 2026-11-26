const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = process.env.PORT || 3000;
const URL_API = process.env.NYRA_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MODELO = process.env.NYRA_MODELO || 'openai/gpt-oss-20b';
const lerChave = () => process.env.NYRA_API_KEY || (() => {
  try {
    return fs.readFileSync(path.join(__dirname, 'chave.txt'), 'utf8').trim();
  } catch {
    return '';
  }
})();
const SISTEMA = 'Você é a NYRA CODE AI, uma assistente de programação criada por Murilo com a ajuda do Claude. A interface e o código do app são o projeto do Murilo, e seu modelo de linguagem é o gpt-oss-20b da OpenAI, rodando na Groq. Responda em português do Brasil. Coloque código em blocos com três crases. Se não souber algo, diga que não sabe.';
const TAMANHOS = {
  curta: ['Responda de forma bem curta.', 1200],
  normal: ['Responda de forma clara e objetiva.', 2500],
  detalhada: ['Explique com detalhes, passo a passo.', 4000]
};

http.createServer(async (req, res) => {
  if (req.url === '/icone.png' || req.url === '/manifest.json') { res.writeHead(200, { 'Content-Type': req.url.endsWith('png') ? 'image/png' : 'application/manifest+json' }); return fs.createReadStream(path.join(__dirname, req.url.slice(1))).pipe(res); }
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ modelo: MODELO, chave: Boolean(lerChave()) }));
  }
  if (req.method !== 'POST' || req.url !== '/chat' || req.headers['content-type'] !== 'application/json') {
    res.writeHead(404);
    return res.end();
  }
  const parar = new AbortController();
  res.on('close', () => parar.abort());
  try {
    req.setEncoding('utf8');
    let corpo = '';
    for await (const parte of req) {
      corpo += parte;
      if (corpo.length > 200000) throw new Error('mensagem grande demais');
    }
    const pedido = JSON.parse(corpo);
    const historico = [];
    let total = 0;
    for (const m of pedido.mensagens.slice(-10).reverse()) {
      total += m.content.length;
      if (historico.length && total > 10000) break;
      historico.unshift({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
    const [estilo, limite] = TAMANHOS[pedido.tamanho] || TAMANHOS.normal;
    let sistema = SISTEMA + ' ' + estilo;
    if (pedido.linguagem) sistema += ' Quando escrever código, use ' + String(pedido.linguagem).slice(0, 30) + '.';
    if (pedido.extra) sistema += ' Instruções do usuário: ' + String(pedido.extra).slice(0, 500);
    const r = await fetch(URL_API, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + lerChave(), 'Content-Type': 'application/json' },
      signal: parar.signal,
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: 'system', content: sistema }, ...historico],
        stream: true,
        temperature: Math.min(1, Math.max(0, Number(pedido.criatividade) || 0)),
        reasoning_effort: 'low',
        include_reasoning: false,
        max_completion_tokens: limite
      })
    });
    if (!r.ok) {
      const avisos = { 401: 'Chave da Groq inválida.', 413: 'Mensagem grande demais para o plano grátis.', 429: 'Limite grátis atingido. Espere um pouco e tente de novo.' };
      res.writeHead(r.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(avisos[r.status] || await r.text());
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    const texto = new TextDecoder();
    let resto = '';
    for await (const pedaco of r.body) {
      resto += texto.decode(pedaco, { stream: true });
      const linhas = resto.split('\n');
      resto = linhas.pop();
      for (const linha of linhas) {
        if (!linha.startsWith('data: ') || linha.includes('data: [DONE]')) continue;
        const dado = JSON.parse(linha.slice(6));
        if (dado.error) throw new Error(dado.error.message);
        res.write(dado.choices?.[0]?.delta?.content || '');
      }
    }
    res.end();
  } catch (erro) {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro: ' + erro.message);
  }
}).listen(PORTA, process.env.NYRA_ABERTA ? '0.0.0.0' : '127.0.0.1', () => console.log('NYRA ligada em http://localhost:' + PORTA));
