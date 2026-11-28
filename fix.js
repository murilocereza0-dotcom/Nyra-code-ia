const fs = require("fs");
let h = fs.readFileSync("snake.html", "utf8");
const novo = `<script>
const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const N=20; const CELL=canvas.width/N;
let snake,dir,nextDir,food,score,dead;
let high=parseInt(localStorage.getItem("snakeHigh")||"0");
document.getElementById("high").textContent=high;
let lastTime=0; let speed=150;
function reset(){ snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}]; dir={x:1,y:0}; nextDir={x:1,y:0}; score=0; dead=false; speed=150; placeFood(); document.getElementById("score").textContent=score; const o=document.getElementById("overlay"); if(o) o.style.setProperty("display","none","important"); }
function placeFood(){ do{ food={x:Math.floor(Math.random()*N),y:Math.floor(Math.random()*N)}; }while(snake.some(s=>s.x===food.x&&s.y===food.y)); }
function step(){ dir=nextDir; const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y}; if(head.x<0||head.y<0||head.x>=N||head.y>=N||snake.some(s=>s.x===head.x&&s.y===head.y)){ dead=true; if(score>high){high=score;localStorage.setItem("snakeHigh",high);document.getElementById("high").textContent=high;} document.getElementById("finalScore").textContent=score; document.getElementById("overlay").style.setProperty("display","flex","important"); return; } snake.unshift(head); if(head.x===food.x&&head.y===food.y){ score++; document.getElementById("score").textContent=score; if(score%5===0) speed=Math.max(70,speed-15); placeFood(); } else snake.pop(); }
function draw(){ ctx.fillStyle="#1a1a2e"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle="#ff6ec4"; ctx.beginPath(); ctx.arc(food.x*CELL+CELL/2,food.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#22c55e"; snake.forEach((s)=>{ ctx.fillRect(s.x*CELL+2,s.y*CELL+2,CELL-4,CELL-4); }); }
function loop(now){ if(!dead && now-lastTime>speed){ step(); lastTime=now; } draw(); requestAnimationFrame(loop); }
function setDir(x,y){ if(x===-dir.x&&y===-dir.y) return; nextDir={x,y}; }
document.addEventListener("keydown",e=>{ const k=e.key.toLowerCase(); if(k==="arrowup"||k==="w") setDir(0,-1); if(k==="arrowdown"||k==="s") setDir(0,1); if(k==="arrowleft"||k==="a") setDir(-1,0); if(k==="arrowright"||k==="d") setDir(1,0); });
let tx=0,ty=0;
canvas.addEventListener("touchstart",e=>{ e.preventDefault(); tx=e.touches[0].clientX; ty=e.touches[0].clientY; },{passive:false});
canvas.addEventListener("touchmove",e=>{ e.preventDefault(); },{passive:false});
canvas.addEventListener("touchend",e=>{ e.preventDefault(); const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty; if(Math.abs(dx)<20&&Math.abs(dy)<20) return; if(Math.abs(dx)>Math.abs(dy)) setDir(Math.sign(dx),0); else setDir(0,Math.sign(dy)); },{passive:false});
document.getElementById("restartBtn").addEventListener("click",reset);
reset(); requestAnimationFrame(loop);
</script>`;
h = h.replace(/<script>[\s\S]*?<\/script>/, novo);
fs.writeFileSync("snake.html", h);
console.log("SCRIPT NOVO OK");
