// Meshes 3D partagés pour le mode Murder et son éditeur (nécessite THREE + decor.js).
function box(w,h,d,c){ return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color:c})); }
function cyl(rt,rb,h,c,seg){ return new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg||16),new THREE.MeshLambertMaterial({color:c})); }
function sph(r,c){ return new THREE.Mesh(new THREE.SphereGeometry(r,14,12),new THREE.MeshLambertMaterial({color:c})); }
function cone(r,h,c){ return new THREE.Mesh(new THREE.ConeGeometry(r,h,16),new THREE.MeshLambertMaterial({color:c})); }
const H3={plant:60,crate:70,statue:95,sofa:42,table:48,chair:44,fountain:40,lamp:95,torii:130,sakura:110,lantern:62,bonsai:46,pagoda:150,ball:40,goal:64,trophy:74,cone:46,flag:88,window:70,painting:60,barrier:34};
const C3={plant:0x2f7d4f,crate:0x86643c,statue:0xcdd2dc,sofa:0x3a6b6e,table:0x8c6038,chair:0x6b4a32,fountain:0x4a90c0,lamp:0xffe9a8,torii:0xd83a2f,sakura:0xf6a8c8,lantern:0xd83a2f,bonsai:0x3a6d2a,pagoda:0xc0392b,ball:0xffffff,goal:0xdddddd,trophy:0xe8c14a,cone:0xe8702a,flag:0xd83a3a,window:0x9fd6ec,painting:0x4a6fa5,barrier:0x8a91a4,rug:0x33294a,pitch:0x2f8f4a,tatami:0xcaa46a};
const FLAT={rug:1,pitch:1,tatami:1};
const colOf=o=>{ if(o.color){ try{return parseInt(o.color.slice(1),16);}catch{} } return C3[o.type]??0x888888; };
function buildDecorMesh(o){
  const [ow,oh]=decorSize(o), c=colOf(o), g=new THREE.Group(), t=o.type, r=Math.min(ow,oh)/2;
  const addc=(m,y)=>{ m.position.y=y; g.add(m); };
  if(FLAT[t]){ const m=box(ow,2,oh,c); m.position.y=1.2; g.add(m); }
  else if(t==='plant'){ addc(cyl(r*0.5,r*0.62,40,0x6b4a32),20); addc(sph(r*0.8,0x2f7d4f),58); addc(sph(r*0.45,0x3a9460),74); }
  else if(t==='bonsai'){ addc(cyl(r*0.6,r*0.7,24,0x7a4a2a),12); addc(sph(r*0.7,0x3a6d2a),40); }
  else if(t==='sakura'){ addc(cyl(r*0.18,r*0.22,70,0x5a3d28),35); addc(sph(r*0.95,0xf6a8c8),85); addc(sph(r*0.55,0xfcd0e2),108); }
  else if(t==='statue'){ addc(cyl(r*0.7,r*0.8,28,0x6b6f7e),14); addc(cyl(r*0.32,r*0.46,52,0xcdd2dc),58); addc(sph(r*0.34,0xcdd2dc),92); }
  else if(t==='sofa'){ const dk=0x2c5457;
    const b1=box(ow,30,oh*0.55,c); b1.position.set(0,15,oh*0.2); g.add(b1);
    const b2=box(ow*0.5,30,oh,c); b2.position.set(-ow*0.24,15,0); g.add(b2);
    const k1=box(ow,26,oh*0.14,dk); k1.position.set(0,42,oh*0.43); g.add(k1);
    const k2=box(ow*0.14,26,oh,dk); k2.position.set(-ow*0.43,42,0); g.add(k2); }
  else if(t==='table'){ addc(cyl(r*0.92,r*0.92,8,0x8c6038),46); addc(cyl(6,6,46,0x5a3d28),23); }
  else if(t==='chair'){ const s=box(ow*0.8,10,oh*0.8,0x6b4a32); s.position.y=24; g.add(s); const bk=box(ow*0.8,28,8,0x5a3d28); bk.position.set(0,40,-oh*0.34); g.add(bk); }
  else if(t==='fountain'){ addc(cyl(r,r*1.05,26,0x6b7080),13); addc(cyl(r*0.8,r*0.8,18,0x3f86b8),30); addc(cyl(r*0.18,r*0.18,46,0x6b7080),40); addc(sph(r*0.22,0xaee0fb),64); }
  else if(t==='lamp'){ addc(cyl(4,5,80,0x3a3f4e),40); const lb=sph(r*0.7,0xffe9a8); lb.position.y=86; g.add(lb); }
  else if(t==='torii'){ const rd=0xd83a2f; const pL=box(ow*0.12,oh,18,rd),pR=box(ow*0.12,oh,18,rd); pL.position.set(-ow*0.3,oh/2,0); pR.position.set(ow*0.3,oh/2,0); g.add(pL); g.add(pR); const top=box(ow,oh*0.12,24,0xa82a22); top.position.y=oh*0.92; g.add(top); const tb=box(ow*0.74,oh*0.08,20,rd); tb.position.y=oh*0.7; g.add(tb); }
  else if(t==='lantern'){ addc(sph(r*0.85,0xd83a2f),50); addc(cyl(r*0.2,r*0.2,12,0x222222),68); }
  else if(t==='pagoda'){ const body=cyl(r*0.5,r*0.6,oh*0.7,0xe8ddc8); body.position.y=oh*0.35; g.add(body); for(let k=0;k<3;k++){ const rf=cone(r*(1-k*0.22),oh*0.22,0xc0392b); rf.position.y=oh*0.3+k*oh*0.26; g.add(rf); } }
  else if(t==='ball'){ addc(sph(r,0xffffff),r); }
  else if(t==='goal'){ const wc=0xeeeeee,th=8; const pl=box(th,oh,th,wc),pr=box(th,oh,th,wc),cb=box(ow,th,th,wc); pl.position.set(-ow/2,oh/2,0); pr.position.set(ow/2,oh/2,0); cb.position.set(0,oh,0); g.add(pl,pr,cb); }
  else if(t==='trophy'){ addc(cyl(r*0.7,r*0.7,12,0xcaa23a),6); addc(cyl(6,6,28,0xe8c14a),26); addc(cyl(r*0.55,r*0.2,34,0xe8c14a),52); }
  else if(t==='cone'){ addc(cone(r*0.85,oh,0xe8702a),oh/2); }
  else if(t==='flag'){ addc(cyl(3,3,oh,0x6b6f7e),oh/2); const fl=box(ow*0.6,oh*0.4,3,c); fl.position.set(ow*0.3,oh*0.78,0); g.add(fl); }
  else if(t==='barrier'){ const bar=box(ow,18,oh,0x8a91a4); bar.position.y=30; g.add(bar); const n=Math.max(2,Math.floor(Math.max(ow,oh)/90)); for(let i=0;i<=n;i++){ const post=cyl(7,7,40,0xaab1c4); if(ow>=oh) post.position.set(-ow/2+ow*(i/n),20,0); else post.position.set(0,20,-oh/2+oh*(i/n)); g.add(post); } }
  else if(t==='wall'){ const m=box(ow,185,oh,0x474f6b); m.position.y=92; g.add(m); const top=box(ow,8,oh,0x5a628a); top.position.y=186; g.add(top); }
  else if(t==='pc'){ const desk=box(ow,40,oh,0x3a2f28); desk.position.y=20; g.add(desk);
    const stand=box(10,18,10,0x222); stand.position.set(0,48,-oh*0.05); g.add(stand);
    const mon=box(ow*0.52,36,7,0x111418); mon.position.set(0,66,-oh*0.05); g.add(mon);
    const scr=box(ow*0.46,30,2,0x2bd4ff); scr.position.set(0,66,-oh*0.05+5); g.add(scr); }
  else if(t==='window'||t==='painting'){ const m=box(ow,oh,10,c); m.position.y=oh/2+30; g.add(m); }
  else if(t==='crate'){ const hh=Math.min(ow,oh); const m=box(ow,hh,oh,c); m.position.y=hh/2; g.add(m); }
  else { const hh=H3[t]||60; const m=box(ow,hh,oh,c); m.position.y=hh/2; g.add(m); }
  g.position.set(o.x+ow/2,0,o.y+oh/2); if(o.rot) g.rotation.y=-o.rot;
  return g;
}
