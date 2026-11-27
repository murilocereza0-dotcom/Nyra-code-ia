
(() => {
  const caixa = document.getElementById('caixa'), chat = document.getElementById('chat');
  caixa.prepend(document.getElementById('processando'));
  new ResizeObserver(() => {
    const noFim = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
    document.body.style.setProperty('--base', caixa.offsetHeight + parseFloat(getComputedStyle(caixa).marginBottom) + 'px');
    if (noFim) chat.scrollTop = chat.scrollHeight;
  }).observe(caixa);
})();
