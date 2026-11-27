
(() => {
  const emLinha = (el, linha) => {
    linha.split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach((p, i) => {
      if (i % 2 === 0) return el.append(p);
      if (p[0] === '`') el.append(elemento('code', '', p.slice(1, -1)));
      else emLinha(el.appendChild(elemento('strong')), p.slice(2, -2));
    });
  };
  formatar = (el, texto) => {
    el.textContent = '';
    texto.split(/^[ \t]*```/m).forEach((parte, i) => {
      if (i % 2) {
        const codigo = parte.replace(/^[\w+#-]*\n/, '');
        return el.append(elemento('pre', '', codigo), botao('Copiar código', (b) => copiar(b, codigo)));
      }
      parte.replace(/^\n+|\s+$/g, '').split('\n').forEach((linha, j, todas) => {
        const cab = linha.match(/^#{1,6}\s+(.*)/);
        if (/^\s*---+\s*$/.test(linha)) return el.append(document.createElement('hr'));
        if (cab) return emLinha(el.appendChild(elemento('strong', 'cab')), cab[1]);
        emLinha(el, linha.replace(/^(\s*)[-*]\s+/, '$1• '));
        if (j < todas.length - 1) el.append('\n');
      });
    });
  };
  const b = document.getElementById('enviar');
  new MutationObserver(() => b.classList.toggle('parando', b.textContent === 'Parar')).observe(b, { childList: true });
  document.getElementById('campo').rows = 1;
  desenhar();
})();
