const fs = require('fs');
const bloco = `<!--fundo--><style>
body{background:radial-gradient(ellipse 100% 40% at 50% 42%,#180b31,#05020a) #05020a}
#linhas{position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;mask-image:linear-gradient(transparent,#000 14%,#000 86%,transparent)}
</style><canvas id="linhas"></canvas>
<script>
(() => {
  document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.content = '#05020a');
  const c = document.getElementById('linhas'), x = c.getContext('2d');
  const desenho = (t) => {
    const r = devicePixelRatio || 1, l = c.clientWidth, a = c.clientHeight;
    const w = Math.round(l * r), h = Math.round(a * r);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    x.setTransform(r, 0, 0, r, 0, 0);
    x.clearRect(0, 0, l, a);
    for (let i = 0; i < 7; i++) {
      const cor = i % 3 ? '#a855f7' : '#22d3ee';
      x.beginPath();
      for (let p = -3; p <= l + 3; p += 3) x.lineTo(p, a * (0.12 + i * 0.125) + Math.sin(p / 70 + t / (1400 + i * 220) + i) * 22 + Math.sin(p / 33 - t / 2100) * 5);
      for (const [grossura, forca] of [[9, '0d'], [4, '1c'], [1.2, '80']]) {
        x.lineWidth = grossura;
        x.strokeStyle = cor + forca;
        x.stroke();
      }
    }
    requestAnimationFrame(desenho);
  };
  requestAnimationFrame(desenho);
})();
</script><!--/fundo-->`;
const h = fs.readFileSync('index.html', 'utf8').replace(/<!--fundo-->[\s\S]*<!--\/fundo-->/, '');
fs.writeFileSync('index.html', h.replace('</body>', () => bloco + '</body>'));
console.log('fundo HD OK');
