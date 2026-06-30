// Trouve le Faux — serveur multijoueur autoritatif (Node + ws)
// Tous les agents (PNJ + vrais joueurs) ont la MÊME couleur.
// Maps chargées depuis maps.json (éditables via editor.html). Mode test solo avec bots.
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MAPS_FILE = path.join(__dirname, 'maps.json');

// ---- Réglages ----
const CROWD = 20;
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const TEST_BOTS = 3;
const PLAYER_SPEED = 130;       // tout le monde (joueurs, PNJ, bots) à la même vitesse
const PUNCH_RANGE = 85;
const PUNCH_HALF_ANGLE = 1.3;   // demi-cône du coup (~74°) autour de la direction visée
const STUN = 1000;              // immobile 1 s après un coup
const R = 16;
const TICK = 1000 / 30;
const ROUND_TIME = 5 * 60 * 1000;
const COUNTDOWN = 5000;         // 5 s de préparation avant le début de la manche
const RESET_DELAY = 6000;

const rand = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; return d; };

// ---- Maps : défauts + chargement/sauvegarde fichier ----
// statue entourée de cordons (barrières) : joli détail de musée
const ropedStatue = (sx, sy) => ([
  { type:'statue', x:sx, y:sy },
  { type:'barrier', x:sx-22, y:sy-34, w:108, h:14 },
  { type:'barrier', x:sx-22, y:sy+84, w:108, h:14 },
  { type:'barrier', x:sx-34, y:sy-22, w:14, h:108 },
  { type:'barrier', x:sx+84, y:sy-22, w:14, h:108 },
]);
const winRow = (xs, y, w, h, color) => xs.map(x => ({ type:'window', x, y, w, h, color }));
const plantsAt = (...pts) => pts.map(([x,y]) => ({ type:'plant', x, y }));

const MUSEE = { name: 'Le Musée', w: 1700, h: 1050, floor: '#242235', decor: [
  ...winRow([170, 470, 770, 1070, 1370], 14, 200, 24, '#bfe0f0'),
  { type:'rug', x:120, y:470, w:1460, h:120, color:'#3a2f4e' },
  ...ropedStatue(260, 230), ...ropedStatue(820, 230), ...ropedStatue(1380, 230),
  ...ropedStatue(260, 760), ...ropedStatue(820, 760), ...ropedStatue(1380, 760),
  ...plantsAt([40,930],[1590,930],[40,40],[1590,40],[800,930]),
] };

const MANOIR = { name: 'Le Manoir', w: 1600, h: 1000, floor: '#2c2230', decor: [
  { type:'rug', x:470, y:300, w:660, h:400, color:'#5a2e3a' },
  { type:'rug', x:560, y:380, w:480, h:240, color:'#6a3744' },
  { type:'sofa', x:735, y:250 }, { type:'sofa', x:735, y:690 },
  { type:'sofa', x:455, y:465 }, { type:'sofa', x:1015, y:465 },
  ...winRow([300, 700, 1100], 14, 200, 24, '#cfe6d8'),
  { type:'statue', x:70, y:70 }, { type:'statue', x:1466, y:70 },
  { type:'statue', x:70, y:866 }, { type:'statue', x:1466, y:866 },
  { type:'crate', x:95, y:430 }, { type:'crate', x:95, y:510 }, { type:'crate', x:175, y:470 },
  { type:'crate', x:1430, y:470 },
  ...plantsAt([250,300],[1280,300],[250,640],[1280,640],[770,120],[770,860]),
] };

const DEFAULT_MAPS = [
  { name: 'Le Salon', w: 1500, h: 950, floor: '#2a2f44', decor: [
    { type:'rug', x:430, y:300, w:640, h:360, color:'#33294a' },
    { type:'rug', x:560, y:380, w:380, h:200, color:'#3c2f56' },
    { type:'plant', x:70, y:70 }, { type:'plant', x:1380, y:70 },
    { type:'plant', x:70, y:840 }, { type:'plant', x:1380, y:840 } ] },
  { name: "L'Entrepôt", w: 1600, h: 1000, floor: '#2b3142', decor: [
    { type:'rug', x:560, y:380, w:480, h:240, color:'#222a3a' },
    { type:'crate', x:120, y:110 }, { type:'crate', x:1410, y:110 },
    { type:'crate', x:120, y:830 }, { type:'crate', x:1410, y:830 },
    { type:'plant', x:780, y:80 }, { type:'plant', x:780, y:880 } ] },
  { name: 'La Galerie', w: 1500, h: 1000, floor: '#2d2a3e', decor: [
    { type:'rug', x:450, y:330, w:600, h:360, color:'#3a2f4e' },
    { type:'plant', x:80, y:80 }, { type:'plant', x:1360, y:80 },
    { type:'plant', x:80, y:860 }, { type:'plant', x:1360, y:860 },
    { type:'plant', x:720, y:80 }, { type:'plant', x:720, y:870 } ] },
  MUSEE,
  MANOIR,
];

function sanitizeMaps(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const out = [];
  for (const m of arr) {
    if (!m || typeof m !== 'object') continue;
    const map = {
      name: String(m.name || 'Map').slice(0, 30),
      w: Math.max(600, Math.min(4000, +m.w || 1500)),
      h: Math.max(400, Math.min(4000, +m.h || 950)),
      floor: typeof m.floor === 'string' ? m.floor.slice(0, 9) : '#2a2f44',
      decor: [],
    };
    const SIZED = { rug:1, window:1, barrier:1, painting:1, pitch:1, tatami:1 };  // redimensionnables (w,h)
    const COLORED = { rug:'#33294a', window:'#9fd6ec', painting:'#4a6fa5', pitch:'#2f8f4a', tatami:'#caa46a', flag:'#d83a3a' };
    const ALLOWED = ['rug','plant','crate','window','statue','barrier','sofa',
      'painting','pitch','tatami','table','chair','fountain','lamp',
      'torii','sakura','lantern','bonsai','pagoda',
      'ball','goal','trophy','cone','flag'];
    if (Array.isArray(m.decor)) for (const d of m.decor) {
      if (!d || !ALLOWED.includes(d.type)) continue;
      const item = { type: d.type, x: +d.x || 0, y: +d.y || 0 };
      if (SIZED[d.type]) { item.w = Math.max(8, +d.w || 100); item.h = Math.max(8, +d.h || 100); }
      if (COLORED[d.type]) item.color = typeof d.color === 'string' ? d.color.slice(0, 9) : COLORED[d.type];
      if (Number.isFinite(+d.rot) && +d.rot !== 0) item.rot = +(+d.rot).toFixed(3);
      map.decor.push(item);
    }
    out.push(map);
  }
  return out.length ? out : null;
}

let MAPS = DEFAULT_MAPS;
function loadMaps() {
  try {
    const raw = fs.readFileSync(MAPS_FILE, 'utf8');
    const s = sanitizeMaps(JSON.parse(raw));
    if (s) { MAPS = s; console.log(`  ✓ ${MAPS.length} map(s) chargée(s) depuis maps.json`); return; }
  } catch {}
  // pas de fichier valide : on écrit les défauts pour que l'utilisateur puisse les éditer
  MAPS = DEFAULT_MAPS;
  try { fs.writeFileSync(MAPS_FILE, JSON.stringify(DEFAULT_MAPS, null, 2)); console.log('  ✓ maps.json créé avec les maps par défaut'); } catch {}
}
loadMaps();

// La map change à CHAQUE manche (rotation séquentielle).
let mapIndex = 0;
let MAP = MAPS[0];
let WORLD = { w: MAP.w, h: MAP.h };

// ---- État ----
let npcs = [];
let npcSeq = 1;
const players = new Map();   // contient humains ET bots (bot:true)
let nextId = 1;
let phase = 'waiting';          // 'waiting' | 'starting' | 'playing' | 'roundover'
let winnerName = null;
let resetAt = 0, roundEndsAt = 0, startAt = 0;
let testMode = false;

const humans = () => [...players.values()].filter(p => !p.bot);
const spawnPoint = () => ({ x: rand(80, WORLD.w - 80), y: rand(80, WORLD.h - 80) });

function spawnNpcs() {
  npcs = [];
  for (let i = 0; i < CROWD; i++) {
    const s = spawnPoint();
    npcs.push({ id: npcSeq++, x: s.x, y: s.y, angle: rand(0, Math.PI*2), speed: PLAYER_SPEED, wanderT: rand(0.4,1.8), moving: true, dead: false });
  }
}
function selectMap() {           // passe à une AUTRE map (différente de la précédente)
  if (MAPS.length > 1) mapIndex = (mapIndex + 1) % MAPS.length; else mapIndex = 0;
  MAP = MAPS[mapIndex]; WORLD = { w: MAP.w, h: MAP.h };
}

// ---- Bots (mode test) ----
function makeBot(i) {
  const s = spawnPoint();
  return { id: nextId++, ws: null, bot: true, name: 'Bot ' + (i+1),
    x: s.x, y: s.y, angle: rand(0, Math.PI*2), dx:0, dy:0, alive: true,
    punchAnim: 0, stunUntil: 0, kills: 0,
    speed: PLAYER_SPEED, moveT: 0, moving: true, aggressive: i === 0 };
}
function ensureBots() {
  const have = [...players.values()].filter(p => p.bot).length;
  for (let i = have; i < TEST_BOTS; i++) { const b = makeBot(i); players.set(b.id, b); }
}
function clearBots() { for (const p of [...players.values()]) if (p.bot) players.delete(p.id); }

// Prépare la manche : spawn + positionnement, puis 5 s de décompte (phase 'starting').
function beginRound(advanceMap) {
  selectMap();                 // change de map à chaque manche
  spawnNpcs();
  phase = 'starting'; winnerName = null; startAt = Date.now() + COUNTDOWN;
  for (const p of players.values()) {
    const s = spawnPoint();
    p.x = s.x; p.y = s.y; p.alive = true; p.punchAnim = 0; p.stunUntil = 0; p.kills = 0; p.dx = 0; p.dy = 0;
  }
  broadcastMap();
}

const aliveHunters = () => [...players.values()].filter(p => p.alive);

function endRound(name) { winnerName = name; phase = 'roundover'; resetAt = Date.now() + RESET_DELAY; npcs = []; }

function maybeStartOrEnd() {
  const connected = players.size, alive = aliveHunters().length, now = Date.now();
  if (phase === 'waiting') {
    if (connected >= MIN_PLAYERS) beginRound(false);
  } else if (phase === 'starting') {
    if (connected < MIN_PLAYERS) { phase = 'waiting'; npcs = []; }
    else if (now >= startAt) { phase = 'playing'; roundEndsAt = now + ROUND_TIME; }  // GO !
  } else if (phase === 'playing') {
    if (connected < MIN_PLAYERS) { phase = 'waiting'; npcs = []; }
    // tous les autres joueurs ont été trouvés
    else if (alive <= 1) { const w = aliveHunters()[0]; endRound(w ? w.name : null); }
    else if (now >= roundEndsAt) {
      // temps écoulé : gagne celui qui a trouvé le plus de joueurs
      const surv = aliveHunters().sort((a,b)=>(b.kills||0)-(a.kills||0));
      const top = surv[0], tie = surv[1] && (surv[1].kills||0) === (top.kills||0);
      endRound(tie ? null : (top ? top.name : null));
    }
  } else if (phase === 'roundover' && now >= resetAt) {
    if (players.size >= MIN_PLAYERS) beginRound(true); else { phase = 'waiting'; npcs = []; }
  }
}

// aim = direction visée (vers le curseur). Frappe la cible la plus proche dans le cône.
function tryPunch(p, aim) {
  const now = Date.now();
  if (!p.alive || phase !== 'playing' || now < p.stunUntil) return;
  if (typeof aim === 'number') p.angle = aim;
  p.stunUntil = now + STUN; p.punchAnim = now + 240;
  const dir = p.angle;
  let best = null, bestD = PUNCH_RANGE, bestKind = null, bestIdx = -1;
  // joueurs (et bots)
  for (const o of players.values()) {
    if (o === p || !o.alive) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d > PUNCH_RANGE || d >= bestD) continue;
    if (Math.abs(angDiff(Math.atan2(o.y - p.y, o.x - p.x), dir)) > PUNCH_HALF_ANGLE) continue;
    best = o; bestD = d; bestKind = 'player';
  }
  // PNJ (les cadavres sont ignorés)
  for (let i = 0; i < npcs.length; i++) {
    const n = npcs[i];
    if (n.dead) continue;
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d > PUNCH_RANGE || d >= bestD) continue;
    if (Math.abs(angDiff(Math.atan2(n.y - p.y, n.x - p.x), dir)) > PUNCH_HALF_ANGLE) continue;
    best = n; bestD = d; bestKind = 'npc'; bestIdx = i;
  }
  if (bestKind === 'player') {
    best.alive = false; p.kills = (p.kills||0) + 1;
    if (best.ws) send(best.ws, { t:'dead', by: p.name });
  } else if (bestKind === 'npc') {
    best.dead = true; best.fall = dir;   // le PNJ meurt : son corps reste au sol
  }
}

function botAI(p, dt, now) {
  if (!p.alive || now < p.stunUntil) return;
  p.moveT -= dt;
  if (p.moveT <= 0) { p.moving = Math.random() < 0.78; p.angle += rand(-1.2, 1.2); p.moveT = rand(0.4, 1.9); }
  if (p.moving) {
    p.x += Math.cos(p.angle) * p.speed * dt; p.y += Math.sin(p.angle) * p.speed * dt;
    if (p.x < R) { p.x = R; p.angle = Math.PI - p.angle; }
    if (p.x > WORLD.w - R) { p.x = WORLD.w - R; p.angle = Math.PI - p.angle; }
    if (p.y < R) { p.y = R; p.angle = -p.angle; }
    if (p.y > WORLD.h - R) { p.y = WORLD.h - R; p.angle = -p.angle; }
  }
  if (p.aggressive) {
    for (const o of players.values()) {
      if (o === p || !o.alive) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) < PUNCH_RANGE - 6 && Math.random() < 0.06) {
        tryPunch(p, Math.atan2(o.y - p.y, o.x - p.x)); break;
      }
    }
  }
}

let lastT = Date.now();
function tick() {
  const now = Date.now(); const dt = Math.min(0.05, (now - lastT)/1000); lastT = now;
  mTick(dt, now);   // mode 3D « murder » (indépendant du mode 2D)
  // pendant le décompte (starting), tout est figé ; la simulation ne tourne qu'en jeu
  if (phase !== 'playing') { maybeStartOrEnd(); broadcastState(now); return; }
  for (const n of npcs) {
    if (n.dead) continue;                  // un cadavre ne bouge plus
    n.wanderT -= dt;
    if (n.wanderT <= 0) { n.moving = Math.random() < 0.82; n.angle += rand(-0.9, 0.9); n.wanderT = rand(0.4, 1.8); }
    if (!n.moving) continue;               // pauses (comme un vrai joueur qui s'arrête)
    n.x += Math.cos(n.angle)*n.speed*dt; n.y += Math.sin(n.angle)*n.speed*dt;
    if (n.x < R) { n.x = R; n.angle = Math.PI - n.angle; }
    if (n.x > WORLD.w - R) { n.x = WORLD.w - R; n.angle = Math.PI - n.angle; }
    if (n.y < R) { n.y = R; n.angle = -n.angle; }
    if (n.y > WORLD.h - R) { n.y = WORLD.h - R; n.angle = -n.angle; }
  }
  for (const p of players.values()) {
    if (p.bot) { botAI(p, dt, now); continue; }
    if (!p.alive) continue;
    if (now < p.stunUntil) continue;
    if (p.dx || p.dy) {
      const len = Math.hypot(p.dx, p.dy) || 1;
      p.x += (p.dx/len)*PLAYER_SPEED*dt; p.y += (p.dy/len)*PLAYER_SPEED*dt;
      p.x = Math.max(R, Math.min(WORLD.w - R, p.x)); p.y = Math.max(R, Math.min(WORLD.h - R, p.y));
    }
  }
  maybeStartOrEnd();
  broadcastState(now);
}

function broadcastState(now) {
  const timeLeft = phase === 'playing' ? Math.max(0, Math.round((roundEndsAt - now)/1000)) : 0;
  const startIn = phase === 'starting' ? Math.max(0, Math.ceil((startAt - now)/1000)) : 0;
  const state = {
    t:'state', phase, winner: winnerName, mapName: MAP.name, timeLeft, startIn, max: MAX_PLAYERS, min: MIN_PLAYERS, test: testMode,
    resetIn: phase === 'roundover' ? Math.max(0, Math.round((resetAt - now)/1000)) : 0,
    npcs: npcs.map(n => ({ id: n.id, x: Math.round(n.x), y: Math.round(n.y), a: +((n.dead ? (n.fall ?? n.angle) : n.angle)).toFixed(2), dead: !!n.dead })),
    players: [...players.values()].map(p => ({
      id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), a: +p.angle.toFixed(2),
      alive: p.alive, punch: p.punchAnim > now, stun: now < p.stunUntil, kills: p.kills||0 })),
    count: players.size,
  };
  const msg = JSON.stringify(state);
  for (const p of players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(msg);
}

function mapPayload() { return { t:'map', world: WORLD, name: MAP.name, floor: MAP.floor, decor: MAP.decor }; }
function broadcastMap() { const m = JSON.stringify(mapPayload()); for (const p of players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(m); }
function send(ws, obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

// ---- HTTP (statique + API maps) ----
const server = http.createServer((req, res) => {
  // API : récupérer les maps
  if (req.method === 'GET' && req.url === '/api/maps') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(MAPS));
  }
  // API : enregistrer les maps (depuis l'éditeur)
  if (req.method === 'POST' && req.url === '/api/maps') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const s = sanitizeMaps(JSON.parse(body));
        if (!s) throw new Error('format invalide');
        MAPS = s; mapIndex = Math.min(mapIndex, MAPS.length - 1); MAP = MAPS[mapIndex]; WORLD = { w: MAP.w, h: MAP.h };
        fs.writeFileSync(MAPS_FILE, JSON.stringify(MAPS, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, count: MAPS.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  // API : map du mode Murder (éditeur 3D)
  if (req.method === 'GET' && req.url === '/api/murdermap') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(getMurderMap()));
  }
  if (req.method === 'POST' && req.url === '/api/murdermap') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4e6) req.destroy(); });
    req.on('end', () => {
      try {
        const s = sanitizeMurder(JSON.parse(body));
        if (!s) throw new Error('format invalide');
        murderMapData = s;
        fs.writeFileSync(MURDER_MAP_FILE, JSON.stringify(s, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, decor: s.decor.length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  // fichiers statiques
  let file = req.url === '/' ? '/play.html' : req.url.split('?')[0];
  const fp = path.join(__dirname, path.normalize(file).replace(/^([/\\])+/, ''));
  if (!fp.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fp);
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.json' ? 'application/json' : 'text/plain';
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
    res.end(data);
  });
});

// ============================================================
//  MODE 3D « MURDER » — 1-2 tueurs (couteau), 1 shérif (fusil à 10 s), innocents
// ============================================================
const M_MAX = 12;               // humains max
const M_MIN = 2;                // minimum pour lancer (PAS de bots)
const M_SCALE = 4.0;            // très grande map
const M_KNIFE_RANGE = 120, M_KNIFE_CONE = 1.15;
const M_GUN_RANGE = 1500, M_GUN_CONE = 0.16;
const M_REVEAL = 5000;          // 5 s : annonce du rôle au centre de l'écran
const M_WEAPON_DELAY = 10000;   // couteaux ET arme 10 s après le début de la manche
const M_ROUND = 5*60*1000, M_RESET = 9000, M_KNIFE_CD = 700, M_GUN_CD = 900;

const baseSalon = () => MAPS.find(x => (x.name||'').trim().toLowerCase() === 'le salon') || MAPS[0];
const M_FP = { plant:[70,70],crate:[70,70],statue:[64,64],sofa:[130,70],table:[96,96],chair:[46,46],fountain:[124,124],
  lamp:[44,54],torii:[120,140],sakura:[122,116],lantern:[52,68],bonsai:[68,60],pagoda:[120,152],ball:[42,42],
  goal:[176,66],trophy:[58,82],cone:[36,46],flag:[66,88],window:[120,26],painting:[120,80],barrier:[120,24],pc:[120,70] };
const M_FLAT = { rug:1, pitch:1, tatami:1 };   // on marche dessus (pas de collision)
const fpOf = o => (o.w!=null && o.h!=null) ? [o.w,o.h] : (M_FP[o.type] || [70,70]);
function scaledSalon(){
  const m = baseSalon(), S = M_SCALE;
  const decor = (m.decor||[]).map(o => { const [ow,oh]=fpOf(o);
    return { ...o, x:Math.round(o.x*S), y:Math.round(o.y*S), w:Math.round(ow*S), h:Math.round(oh*S) }; });
  const W=Math.round(m.w*S), H=Math.round(m.h*S);
  const add=(type,x,y,w,h)=>decor.push({type,x:Math.round(x),y:Math.round(y),w:Math.round(w),h:Math.round(h)});
  const cs=300, mg=130;   // canapés d'angle dans les 4 coins
  add('sofa',mg,mg,cs,cs); add('sofa',W-mg-cs,mg,cs,cs); add('sofa',mg,H-mg-cs,cs,cs); add('sofa',W-mg-cs,H-mg-cs,cs,cs);
  add('fountain',W*0.5-150,H*0.5-150,300,300);                 // fontaine centrale
  add('statue',W*0.5-75,H*0.24-75,150,150);
  add('table',W*0.27-90,H*0.68-90,180,180); add('table',W*0.73-90,H*0.68-90,180,180);
  add('plant',W*0.18,H*0.5-60,120,120); add('plant',W*0.82-120,H*0.5-60,120,120);
  add('pagoda',W*0.5-80,H*0.78-100,160,200);
  // murs intérieurs : créent des couloirs et des recoins (épaisseur 44, avec passages)
  const TW=44;
  add('wall',W*0.30,0,TW,H*0.34);            add('wall',W*0.30,H*0.56,TW,H*0.44);
  add('wall',W*0.66,0,TW,H*0.44);            add('wall',W*0.66,H*0.64,TW,H*0.36);
  add('wall',W*0.30,H*0.34,W*0.18,TW);       add('wall',W*0.50,H*0.62,W*0.16,TW);
  add('wall',0,H*0.50,W*0.16,TW);            add('wall',W*0.84,H*0.50,W*0.16,TW);
  add('wall',W*0.40,H*0.20,W*0.14,TW);       add('wall',W*0.46,H*0.80,W*0.16,TW);
  add('wall',W*0.18,H*0.18,TW,H*0.2);        add('wall',W*0.82,H*0.62,TW,H*0.2);
  add('wall',W*0.5,H*0.42,W*0.1,TW);         add('wall',W*0.5,H*0.58,W*0.1,TW);
  // salle de sécurité (murs + PC pour voir les caméras), porte sur le côté gauche
  const rx=Math.round(W*0.72), ry=Math.round(H*0.05), rw=560, rh=460, TW2=44, dr=rh*0.34;
  add('wall',rx,ry,rw,TW2);                   // mur haut
  add('wall',rx,ry+rh-TW2,rw,TW2);            // mur bas
  add('wall',rx+rw-TW2,ry,TW2,rh);            // mur droit
  add('wall',rx,ry,TW2,dr);                   // mur gauche (haut)
  add('wall',rx,ry+dr+rh*0.28,TW2,rh-dr-rh*0.28); // mur gauche (bas) → porte au milieu
  add('pc',rx+rw*0.5-60,ry+rh*0.5-35,120,70); // poste de surveillance
  return { w:W, h:H, floor:m.floor, decor };
}
function mColliders(){ const out=[]; for (const o of mRoom.salon.decor){ if (M_FLAT[o.type]) continue; out.push(o); } return out; }
function mResolve(p, R){ for (const r of mColliders()){
  const cx=Math.max(r.x,Math.min(p.x,r.x+r.w)), cz=Math.max(r.y,Math.min(p.z,r.y+r.h));
  let dx=p.x-cx, dz=p.z-cz, d2=dx*dx+dz*dz;
  if (d2<R*R){ if (d2<0.01){ const l=p.x-r.x, rr=r.x+r.w-p.x, t=p.z-r.y, b=r.y+r.h-p.z, mn=Math.min(l,rr,t,b);
      if(mn===l)p.x=r.x-R; else if(mn===rr)p.x=r.x+r.w+R; else if(mn===t)p.z=r.y-R; else p.z=r.y+r.h+R; }
    else { const d=Math.sqrt(d2); p.x+=dx/d*(R-d); p.z+=dz/d*(R-d); } } } }

// ---- map personnalisée du mode Murder (éditable via editor3d.html) ----
const MURDER_MAP_FILE = path.join(__dirname, 'murdermap.json');
const M_ALL = ['rug','plant','crate','window','statue','barrier','sofa','painting','pitch','tatami','table','chair','fountain','lamp','torii','sakura','lantern','bonsai','pagoda','ball','goal','trophy','cone','flag','wall','pc'];
function sanitizeMurder(m){
  if (!m || typeof m!=='object') return null;
  const out = { w:Math.max(800,Math.min(12000,+m.w||6000)), h:Math.max(600,Math.min(12000,+m.h||3800)),
    floor: typeof m.floor==='string'?m.floor.slice(0,9):'#2a2f44', decor:[] };
  if (Array.isArray(m.decor)) for (const d of m.decor){
    if (!d || !M_ALL.includes(d.type)) continue;
    const f = M_FP[d.type] || [70,70];
    const it = { type:d.type, x:Math.round(+d.x||0), y:Math.round(+d.y||0),
      w:Math.max(8,Math.round(+d.w||f[0])), h:Math.max(8,Math.round(+d.h||f[1])) };
    if (typeof d.color==='string') it.color = d.color.slice(0,9);
    if (Number.isFinite(+d.rot) && +d.rot!==0) it.rot = +(+d.rot).toFixed(3);
    out.decor.push(it);
  }
  return out;
}
let murderMapData = null;
function loadMurderMap(){ try{ const s=sanitizeMurder(JSON.parse(fs.readFileSync(MURDER_MAP_FILE,'utf8'))); if(s){ murderMapData=s; console.log('  ✓ murdermap.json chargé ('+s.decor.length+' objets)'); return; } }catch{} murderMapData=null; }
function getMurderMap(){ return murderMapData || scaledSalon(); }
loadMurderMap();

const mRoom = { phase:'waiting', players:new Map(), test:false, revealAt:0, startAt:0, weaponsAt:0, endAt:0, resetAt:0, winner:null, salon:null };
mRoom.salon = getMurderMap();
let mGun = null;   // arme du shérif tombée au sol (ramassable par un innocent)
const isShooter = p => p.role==='sheriff' || p.gunner;
function mKill(p){ p.alive=false; if (isShooter(p)){ mGun = { x:Math.round(p.x), z:Math.round(p.z) }; p.gunner=false; } }
const mHumans = () => [...mRoom.players.values()].filter(p=>!p.bot);
function mSpawn(){ const s = mRoom.salon; return { x: rand(140, s.w-140), z: rand(140, s.h-140) }; }

// ---- bots (uniquement en mode test) ----
let mBotSeq=1;
function mMakeBot(){ const sp=mSpawn(); return { id:nextId++, ws:null, bot:true, name:'Bot '+(mBotSeq++),
  x:sp.x, z:sp.z, yaw:rand(0,6.28), role:'innocent', alive:true, playing:false, attack:0, kills:0, atkCd:0, moveT:0, moving:true }; }
function mFillBots(n){ while (mRoom.players.size < n) { const b=mMakeBot(); mRoom.players.set(b.id,b); } }
function mClearBots(){ for (const p of [...mRoom.players.values()]) if (p.bot) mRoom.players.delete(p.id); }
function mBotAI(p, dt){
  if (!p.alive || !p.playing) return;
  const s=mRoom.salon, R=20;
  p.moveT-=dt;
  if (p.moveT<=0){ p.moving=Math.random()<0.82; p.yaw+=rand(-1.1,1.1); p.moveT=rand(0.4,1.8); }
  if (p.role==='killer'){ let tgt=null,td=1e9;
    for (const o of mRoom.players.values()){ if(o===p||!o.alive||!o.playing||o.role==='killer')continue;
      const d=Math.hypot(o.x-p.x,o.z-p.z); if(d<td){td=d;tgt=o;} }
    if (tgt && td<1000){ p.yaw=Math.atan2(tgt.z-p.z,tgt.x-p.x); p.moving=true; if(td<M_KNIFE_RANGE-8 && Math.random()<0.22) mKnife(p); }
  }
  if (p.moving){ p.x+=Math.cos(p.yaw)*150*dt; p.z+=Math.sin(p.yaw)*150*dt;
    if(p.x<R){p.x=R;p.yaw=Math.PI-p.yaw;} if(p.x>s.w-R){p.x=s.w-R;p.yaw=Math.PI-p.yaw;}
    if(p.z<R){p.z=R;p.yaw=-p.yaw;} if(p.z>s.h-R){p.z=s.h-R;p.yaw=-p.yaw;}
    mResolve(p, R);
  }
}

// annonce des rôles (5 s) puis la manche démarre
function mBeginReveal(){
  mRoom.salon = getMurderMap();
  if (mRoom.test) mFillBots(8);   // complète avec des bots en mode test
  mGun = null;
  const all = [...mRoom.players.values()];
  for (let i=all.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [all[i],all[j]]=[all[j],all[i]]; }
  const killers = all.length >= 8 ? 2 : 1;
  all.forEach((p,i)=>{
    p.role = i < killers ? 'killer' : (i === killers ? 'sheriff' : 'innocent'); p.playing = true; p.gunner = false;
    const sp = mSpawn(); p.x=sp.x; p.z=sp.z; p.yaw=rand(0,6.28); p.alive=true; p.attack=0; p.kills=0; p.atkCd=0;
  });
  const now = Date.now();
  mRoom.phase='reveal'; mRoom.winner=null; mRoom.revealAt = now + M_REVEAL;
}
function mEnd(side){ mRoom.winner=side; mRoom.phase='over'; mRoom.resetAt=Date.now()+M_RESET; for (const p of mRoom.players.values()) p.playing=false; }

function mKnife(p){
  const now = Date.now();
  if (mRoom.phase!=='playing' || !p.alive || !p.playing || p.role!=='killer' || now < mRoom.weaponsAt || now < p.atkCd) return;
  p.atkCd = now + M_KNIFE_CD; p.attack = now + 250;
  let best=null, bd=M_KNIFE_RANGE;
  for (const o of mRoom.players.values()){
    if (o===p || !o.alive || !o.playing || o.role==='killer') continue;
    const d=Math.hypot(o.x-p.x, o.z-p.z);
    if (d>M_KNIFE_RANGE || d>=bd) continue;
    if (Math.abs(angDiff(Math.atan2(o.z-p.z, o.x-p.x), p.yaw)) > M_KNIFE_CONE) continue;
    best=o; bd=d;
  }
  if (best){ mKill(best); p.kills++; if (best.ws) send(best.ws,{t:'mdead', by:'un tueur 🔪'}); }
}
function mShoot(p, aim){
  const now = Date.now();
  const canShoot = (p.role==='sheriff' && now>=mRoom.weaponsAt) || p.gunner;
  if (mRoom.phase!=='playing' || !p.alive || !p.playing || !canShoot || now < p.atkCd) return;
  if (typeof aim==='number') p.yaw=aim;
  p.atkCd = now + M_GUN_CD; p.attack = now + 150;
  let best=null, bd=M_GUN_RANGE;
  for (const o of mRoom.players.values()){
    if (o===p || !o.alive || !o.playing) continue;
    const d=Math.hypot(o.x-p.x, o.z-p.z);
    if (d>M_GUN_RANGE || d>=bd) continue;
    if (Math.abs(angDiff(Math.atan2(o.z-p.z, o.x-p.x), p.yaw)) > M_GUN_CONE) continue;
    best=o; bd=d;
  }
  if (best){
    if (best.role==='killer'){ mKill(best); if (best.ws) send(best.ws,{t:'mdead', by:'le shérif 🔫'}); }
    else {
      // TIR AMI : la cible meurt ET le tireur meurt, son arme tombe au sol sur son corps
      mKill(best); if (best.ws) send(best.ws,{t:'mdead', by:'un tir ami 🔫'});
      mKill(p);    if (p.ws)    send(p.ws,   {t:'mdead', by:'toi-même (tu as tiré un innocent)'});
    }
  }
}
function mCheckWin(now){
  const alive=[...mRoom.players.values()].filter(p=>p.playing && p.alive);
  const killersAlive=alive.filter(p=>p.role==='killer').length;
  const othersAlive=alive.filter(p=>p.role!=='killer').length;
  if (killersAlive===0) mEnd('innocents');
  else if (othersAlive===0) mEnd('killers');
  else if (now>=mRoom.endAt) mEnd('innocents');
}
function mTick(dt, now){
  const need = mRoom.test ? 1 : M_MIN;
  if (mRoom.phase==='waiting'){ if (mHumans().length>=need) mBeginReveal(); }
  else if (mRoom.phase==='reveal'){
    if (mHumans().length<need){ mRoom.phase='waiting'; mClearBots(); for (const p of mRoom.players.values()) p.playing=false; }
    else if (now>=mRoom.revealAt){ mRoom.phase='playing'; mRoom.startAt=now; mRoom.weaponsAt=now+M_WEAPON_DELAY; mRoom.endAt=now+M_ROUND; }
  } else if (mRoom.phase==='playing'){
    if (mHumans().length<1){ mRoom.phase='waiting'; mClearBots(); }
    else {
      for (const p of mRoom.players.values()) if (p.bot) mBotAI(p, dt);
      // ramassage de l'arme tombée par un innocent (devient tireur)
      if (mGun) for (const o of mRoom.players.values()){
        if (!o.alive || !o.playing || o.role==='killer') continue;
        if (Math.hypot(o.x-mGun.x, o.z-mGun.z) < 70){ o.gunner=true; mGun=null; break; }
      }
      mCheckWin(now);
    }
  } else if (mRoom.phase==='over'){
    if (now>=mRoom.resetAt){ if (mHumans().length>=need) mBeginReveal(); else { mRoom.phase='waiting'; mClearBots(); } }
  }
  mBroadcast(now);
}
function mBroadcast(now){
  const armed = mRoom.phase==='playing' && now>=mRoom.weaponsAt;
  for (const me of mRoom.players.values()){
    if (!me.ws || me.ws.readyState!==1) continue;
    const players=[...mRoom.players.values()].map(o=>{
      const b={ id:o.id, name:o.name, x:Math.round(o.x), z:Math.round(o.z), yaw:+o.yaw.toFixed(2), alive:o.alive, atk:o.attack>now, playing:!!o.playing };
      if (mRoom.phase==='over' || o.id===me.id) b.role=o.role;   // rôle révélé seulement à toi / en fin de manche
      return b;
    });
    const survivors=[...mRoom.players.values()].filter(p=>p.playing && p.alive && p.role!=='killer').length;
    send(me.ws, { t:'mstate', phase:mRoom.phase, count:mRoom.players.size, min:M_MIN, winner:mRoom.winner, reveal:mRoom.phase==='over',
      revealIn: mRoom.phase==='reveal'?Math.max(0,Math.ceil((mRoom.revealAt-now)/1000)):0,
      weaponIn: mRoom.phase==='playing'?Math.max(0,Math.ceil((mRoom.weaponsAt-now)/1000)):0,
      timeLeft: mRoom.phase==='playing'?Math.max(0,Math.ceil((mRoom.endAt-now)/1000)):0,
      resetIn: mRoom.phase==='over'?Math.max(0,Math.ceil((mRoom.resetAt-now)/1000)):0,
      gun: mGun ? { x:mGun.x, z:mGun.z } : null,
      you:{ role:me.role, alive:me.alive, playing:!!me.playing, gunner:!!me.gunner,
            hasKnife: me.role==='killer' && armed && me.playing && me.alive,
            hasGun:   ((me.role==='sheriff' && armed) || me.gunner) && me.playing && me.alive },
      survivors, players });
  }
}
function murderJoin(ws, m){
  if (mHumans().length>=M_MAX){ send(ws,{t:'full', max:M_MAX}); ws.close(); return null; }
  if (m.test) mRoom.test = true;   // mode test : on remplira avec des bots
  const id=nextId++; const sp=mSpawn();
  const p={ id, ws, name:String(m.name||'').slice(0,16)||('Joueur '+id),
    x:sp.x, z:sp.z, yaw:0, role:'innocent', alive:true, playing:false, attack:0, kills:0, atkCd:0 };
  mRoom.players.set(id, p);
  const s=mRoom.salon;
  send(ws,{ t:'mwelcome', id });
  send(ws,{ t:'mmap', world:{w:s.w,h:s.h}, floor:s.floor, decor:s.decor });
  return p;
}
function murderMsg(p, m){
  if (m.t==='mmove'){ const s=mRoom.salon;
    p.x=Math.max(0,Math.min(s.w, +m.x||0)); p.z=Math.max(0,Math.min(s.h, +m.z||0));
    if (typeof m.yaw==='number') p.yaw=m.yaw; }
  else if (m.t==='knife') mKnife(p);
  else if (m.t==='shoot') mShoot(p, typeof m.yaw==='number'?m.yaw:undefined);
}
function murderLeave(p){ mRoom.players.delete(p.id); if (mHumans().length===0){ mRoom.phase='waiting'; mRoom.winner=null; mRoom.test=false; mClearBots(); } }

// ---- Mode 2D « fake » (existant) ----
function fakeJoin(ws, m){
  if (humans().length>=MAX_PLAYERS){ send(ws,{t:'full', max:MAX_PLAYERS}); ws.close(); return null; }
  const id=nextId++; const s=spawnPoint();
  const p={ id, ws, name:String(m.name||'').slice(0,16)||('Joueur '+id), x:s.x, y:s.y, angle:0,
    dx:0, dy:0, alive: phase!=='playing', punchAnim:0, stunUntil:0, kills:0 };
  players.set(id, p);
  send(ws,{ t:'welcome', id }); send(ws, mapPayload());
  if (m.test){ testMode=true; ensureBots(); }
  return p;
}
function fakeMsg(p, m){
  if (m.t==='input'){ p.dx=Math.max(-1,Math.min(1,+m.dx||0)); p.dy=Math.max(-1,Math.min(1,+m.dy||0)); if (typeof m.a==='number') p.angle=m.a; }
  else if (m.t==='punch') tryPunch(p, typeof m.a==='number'?m.a:undefined);
}
function fakeLeave(p){ players.delete(p.id); if (humans().length===0){ testMode=false; clearBots(); phase='waiting'; npcs=[]; } }

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  let P=null, mode=null;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t==='join' && !P){
      mode = m.mode==='murder' ? 'murder' : 'fake';
      P = mode==='murder' ? murderJoin(ws, m) : fakeJoin(ws, m);
      return;
    }
    if (!P) return;
    if (mode==='murder') murderMsg(P, m); else fakeMsg(P, m);
  });
  ws.on('close', () => { if (P){ if (mode==='murder') murderLeave(P); else fakeLeave(P); } });
  ws.on('error', () => {});
});

setInterval(tick, TICK);
server.listen(PORT, () => {
  console.log(`\n  🕵️  Trouve le Faux — serveur lancé`);
  console.log(`  ➜  Jeu :      http://localhost:${PORT}`);
  console.log(`  ➜  Éditeur :  http://localhost:${PORT}/editor.html`);
  console.log(`  ➜  Mode 3D :  http://localhost:${PORT}/murder.html`);
  console.log(`  ➜  Réseau :   http://<ton-IP-locale>:${PORT}\n`);
});
