// Rendu partagé des éléments de déco (utilisé par play.html ET editor.html).
// Pour ajouter un objet : 1) FP/SIZED/COLORED ci-dessous, 2) un cas dans paintDecor,
// 3) un bouton d'outil dans editor.html, 4) le type dans ALLOWED côté server.js.

// Empreintes (largeur, hauteur) des objets ponctuels (placés au clic).
const FP = {
  plant:[70,70], crate:[70,70], statue:[64,64], sofa:[130,70],
  table:[96,96], chair:[46,46], fountain:[124,124], lamp:[44,54],
  torii:[120,140], sakura:[122,116], lantern:[52,68], bonsai:[68,60], pagoda:[120,152],
  ball:[42,42], goal:[176,66], trophy:[58,82], cone:[36,46], flag:[66,88],
};
// Objets redimensionnables (dessinés au clic-glisse → ont w,h).
const SIZED = { rug:1, window:1, barrier:1, painting:1, pitch:1, tatami:1 };
// Objets dont on peut choisir la couleur (valeur = couleur par défaut).
const COLORED = { rug:'#33294a', window:'#9fd6ec', painting:'#4a6fa5', pitch:'#2f8f4a', tatami:'#caa46a', flag:'#d83a3a' };

function decorSize(o){ if(o.w!=null&&o.h!=null) return [o.w,o.h]; return FP[o.type]||[70,70]; }

// (ctx, objet, échelle, x/y écran du coin haut-gauche)
function paintDecor(ctx, o, s, x, y) {
  const [ow, oh] = decorSize(o), w = ow*s, h = oh*s, cx = x+w/2, cy = y+h/2;
  const t = o.type, rr = o.rot || 0;
  if (rr) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rr); ctx.translate(-cx, -cy); }

  if (t === 'rug') {
    ctx.fillStyle = o.color || '#2e3550';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14*s); ctx.fill();

  } else if (t === 'plant') {
    ctx.fillStyle='#6b4a32'; ctx.beginPath(); ctx.roundRect(x+w*0.28, y+h*0.55, w*0.44, h*0.42, 4*s); ctx.fill();
    ctx.fillStyle='#2f7d4f'; ctx.beginPath(); ctx.arc(x+w*0.5, y+h*0.4, w*0.42, 0, 7); ctx.fill();
    ctx.fillStyle='#3a9460'; ctx.beginPath(); ctx.arc(x+w*0.38, y+h*0.3, w*0.2, 0, 7); ctx.fill();

  } else if (t === 'crate') {
    ctx.fillStyle='#86643c'; ctx.beginPath(); ctx.roundRect(x,y,w,h,6*s); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w,y+h); ctx.moveTo(x+w,y); ctx.lineTo(x,y+h); ctx.stroke();

  } else if (t === 'window') {
    const b=4*s;
    ctx.fillStyle='#5a4636'; ctx.beginPath(); ctx.roundRect(x,y,w,h,3*s); ctx.fill();
    ctx.fillStyle=o.color||'#9fd6ec'; ctx.fillRect(x+b,y+b,w-2*b,h-2*b);
    ctx.fillStyle='rgba(255,255,255,.28)';
    ctx.beginPath(); ctx.moveTo(x+b,y+h-b); ctx.lineTo(x+w*0.45,y+b); ctx.lineTo(x+w*0.62,y+b); ctx.lineTo(x+b,y+h-b); ctx.fill();
    ctx.strokeStyle='#5a4636'; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.moveTo(x+w/2,y+b); ctx.lineTo(x+w/2,y+h-b); ctx.moveTo(x+b,y+h/2); ctx.lineTo(x+w-b,y+h/2); ctx.stroke();

  } else if (t === 'statue') {
    const S=w;
    ctx.fillStyle='rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x+S*0.5,y+S*0.9,S*0.34,S*0.12,0,0,7); ctx.fill();
    ctx.fillStyle='#6b6f7e'; ctx.beginPath(); ctx.roundRect(x+S*0.18,y+S*0.72,S*0.64,S*0.22,4*s); ctx.fill();
    ctx.fillStyle='#cdd2dc';
    ctx.beginPath(); ctx.ellipse(x+S*0.5,y+S*0.5,S*0.2,S*0.3,0,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(x+S*0.5,y+S*0.24,S*0.14,0,7); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(x+S*0.6,y+S*0.5,S*0.07,S*0.28,0,0,7); ctx.fill();

  } else if (t === 'barrier') {
    const horiz = ow >= oh, r = Math.min(w,h)/2;
    ctx.fillStyle='#8a91a4'; ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill();
    ctx.fillStyle='#aab1c4';
    const n = Math.max(2, Math.floor((horiz?ow:oh)/40));
    for (let i=0;i<=n;i++){
      if (horiz){ const px=x+w*(i/n); ctx.beginPath(); ctx.arc(px, y+h/2, h*0.34, 0, 7); ctx.fill(); }
      else { const py=y+h*(i/n); ctx.beginPath(); ctx.arc(x+w/2, py, w*0.34, 0, 7); ctx.fill(); }
    }

  } else if (t === 'sofa') {
    ctx.fillStyle='#3a6b6e';
    ctx.beginPath(); ctx.roundRect(x, y, w, h*0.34, 8*s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y+h*0.28, w, h*0.72, 10*s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x, y+h*0.2, w*0.13, h*0.8, 8*s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x+w*0.87, y+h*0.2, w*0.13, h*0.8, 8*s); ctx.fill();
    ctx.fillStyle='#4a8186';
    ctx.beginPath(); ctx.roundRect(x+w*0.16, y+h*0.42, w*0.32, h*0.5, 6*s); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x+w*0.52, y+h*0.42, w*0.32, h*0.5, 6*s); ctx.fill();

  // ----- mobilier -----
  } else if (t === 'table') {
    ctx.fillStyle='rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(cx,cy+h*0.06,w*0.45,h*0.42,0,0,7); ctx.fill();
    ctx.fillStyle='#7a5230'; ctx.beginPath(); ctx.arc(cx,cy,w*0.45,0,7); ctx.fill();
    ctx.fillStyle='#8c6038'; ctx.beginPath(); ctx.arc(cx,cy,w*0.37,0,7); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.arc(cx,cy,w*0.24,0,7); ctx.stroke();

  } else if (t === 'chair') {
    ctx.fillStyle='#5a3d28'; ctx.beginPath(); ctx.roundRect(x+w*0.15,y+h*0.08,w*0.7,h*0.2,3*s); ctx.fill();
    ctx.fillStyle='#6b4a32'; ctx.beginPath(); ctx.roundRect(x+w*0.15,y+h*0.28,w*0.7,h*0.62,4*s); ctx.fill();

  } else if (t === 'fountain') {
    ctx.fillStyle='#6b7080'; ctx.beginPath(); ctx.arc(cx,cy,w*0.46,0,7); ctx.fill();
    ctx.fillStyle='#3f86b8'; ctx.beginPath(); ctx.arc(cx,cy,w*0.37,0,7); ctx.fill();
    ctx.fillStyle='#6b7080'; ctx.beginPath(); ctx.arc(cx,cy,w*0.19,0,7); ctx.fill();
    ctx.fillStyle='#7fb8e0'; ctx.beginPath(); ctx.arc(cx,cy,w*0.13,0,7); ctx.fill();
    ctx.fillStyle='#aee0fb'; ctx.beginPath(); ctx.arc(cx,cy,w*0.06,0,7); ctx.fill();

  } else if (t === 'lamp') {
    ctx.strokeStyle='#3a3f4e'; ctx.lineWidth=w*0.16; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx,y+h*0.95); ctx.lineTo(cx,y+h*0.42); ctx.stroke();
    ctx.fillStyle='rgba(255,233,168,.3)'; ctx.beginPath(); ctx.arc(cx,y+h*0.3,w*0.5,0,7); ctx.fill();
    ctx.fillStyle='#ffe9a8'; ctx.beginPath(); ctx.arc(cx,y+h*0.3,w*0.27,0,7); ctx.fill();

  } else if (t === 'painting') {
    ctx.fillStyle='#caa15a'; ctx.beginPath(); ctx.roundRect(x,y,w,h,3*s); ctx.fill();
    const b=Math.min(w,h)*0.13;
    ctx.fillStyle=o.color||'#4a6fa5'; ctx.fillRect(x+b,y+b,w-2*b,h-2*b);
    ctx.fillStyle='rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(x+w*0.36,y+h*0.42,Math.min(w,h)*0.16,0,7); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.15)'; ctx.fillRect(x+b,y+h*0.66,w-2*b,h*0.22);

  } else if (t === 'pitch') {
    ctx.fillStyle=o.color||'#2f8f4a'; ctx.beginPath(); ctx.roundRect(x,y,w,h,6*s); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.05)';
    const stripes=6; for(let i=0;i<stripes;i+=2) ctx.fillRect(x+w*(i/stripes),y,w/stripes,h);
    ctx.strokeStyle='rgba(255,255,255,.75)'; ctx.lineWidth=Math.max(1,Math.min(w,h)*0.012);
    ctx.strokeRect(x+w*0.04,y+h*0.06,w*0.92,h*0.88);
    ctx.beginPath(); ctx.moveTo(cx,y+h*0.06); ctx.lineTo(cx,y+h*0.94); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,Math.min(w,h)*0.12,0,7); ctx.stroke();

  } else if (t === 'tatami') {
    ctx.fillStyle=o.color||'#caa46a'; ctx.beginPath(); ctx.roundRect(x,y,w,h,2*s); ctx.fill();
    ctx.strokeStyle='#2c5530'; ctx.lineWidth=Math.max(2,Math.min(w,h)*0.05); ctx.strokeRect(x+3*s,y+3*s,w-6*s,h-6*s);
    ctx.strokeStyle='rgba(0,0,0,.08)'; ctx.lineWidth=1;
    for(let gx=x+10*s; gx<x+w; gx+=10*s){ ctx.beginPath(); ctx.moveTo(gx,y); ctx.lineTo(gx,y+h); ctx.stroke(); }

  // ----- thème Japon -----
  } else if (t === 'torii') {
    const red='#d83a2f', dk='#a82a22';
    ctx.fillStyle=red; ctx.fillRect(x+w*0.2,y+h*0.22,w*0.12,h*0.76); ctx.fillRect(x+w*0.68,y+h*0.22,w*0.12,h*0.76);
    ctx.fillStyle=red; ctx.fillRect(x+w*0.13,y+h*0.34,w*0.74,h*0.09);
    ctx.fillStyle=dk; ctx.beginPath(); ctx.roundRect(x+w*0.05,y+h*0.1,w*0.9,h*0.13,4*s); ctx.fill();
    ctx.fillStyle='#222'; ctx.fillRect(x+w*0.03,y+h*0.08,w*0.94,h*0.035);

  } else if (t === 'sakura') {
    ctx.fillStyle='rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(cx,y+h*0.93,w*0.3,h*0.08,0,0,7); ctx.fill();
    ctx.fillStyle='#5a3d28'; ctx.fillRect(cx-w*0.05,cy,w*0.1,h*0.42);
    ctx.fillStyle='#f6a8c8';
    ctx.beginPath(); ctx.arc(cx,cy-h*0.12,w*0.3,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx-w*0.2,cy-h*0.02,w*0.17,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+w*0.2,cy-h*0.02,w*0.17,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx,cy-h*0.3,w*0.18,0,7); ctx.fill();
    ctx.fillStyle='#fcd0e2';
    ctx.beginPath(); ctx.arc(cx-w*0.08,cy-h*0.16,w*0.1,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx+w*0.12,cy-h*0.08,w*0.08,0,7); ctx.fill();

  } else if (t === 'lantern') {
    ctx.fillStyle='#222'; ctx.fillRect(cx-w*0.05,y,w*0.1,h*0.12);
    ctx.fillStyle='#d83a2f'; ctx.beginPath(); ctx.ellipse(cx,y+h*0.52,w*0.42,h*0.4,0,0,7); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=1.5*s;
    for(let i=1;i<4;i++){ const yy=y+h*0.52+(i-1.5)*h*0.18; ctx.beginPath(); ctx.moveTo(cx-w*0.4,yy); ctx.lineTo(cx+w*0.4,yy); ctx.stroke(); }
    ctx.fillStyle='#ffd24a'; ctx.fillRect(cx-w*0.04,y+h*0.9,w*0.08,h*0.1);

  } else if (t === 'bonsai') {
    ctx.fillStyle='#7a4a2a'; ctx.beginPath(); ctx.roundRect(x+w*0.22,y+h*0.62,w*0.56,h*0.32,3*s); ctx.fill();
    ctx.strokeStyle='#5a3d28'; ctx.lineWidth=w*0.07; ctx.beginPath(); ctx.moveTo(cx,y+h*0.62); ctx.lineTo(cx,y+h*0.4); ctx.stroke();
    ctx.fillStyle='#3a6d2a'; ctx.beginPath(); ctx.arc(cx,y+h*0.36,w*0.3,0,7); ctx.fill();
    ctx.fillStyle='#4a8a36'; ctx.beginPath(); ctx.arc(cx-w*0.14,y+h*0.32,w*0.14,0,7); ctx.fill();

  } else if (t === 'pagoda') {
    ctx.fillStyle='#e8ddc8'; ctx.fillRect(x+w*0.32,y+h*0.28,w*0.36,h*0.66);
    ctx.fillStyle='#c0392b';
    for(let k=0;k<3;k++){ const ry=y+h*0.08+k*h*0.27, rw=w*(0.78-k*0.14);
      ctx.beginPath(); ctx.moveTo(cx-rw/2,ry+h*0.13); ctx.lineTo(cx,ry); ctx.lineTo(cx+rw/2,ry+h*0.13);
      ctx.lineTo(cx+rw*0.4,ry+h*0.16); ctx.lineTo(cx-rw*0.4,ry+h*0.16); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle='#7a2018'; ctx.fillRect(cx-w*0.05,y+h*0.5,w*0.1,h*0.44);

  // ----- thème Football / Coupe du monde -----
  } else if (t === 'ball') {
    const rr=w*0.46;
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx,cy,rr,0,7); ctx.fill();
    ctx.strokeStyle='#111'; ctx.lineWidth=1.5*s; ctx.beginPath(); ctx.arc(cx,cy,rr,0,7); ctx.stroke();
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(cx,cy,rr*0.26,0,7); ctx.fill();
    for(let i=0;i<5;i++){ const a=i/5*6.283-1.2; ctx.beginPath(); ctx.arc(cx+Math.cos(a)*rr*0.62,cy+Math.sin(a)*rr*0.62,rr*0.13,0,7); ctx.fill(); }

  } else if (t === 'goal') {
    ctx.strokeStyle='rgba(255,255,255,.4)'; ctx.lineWidth=1;
    for(let gx=x+w*0.08; gx<x+w*0.92; gx+=w*0.07){ ctx.beginPath(); ctx.moveTo(gx,y+h*0.12); ctx.lineTo(gx,y+h*0.8); ctx.stroke(); }
    for(let gy=y+h*0.12; gy<y+h*0.8; gy+=h*0.16){ ctx.beginPath(); ctx.moveTo(x+w*0.06,gy); ctx.lineTo(x+w*0.94,gy); ctx.stroke(); }
    ctx.strokeStyle='#fff'; ctx.lineWidth=Math.max(2,w*0.03); ctx.lineJoin='round';
    ctx.strokeRect(x+w*0.06,y+h*0.1,w*0.88,h*0.7);

  } else if (t === 'trophy') {
    ctx.fillStyle='#caa23a'; ctx.beginPath(); ctx.roundRect(x+w*0.28,y+h*0.82,w*0.44,h*0.14,3*s); ctx.fill();
    ctx.fillStyle='#e8c14a';
    ctx.fillRect(cx-w*0.06,y+h*0.55,w*0.12,h*0.3);
    ctx.beginPath(); ctx.ellipse(cx,y+h*0.36,w*0.3,h*0.32,0,0,7); ctx.fill();
    ctx.fillStyle='#f4d56a'; ctx.beginPath(); ctx.ellipse(cx-w*0.08,y+h*0.3,w*0.09,h*0.16,0,0,7); ctx.fill();

  } else if (t === 'cone') {
    ctx.fillStyle='rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx,y+h*0.86,w*0.42,h*0.09,0,0,7); ctx.fill();
    ctx.fillStyle='#e8702a'; ctx.beginPath(); ctx.moveTo(cx,y+h*0.1); ctx.lineTo(x+w*0.84,y+h*0.84); ctx.lineTo(x+w*0.16,y+h*0.84); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#f3e3d6'; ctx.fillRect(x+w*0.3,y+h*0.44,w*0.4,h*0.12);

  } else if (t === 'flag') {
    ctx.strokeStyle='#6b6f7e'; ctx.lineWidth=w*0.08; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x+w*0.2,y+h*0.04); ctx.lineTo(x+w*0.2,y+h*0.98); ctx.stroke();
    ctx.fillStyle=o.color||'#d83a3a'; ctx.fillRect(x+w*0.22,y+h*0.08,w*0.62,h*0.42);
    ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillRect(x+w*0.22,y+h*0.22,w*0.62,h*0.1);
  }
  if (rr) ctx.restore();
}

// Visible aussi via window pour les scripts qui suivent.
if (typeof window !== 'undefined') { window.FP=FP; window.SIZED=SIZED; window.COLORED=COLORED; window.decorSize=decorSize; window.paintDecor=paintDecor; }
