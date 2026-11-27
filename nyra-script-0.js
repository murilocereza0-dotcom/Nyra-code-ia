
const $ = (id) => document.getElementById(id);
const ler = (chave, padrao) => { try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; } };
const gravar = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {} };

const config = Object.assign({ nome: '', tamanho: 'normal', criatividade: 0.3, fonte: '15px', extra: '', linguagem: '' }, ler('nyra-config', {}));
let conversas = ler('nyra-conversas', []);
let atual = conversas[0] || { mensagens: [] };
let parar = null;

const elemento = (tag, classe, texto) => {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
};
const logo = () => $('logo').content.firstElementChild.cloneNode(true);
const salvar = () => gravar('nyra-conversas', conversas);
const rolar = () => $('chat').scrollTop = $('chat').scrollHeight;

function copiar(botao, texto) {
  navigator.clipboard.writeText(texto).then(() => {
    const antes = botao.textContent;
    botao.textContent = 'Copiado!';
    setTimeout(() => botao.textContent = antes, 1500);
  });
}
function botao(texto, acao, classe) {
  const b = elemento('button', classe, texto);
  b.type = 'button';
  b.onclick = () => acao(b);
  return b;
}
function formatar(el, texto) {
  el.textContent = '';
  texto.split('```').forEach((parte, i) => {
    if (i % 2 === 0) return el.append(parte);
    const codigo = parte.replace(/^[\w+#-]*\n/, '');
    el.append(elemento('pre', '', codigo), botao('Copiar código', (b) => copiar(b, codigo)));
  });
}
function desenharMensagem(m) {
  const caixa = elemento('div', m.role);
  const quem = elemento('div', 'quem');
  if (m.role === 'assistant') quem.append(logo(), 'Nyra');
  else quem.append(config.nome || 'Você');
  quem.append(elemento('time', '', m.hora));
  const texto = elemento('div', 'texto');
  if (m.role === 'assistant') formatar(texto, m.content);
  else texto.textContent = m.content;
  caixa.append(quem, texto);
  $('chat').append(caixa);
  return { caixa, texto };
}
function acoes(caixa, m) {
  const div = elemento('div', 'acoes');
  div.append(
    botao('Copiar resposta', (b) => copiar(b, m.content)),
    botao('Continuar', () => enviar('Continue a resposta anterior exatamente de onde parou, sem repetir o que já foi escrito.'), 'continuar'));
  caixa.append(div);
}
function desenhar() {
  $('chat').textContent = '';
  $('titulo').textContent = atual.mensagens[0]?.content || 'Nova conversa';
  if (!atual.mensagens.length) {
    const v = elemento('div', 'vazio');
    v.append(logo(), elemento('h1', '', 'NYRA CODE AI'), elemento('p', '', 'Beyond the code.'));
    return $('chat').append(v);
  }
  for (const m of atual.mensagens) {
    const { caixa } = desenharMensagem(m);
    if (m.role === 'assistant') acoes(caixa, m);
  }
  rolar();
}
function listar() {
  $('lista').textContent = '';
  for (const c of conversas) {
    const linha = elemento('div', 'conversa' + (c === atual ? ' atual' : ''));
    linha.append(
      botao(c.mensagens[0]?.content || 'Conversa', () => { trocar(c); $('menu').close(); }),
      botao('✕', () => {
        if (!confirm('Apagar essa conversa?')) return;
        conversas = conversas.filter((x) => x !== c);
        if (c === atual) trocar({ mensagens: [] });
        salvar();
        listar();
      }));
    $('lista').append(linha);
  }
}
function trocar(c) {
  parar?.abort();
  atual = c;
  desenhar();
}

async function enviar(pergunta) {
  if (parar || !pergunta) return;
  const conversa = atual;
  const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!conversa.mensagens.length) conversas.unshift(conversa);
  conversa.mensagens.push({ role: 'user', content: pergunta, hora: hora() });
  salvar();
  desenhar();
  const resposta = { role: 'assistant', content: '', hora: hora() };
  const { caixa, texto } = desenharMensagem(resposta);
  parar = new AbortController();
  $('enviar').textContent = 'Parar';
  const inicio = Date.now();
  const relogio = () => $('processando').textContent = 'Nyra está processando há ' + Math.round((Date.now() - inicio) / 1000) + 's';
  relogio();
  const timer = setInterval(relogio, 1000);
  $('processando').style.display = 'block';
  rolar();
  let erro = '';
  try {
    const r = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: parar.signal,
      body: JSON.stringify({
  ...config,
  mensagens: conversa.mensagens,
  pensar: $('think').checked
})
    });
    if (!r.ok) throw new Error(await r.text());
    const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { value, done } = await leitor.read();
      if (done) break;
      const noFim = $('chat').scrollHeight - $('chat').scrollTop - $('chat').clientHeight < 80;
      resposta.content += value;
      formatar(texto, resposta.content);
      if (noFim) rolar();
    }
  } catch (e) {
    if (e.name !== 'AbortError') erro = e.message;
  }
  clearInterval(timer);
  $('processando').style.display = 'none';
  $('enviar').textContent = 'Enviar';
  parar = null;
  if (resposta.content) {
    conversa.mensagens.push(resposta);
    acoes(caixa, resposta);
  }
  if (erro) texto.append(elemento('p', '', 'Deu ruim: ' + erro));
  else if (!resposta.content) texto.textContent = 'Sem resposta.';
  salvar();
}

$('caixa').onsubmit = (e) => {
  e.preventDefault();
  if (parar) return parar.abort();
  const pergunta = $('campo').value.trim();
  $('campo').value = '';
  enviar(pergunta);
};
$('novo').onclick = () => trocar({ mensagens: [] });
$('abrirMenu').onclick = () => { listar(); $('menu').showModal(); };
$('abrirConfig').onclick = () => { $('menu').close(); $('config').showModal(); };
document.querySelectorAll('[data-fechar]').forEach((b) => b.onclick = () => b.closest('dialog').close());
$('config').onclose = desenharSeParado;
function desenharSeParado() { if (!parar) desenhar(); }
$('apagarTudo').onclick = () => {
  if (!confirm('Apagar TODAS as conversas?')) return;
  conversas = [];
  salvar();
  trocar({ mensagens: [] });
};
function aplicar() {
  document.documentElement.style.setProperty('--fonte', config.fonte);
  $('valor').textContent = config.criatividade;
}
for (const chave of Object.keys(config)) {
  $(chave).value = config[chave];
  $(chave).oninput = () => {
    config[chave] = $(chave).value;
    gravar('nyra-config', config);
    aplicar();
  };
}
fetch('/status').then((r) => r.json()).then((s) => {
  $('status').textContent = s.chave ? '● Servidor ligado, API configurada' : '● Falta a chave da Groq';
  $('modelo').textContent = s.modelo;
}).catch(() => $('status').textContent = '● Servidor desligado');
aplicar();
desenhar();
