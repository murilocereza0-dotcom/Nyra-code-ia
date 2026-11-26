const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = process.env.PORT || 3000;
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODELO = process.env.NYRA_MODELO || 'qwen2.5-coder:1.5b';
const SISTEMA = 'Você é a NYRA CODE AI, uma assistente de programação. Responda sempre em português do Brasil, de forma curta e clara. Coloque código em blocos com três crases. Se não souber algo, diga que não sabe.';

http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  if (req.method !== 'POST' || req.url !== '/chat') {
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
      if (corpo.length > 100000) throw new Error('mensagem grande demais');
    }
    const historico = JSON.parse(corpo).mensagens.slice(-6);
    const r = await fetch(OLLAMA + '/api/chat', {
      method: 'POST',
      signal: parar.signal,
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: 'system', content: SISTEMA }, ...historico],
        stream: true,
        keep_alive: '30m',
        options: { temperature: 0.3, num_ctx: 2048 }
      })
    });
    if (!r.ok) throw new Error(await r.text());
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    const texto = new TextDecoder();
    let resto = '';
    for await (const pedaco of r.body) {
      resto += texto.decode(pedaco, { stream: true });
      const linhas = resto.split('\n');
      resto = linhas.pop();
      for (const linha of linhas) {
        if (!linha.trim()) continue;
        const dado = JSON.parse(linha);
        if (dado.error) throw new Error(dado.error);
        res.write(dado.message?.content || '');
      }
    }
    res.end();
  } catch (erro) {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro: ' + erro.message);
  }
}).listen(PORTA, '127.0.0.1', () => console.log('NYRA ligada em http://localhost:' + PORTA));
