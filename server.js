require("./rota.js");
require("./cerebro.js");
require("./conserta.js");
require("./imagem.js");
/*estilo*/
const fetchAntigo = globalThis.fetch;
globalThis.fetch = (url, op) => {
  if (String(url).includes("chat/completions")) {
    const b = JSON.parse(op.body);
    const guia = "Quando o código criar algo visual (site, app, botão, jogo ou tela), entregue com design bonito e moderno mesmo sem pedirem: fundo escuro, cor de destaque com gradiente, fonte legível, bom espaçamento, cantos arredondados, sombras suaves, elementos centralizados com tamanho proporcional (um botão nunca ocupa a tela toda), animação ao tocar e layout bom no celular. Em HTML, entregue um arquivo completo com CSS, JavaScript e meta viewport. Em Kivy, use size_hint=(None, None), medidas em dp, centralize, use background_normal vazio e desenhe cantos arredondados no canvas. Em Tkinter, use cores, espaçamento e fontes. Entregue o código completo e funcionando. Se pedirem outro estilo, siga o pedido.";
    const s = b.messages.find((m) => m.role === "system");
    if (s) s.content += " " + guia; else b.messages.unshift({ role: "system", content: guia });
    b.model = b.model.replace("gpt-oss-20b", "gpt-oss-120b");
    b.max_completion_tokens = Math.max(b.max_completion_tokens || 0, 3500);
    op = { ...op, body: JSON.stringify(b) };
  }
  return fetchAntigo(url, op);
};
/*fim-estilo*/

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORTA = process.env.PORT || 3000;
const URL_API = process.env.NYRA_URL || 'https://api.groq.com/openai/v1/chat/completions';
const MODELO = process.env.NYRA_MODELO || 'openai/gpt-oss-120b';

const lerChave = () =>
  process.env.OPENROUTER_API_KEY ||
  process.env.NYRA_API_KEY ||
  (() => {
    try {
      return fs.readFileSync(path.join(__dirname, "chave.txt"), "utf8").trim();
    } catch {
      return "";
    }
  })();

const SISTEMA = 'Você é a NYRA CODE AI, uma assistente de programação criada por Murilo com a ajuda do claude. Responda em português do Brasil. Coloque código em blocos com três crases. Se não souber algo, diga que não sabe.';

const TAMANHOS = {
  curta: ['Responda de forma bem curta.', 1200],
  normal: ['Responda de forma clara e objetiva.', 2500],
  detalhada: ['Explique com detalhes, passo a passo.', 4000]
};

// Chamada não-streaming usada pelo modo Think
async function chamarIA(mensagens, signal, limite, criatividade) {
  const r = await fetch(URL_API, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + lerChave(),
      'Content-Type': 'application/json'
    },
    signal,
    body: JSON.stringify({
      model: MODELO,
      messages: mensagens,
      stream: false,
      temperature: criatividade,
      reasoning: { effort: "low" },
      max_tokens: limite
    })
  });

  if (!r.ok) {
    const avisos = {
      401: 'Chave da Groq inválida.',
      413: 'Mensagem grande demais.',
      429: 'Limite da Groq atingido.'
    };
    throw new Error(avisos[r.status] || await r.text());
  }

  const dados = await r.json();
  const conteudo = dados.choices?.[0]?.message?.content;

  if (!conteudo) throw new Error('A IA não retornou conteúdo.');
  return conteudo;
}

http.createServer(async (req, res) => {
  if (req.url === '/icone.png' || req.url === '/manifest.json') {
    res.writeHead(200, {
      'Content-Type': req.url.endsWith('png')
        ? 'image/png'
        : 'application/manifest+json'
    });
    return fs.createReadStream(path.join(__dirname, req.url.slice(1))).pipe(res);
  }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }

  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      modelo: MODELO,
      chave: Boolean(lerChave())
    }));
  }

  if (req.method !== 'POST' || req.url !== '/chat' ||
      !req.headers['content-type']?.includes('application/json')) {
    res.writeHead(404);
    return res.end();
  }

  const parar = new AbortController();

  res.on('close', () => {
    if (!res.writableEnded) parar.abort();
  });

  let timer;
  let tempoEsgotado = false;

  try {
    req.setEncoding('utf8');
    let corpo = '';

    for await (const parte of req) {
      corpo += parte;
      if (corpo.length > 200000) {
        throw new Error('Mensagem grande demais.');
      }
    }

    const pedido = JSON.parse(corpo);
    const historico = [];
    let total = 0;

    for (const m of (pedido.mensagens || []).slice(-10).reverse()) {
      if (typeof m.content !== 'string') continue;
      total += m.content.length;
      if (historico.length && total > 10000) break;

      historico.unshift({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      });
    }

    const [estilo, limite] =
      TAMANHOS[pedido.tamanho] || TAMANHOS.normal;

    let sistema = SISTEMA + ' ' + estilo;

    if (pedido.linguagem) {
      sistema += ' Quando escrever código, use ' +
        String(pedido.linguagem).slice(0, 30) + '.';
    }

    if (pedido.extra) {
      sistema += ' Instruções do usuário: ' +
        String(pedido.extra).slice(0, 500);
    }

    const criatividade = Math.min(
      1,
      Math.max(0, Number(pedido.criatividade) || 0)
    );

    // MODO NYRA THINK
    if (pedido.pensar === true) {
      const inicio = Date.now();
      let resposta = await chamarIA([{ role: "system", content: sistema }, ...historico], parar.signal, limite, criatividade);
      let feitas = 0, mudou = 0;
      while (feitas < 3 && Date.now() - inicio < 90000) {
        const instrucao = "Revise a resposta abaixo procurando erros de lógica, de código, de fatos e partes faltando. Se estiver correta, escreva somente APROVADA. Se tiver erro, escreva a resposta inteira corrigida, sem comentar a revisão." +
          "\n\nPERGUNTA:\n" + historico[historico.length - 1].content + "\n\nRESPOSTA:\n" + resposta;
        try {
          const revisada = await chamarIA([{ role: "system", content: "Você é um revisor técnico rigoroso." }, { role: "user", content: instrucao }], parar.signal, limite, 0.1);
          feitas++;
          if (revisada.trim().startsWith("APROVADA")) break;
          resposta = revisada;
          mudou++;
        } catch (e) { if (parar.signal.aborted) throw e; console.log("Revisao parou: " + e.message); break; }
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(resposta + "\n\n---\nRevisões feitas: " + feitas + " (com correção: " + mudou + ")");
    }

    // MODO NORMAL COM STREAMING
    const r = await fetch(URL_API, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + lerChave(),
        'Content-Type': 'application/json'
      },
      signal: parar.signal,
      body: JSON.stringify({
        model: MODELO,
        messages: [{ role: 'system', content: sistema }, ...historico],
        stream: true,
        temperature: criatividade,
        reasoning: { effort: "low" },
      max_tokens: limite
      })
    });

    if (!r.ok) {
      const avisos = {
        401: 'Chave da Groq inválida.',
        413: 'Mensagem grande demais para o plano grátis.',
        429: 'Limite grátis atingido. Espere um pouco e tente de novo.'
      };

      res.writeHead(r.status, {
        'Content-Type': 'text/plain; charset=utf-8'
      });

      return res.end(avisos[r.status] || await r.text());
    }

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8'
    });

    const texto = new TextDecoder();
    let resto = '';

    for await (const pedaco of r.body) {
      resto += texto.decode(pedaco, { stream: true });
      const linhas = resto.split('\n');
      resto = linhas.pop();

      for (const linha of linhas) {
        if (!linha.startsWith('data: ') ||
            linha.includes('data: [DONE]')) continue;

        const dado = JSON.parse(linha.slice(6));
        if (dado.error) throw new Error(dado.error.message);

        res.write(dado.choices?.[0]?.delta?.content || '');
      }
    }

    res.end();

  } catch (erro) {
    clearTimeout(timer);

    if (res.destroyed) return;

    const status = tempoEsgotado ? 504 : 500;

    if (!res.headersSent) {
      res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8'
      });
    }

    res.end(
      tempoEsgotado
        ? 'O Nyra Think atingiu o limite de 60 segundos. Tente novamente.'
        : 'Erro: ' + erro.message
    );
  } finally {
    clearTimeout(timer);
  }

}).listen(PORTA, process.env.NYRA_ABERTA ? '0.0.0.0' : '127.0.0.1', () => {
  console.log('NYRA ligada na porta ' + PORTA);
});
