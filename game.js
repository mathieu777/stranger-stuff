/* Stranger Stuff : le code du jeu.

   Plan du fichier
   1. Réglages et niveaux
   2. Outils (hasard, sauvegarde, collisions)
   3. Génération d'un niveau
   4. Son
   5. Commandes (tactile et clavier)
   6. Logique du jeu (mise à jour à chaque image)
   7. Dessin
   8. Écrans et déroulement d'une partie
   9. Installation PWA

   Principe général : une boucle tourne environ 60 fois par seconde.
   À chaque tour, update() fait avancer le jeu, puis render() le dessine. */
'use strict';

/* ==================== 1. RÉGLAGES ET NIVEAUX ==================== */

const VIEW_W = 180;     // largeur du monde en pixels de jeu
let VIEW_H = 320;       // hauteur visible, adaptée à l'écran du téléphone

const HERO_SPEED = 54;  // pixels par seconde
const HERO_SIZE = 4;    // demi-largeur de la zone de collision du héros
const MAX_HEARTS = 3;

const LIGHT_RANGE = 78;       // portée de la lampe
const LIGHT_ANGLE = 0.46;     // demi-ouverture du faisceau, en radians
const BATTERY_DRAIN = 17;     // % perdus par seconde lampe allumée
const BATTERY_REFILL = 3.5;   // % regagnés par seconde lampe éteinte

const COP_POINTS = 500;       // points offerts par le policier
const NOVA_RADIUS = 95;       // portée de l'explosion de l'orbe Nova
const NOVA_POINTS = 50;       // points par zombie pulvérisé

// Les trois espèces de zombies.
// dose : temps d'exposition à la lampe nécessaire pour les figer.
const ZOMBIES = {
  walker: { speed: 17, aggro: 72,  dose: 0.12, stun: 2.8, size: 4, shirt: '#5a6f8c' },
  runner: { speed: 37, aggro: 105, dose: 0.22, stun: 2.2, size: 4, shirt: '#b3265f' },
  brute:  { speed: 13, aggro: 95,  dose: 0.65, stun: 1.8, size: 7, shirt: '#5b3a8f' },
};

// Les cinq niveaux. Pour rééquilibrer le jeu, c'est ici qu'il faut toucher.
const LEVELS = [
  { name: 'Rue des Érables', sub: 'Les voisins ont une sale mine.', theme: 'street',
    len: 1000, walker: 9, runner: 0, brute: 0, tapes: 5, batteries: 2, dark: .78, glow: 50 },
  { name: 'Parking du Starlite', sub: 'Le film est fini depuis longtemps.', theme: 'parking',
    len: 1300, walker: 14, runner: 3, brute: 0, tapes: 6, batteries: 3, dark: .84, glow: 46 },
  { name: 'Forêt de Black Pine', sub: 'Certains courent. Ne traîne pas.', theme: 'forest',
    len: 1600, walker: 15, runner: 7, brute: 1, tapes: 7, batteries: 4, dark: .9, glow: 40 },
  { name: 'Voie ferrée', sub: 'Les gros encaissent la lumière.', theme: 'rail',
    len: 1900, walker: 17, runner: 10, brute: 3, tapes: 8, batteries: 4, dark: .92, glow: 38 },
  { name: 'Colline de la radio', sub: 'La station est tout en haut.', theme: 'hill',
    len: 2200, walker: 20, runner: 13, brute: 5, tapes: 9, batteries: 5, dark: .95, glow: 34 },
];

// Couleurs de chaque décor : sol, sol secondaire, détails.
const THEMES = {
  street:  { ground: '#2c2840', alt: '#3a3550', mark: '#8a7f5a', side: '#2e4238' },
  parking: { ground: '#2a2638', alt: '#332e44', mark: '#b9b3c9', side: '#24202f' },
  forest:  { ground: '#1d3029', alt: '#263b30', mark: '#35503f', side: '#14241f' },
  rail:    { ground: '#332a2e', alt: '#40353a', mark: '#5e4a3c', side: '#262023' },
  hill:    { ground: '#27302f', alt: '#313c39', mark: '#4c5a52', side: '#1b2322' },
};

/* ==================== 2. OUTILS ==================== */

const $ = (id) => document.getElementById(id);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick = (list) => list[randInt(0, list.length - 1)];

// La sauvegarde peut être interdite par le navigateur : on ne plante jamais pour ça.
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem('ss-' + key); return v === null ? fallback : v; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('ss-' + key, value); } catch { /* sauvegarde indisponible */ }
  },
};

// Vrai si le carré centré en (x, y) touche le rectangle r.
const boxHitsRect = (x, y, half, r) =>
  x + half > r.x && x - half < r.x + r.w && y + half > r.y && y - half < r.y + r.h;

// Vrai si un carré touche un obstacle ou le bord de la route.
function isBlocked(x, y, half) {
  if (x - half < 6 || x + half > VIEW_W - 6) return true;
  if (y - half < 0 || y + half > world.len) return true;
  return world.obstacles.some((o) => boxHitsRect(x, y, half, o));
}

// Déplace une entité axe par axe : elle glisse le long des obstacles.
// Renvoie true si elle a été bloquée.
function moveEntity(e, dx, dy, half) {
  let blocked = false;
  if (!isBlocked(e.x + dx, e.y, half)) e.x += dx; else blocked = true;
  if (!isBlocked(e.x, e.y + dy, half)) e.y += dy; else blocked = true;
  return blocked;
}

/* ==================== 3. GÉNÉRATION D'UN NIVEAU ==================== */

let world = null;

// Un obstacle au hasard, adapté au décor.
function makeObstacle(theme, y) {
  const types = {
    street:  ['car', 'carH', 'bin'],
    parking: ['car', 'car', 'carH'],
    forest:  ['tree', 'tree', 'rock'],
    rail:    ['wagon', 'crate', 'crate'],
    hill:    ['tree', 'rock', 'crate'],
  };
  const sizes = {
    car: [20, 38], carH: [38, 20], bin: [12, 12], tree: [16, 14],
    rock: [18, 13], wagon: [66, 24], crate: [18, 18],
  };
  const kind = pick(types[theme]);
  const [w, h] = sizes[kind];
  return {
    kind, w, h,
    x: randInt(8, VIEW_W - 8 - w),
    y: y + randInt(-10, 10),
    color: pick(['#a63d40', '#3f7cac', '#c98f2c', '#5f8f6b', '#8d6aa8']),
  };
}

// Parcours en largeur : on vérifie qu'un chemin existe de la ligne de départ
// à la sortie, et on renvoie les cases atteignables.
function findReachableCells(startX, startY) {
  const CELL = 6;
  const cols = Math.floor(VIEW_W / CELL);
  const rows = Math.floor(world.len / CELL);
  const seen = new Uint8Array(cols * rows);
  const queue = [[Math.floor(startX / CELL), Math.floor(startY / CELL)]];
  const cells = [];
  let reachesGoal = false;
  seen[queue[0][1] * cols + queue[0][0]] = 1;

  for (let i = 0; i < queue.length; i++) {
    const [cx, cy] = queue[i];
    const x = cx * CELL + CELL / 2;
    const y = cy * CELL + CELL / 2;
    cells.push({ x, y });
    if (y < world.goalY) reachesGoal = true;
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const key = ny * cols + nx;
      if (seen[key]) continue;
      seen[key] = 1;
      if (!isBlocked(nx * CELL + CELL / 2, ny * CELL + CELL / 2, HERO_SIZE + 1)) queue.push([nx, ny]);
    }
  }
  return { reachesGoal, cells };
}

function buildLevel(index) {
  const cfg = LEVELS[index];
  const startY = cfg.len - 40;
  let reach;

  // On recommence tant que le niveau n'a pas de passage praticable.
  do {
    world = { cfg, len: cfg.len, goalY: 58, obstacles: [], lamps: [], items: [], zombies: [], particles: [], fx: [], waves: [], cop: null, nova: null };
    for (let y = cfg.len - 130; y > 120; y -= randInt(58, 84)) {
      const count = randInt(1, cfg.theme === 'rail' ? 2 : 3);
      for (let n = 0; n < count; n++) world.obstacles.push(makeObstacle(cfg.theme, y));
    }
    reach = findReachableCells(VIEW_W / 2, startY);
  } while (!reach.reachesGoal);

  // Lampadaires, alternés à gauche et à droite.
  let side = 0;
  for (let y = cfg.len - 90; y > 90; y -= 150) {
    world.lamps.push({ x: side++ % 2 ? VIEW_W - 16 : 16, y });
  }

  // Objets et zombies ne sont posés que sur des cases atteignables.
  const playable = reach.cells.filter((c) => c.y > 80 && c.y < cfg.len - 130);
  const spot = () => pick(playable);

  for (let i = 0; i < cfg.tapes; i++) world.items.push({ type: 'tape', ...spot() });
  for (let i = 0; i < cfg.batteries; i++) world.items.push({ type: 'battery', ...spot() });

  // Un policier assez tôt dans le niveau, un orbe Nova plus loin, là où ça se corse.
  const between = (from, to) => {
    const zone = reach.cells.filter((c) => c.y > cfg.len * from && c.y < cfg.len * to && c.x > 30 && c.x < VIEW_W - 30);
    return pick(zone.length ? zone : playable);
  };
  world.cop = { ...between(.58, .74), met: false };
  world.nova = { ...between(.22, .42), taken: false };

  for (const type of ['walker', 'runner', 'brute']) {
    for (let i = 0; i < cfg[type]; i++) {
      const p = spot();
      world.zombies.push({
        type, x: p.x, y: p.y,
        spec: ZOMBIES[type],
        speed: ZOMBIES[type].speed * rand(.88, 1.12),
        heading: rand(0, Math.PI * 2),
        turnIn: rand(.5, 3),
        dose: 0, stun: 0, walk: rand(0, 6), steer: 0, steerDir: 1,
        skin: pick(['#9fbf6e', '#8fae74', '#a9b98a']),
      });
    }
  }

  // Spores qui flottent dans l'air.
  for (let i = 0; i < 26; i++) {
    world.particles.push({ x: rand(0, VIEW_W), y: rand(0, 400), v: rand(3, 9), s: rand(0, 6) });
  }

  hero.x = VIEW_W / 2;
  hero.y = startY;
  hero.angle = -Math.PI / 2;
  hero.inv = 0;
  hero.battery = 100;
  hero.lightOn = false;
  hero.lockedOut = false;
  camY = clamp(hero.y - VIEW_H * .68, 0, world.len - VIEW_H);
}

/* ==================== 4. SON ====================
   Aucun fichier audio : tout est synthétisé en direct avec la Web Audio API. */

const sound = {
  ctx: null,
  master: null,
  muted: store.get('muted', '0') === '1',
  step: 0,
  nextTime: 0,
  timer: null,

  start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .5;
      this.master.connect(this.ctx.destination);
    }
    this.ctx.resume().catch(() => {});
    if (!this.timer) {
      this.nextTime = this.ctx.currentTime + .05;
      this.timer = setInterval(() => this.schedule(), 80);
    }
  },

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  },

  toggle() {
    this.muted = !this.muted;
    store.set('muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : .5;
  },

  // Une note simple, avec glissement de hauteur optionnel.
  tone(freq, dur, type = 'square', vol = .15, slideTo = 0, when = 0) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + .02);
  },

  // Boucle de basse originale : quatre accords, seize pas chacun.
  schedule() {
    if (!this.ctx) return;
    const roots = [55, 43.65, 36.71, 41.2];  // La, Fa, Ré, Mi
    const pattern = [1, 1, 2, 1, 1.5, 1, 2, 1.5, 1, 1, 2, 1, 3, 2, 1.5, 1];
    const stepTime = 60 / 112 / 4;
    while (this.nextTime < this.ctx.currentTime + .25) {
      const bar = Math.floor(this.step / 16) % roots.length;
      const n = pattern[this.step % 16];
      this.tone(roots[bar] * n, stepTime * .9, 'sawtooth', .07, 0, this.nextTime);
      if (this.step % 8 === 4) this.tone(roots[bar] * 6, .5, 'triangle', .035, 0, this.nextTime);
      this.nextTime += stepTime;
      this.step++;
    }
  },

  tape() { this.tone(880, .08); this.tone(1320, .12, 'square', .12, 0, this.ctx ? this.ctx.currentTime + .07 : 0); },
  battery() { this.tone(440, .22, 'square', .12, 1200); },
  hit() { this.tone(170, .35, 'sawtooth', .3, 45); },
  stun() { this.tone(1500, .1, 'triangle', .1, 500); },
  click() { this.tone(300, .04, 'square', .07); },
  cop() { [660, 880, 660, 880].forEach((f, i) => this.tone(f, .1, 'square', .1, 0, this.ctx ? this.ctx.currentTime + i * .1 : 0)); },

  // Explosion : un souffle de bruit blanc et un grondement grave.
  boom() {
    if (!this.ctx) return;
    const length = Math.floor(this.ctx.sampleRate * .9);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    const noise = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = .75;
    noise.buffer = buffer;
    noise.connect(gain).connect(this.master);
    noise.start();
    this.tone(120, .8, 'sawtooth', .4, 28);
  },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .22, 'square', .13, 0, this.ctx ? this.ctx.currentTime + i * .12 : 0)); },
  lose() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, .34, 'sawtooth', .17, 0, this.ctx ? this.ctx.currentTime + i * .2 : 0)); },
};

/* ==================== 5. COMMANDES ==================== */

const input = { x: 0, y: 0, stickId: null, ox: 0, oy: 0, light: false, keys: new Set() };
const STICK_RADIUS = 44;

const touchLayer = $('touch');
const stickEl = $('stick');
const knobEl = $('knob');
const lightBtn = $('btn-light');

// Joystick flottant : il apparaît là où le doigt se pose.
touchLayer.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button') || input.stickId !== null) return;
  input.stickId = e.pointerId;
  input.ox = e.clientX;
  input.oy = e.clientY;
  stickEl.style.left = e.clientX + 'px';
  stickEl.style.top = e.clientY + 'px';
  // Le calque peut être décalé sur grand écran : on compense sa position.
  const box = touchLayer.getBoundingClientRect();
  stickEl.style.left = (e.clientX - box.left) + 'px';
  stickEl.style.top = (e.clientY - box.top) + 'px';
  knobEl.style.transform = 'translate(0, 0)';
  stickEl.classList.remove('hidden');
  $('touch-hint').classList.add('hidden');
});

window.addEventListener('pointermove', (e) => {
  if (e.pointerId !== input.stickId) return;
  let dx = e.clientX - input.ox;
  let dy = e.clientY - input.oy;
  const dist = Math.hypot(dx, dy);
  if (dist > STICK_RADIUS) { dx *= STICK_RADIUS / dist; dy *= STICK_RADIUS / dist; }
  input.x = dx / STICK_RADIUS;
  input.y = dy / STICK_RADIUS;
  knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
});

function releaseStick(e) {
  if (e.pointerId !== input.stickId) return;
  input.stickId = null;
  input.x = input.y = 0;
  stickEl.classList.add('hidden');
}
window.addEventListener('pointerup', releaseStick);
window.addEventListener('pointercancel', releaseStick);

// Bouton de lampe : allumée tant que le doigt reste dessus.
lightBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.light = true;
  try { lightBtn.setPointerCapture(e.pointerId); } catch { /* sans incidence */ }
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  lightBtn.addEventListener(type, () => { input.light = false; });
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  input.keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
    if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame();
  }
});
window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
window.addEventListener('contextmenu', (e) => e.preventDefault());

// Rassemble clavier et tactile en un seul vecteur de déplacement.
function readInput() {
  const k = input.keys;
  let x = input.x;
  let y = input.y;
  if (k.has('arrowleft') || k.has('a') || k.has('q')) x = -1;
  if (k.has('arrowright') || k.has('d')) x = 1;
  if (k.has('arrowup') || k.has('w') || k.has('z')) y = -1;
  if (k.has('arrowdown') || k.has('s')) y = 1;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y, light: input.light || k.has(' ') };
}

/* ==================== 6. LOGIQUE DU JEU ==================== */

let state = 'menu';   // menu, play, pause, over, win
let levelIndex = 0;
let score = 0;
let levelStartScore = 0;
let hearts = MAX_HEARTS;
let camY = 0;
let shake = 0;
let time = 0;
let cardTimer = 0;
let toastTimer = 0;
let flash = 0;

const hero = { x: 90, y: 0, angle: -Math.PI / 2, walk: 0, moving: false, inv: 0, battery: 100, lightOn: false, lockedOut: false };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Le zombie se trouve-t-il dans le cône de la lampe ?
function inLightCone(z) {
  const dx = z.x - hero.x;
  const dy = z.y - hero.y;
  const dist = Math.hypot(dx, dy);
  if (dist > LIGHT_RANGE) return false;
  if (dist < 10) return true;
  let diff = Math.atan2(dy, dx) - hero.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // ramène l'écart entre -π et π
  return Math.abs(diff) < LIGHT_ANGLE;
}

function updateHero(dt) {
  const move = readInput();
  hero.moving = Math.hypot(move.x, move.y) > .12;
  if (hero.moving) {
    moveEntity(hero, move.x * HERO_SPEED * dt, move.y * HERO_SPEED * dt, HERO_SIZE);
    hero.walk += dt * 10;
    // La lampe pivote en douceur vers la direction de marche.
    const target = Math.atan2(move.y, move.x);
    const diff = Math.atan2(Math.sin(target - hero.angle), Math.cos(target - hero.angle));
    hero.angle += diff * Math.min(1, dt * 14);
  }
  hero.inv = Math.max(0, hero.inv - dt);

  // Batterie vide : il faut relâcher la lampe et attendre un peu.
  if (hero.battery <= 0) hero.lockedOut = true;
  if (hero.lockedOut && !move.light && hero.battery >= 12) hero.lockedOut = false;
  hero.lightOn = move.light && !hero.lockedOut;
  hero.battery = hero.lightOn
    ? Math.max(0, hero.battery - BATTERY_DRAIN * dt)
    : Math.min(100, hero.battery + BATTERY_REFILL * dt);
}

function updateZombie(z, dt, chaseHero) {
  const s = z.spec;
  z.stun = Math.max(0, z.stun - dt);

  if (chaseHero && hero.lightOn && inLightCone(z)) {
    z.dose += dt;
    if (z.dose >= s.dose && z.stun <= 0) sound.stun();
    if (z.dose >= s.dose) z.stun = s.stun;
  } else {
    z.dose = Math.max(0, z.dose - dt * .5);
  }
  if (z.stun > 0) return;

  const dx = hero.x - z.x;
  const dy = hero.y - z.y;
  const dist = Math.hypot(dx, dy);
  const chasing = chaseHero && dist < s.aggro;
  let angle;
  let speed = z.speed;

  if (chasing) {
    angle = Math.atan2(dy, dx) + Math.sin(time * 3 + z.walk) * .25;
    if (z.steer > 0) { angle += z.steerDir * 1.4; z.steer -= dt; }
  } else {
    // Pas de cible : il erre lentement.
    z.turnIn -= dt;
    if (z.turnIn <= 0) { z.heading = rand(0, Math.PI * 2); z.turnIn = rand(1, 3.5); }
    angle = z.heading;
    speed *= .4;
  }

  const blocked = moveEntity(z, Math.cos(angle) * speed * dt, Math.sin(angle) * speed * dt, s.size);
  if (blocked) {
    z.heading = rand(0, Math.PI * 2);
    if (z.steer <= 0) { z.steer = .6; z.steerDir = Math.random() < .5 ? -1 : 1; }
  }
  z.walk += dt * speed * .45;

  // Contact avec le héros.
  if (chaseHero && hero.inv <= 0 && dist < s.size + HERO_SIZE + 2) hurtHero(z);
}

// Les zombies proches s'écartent un peu pour ne pas se superposer.
function separateZombies(list) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = a.spec.size + b.spec.size + 2;
      const d = Math.hypot(dx, dy) || 1;
      if (d < min) {
        const push = (min - d) / 2 / d;
        moveEntity(a, -dx * push, -dy * push, a.spec.size);
        moveEntity(b, dx * push, dy * push, b.spec.size);
      }
    }
  }
}

function hurtHero(z) {
  hearts--;
  hero.inv = 1.7;
  shake = reducedMotion ? 0 : 5;
  sound.hit();
  try { navigator.vibrate?.(120); } catch { /* vibration indisponible */ }
  const a = Math.atan2(hero.y - z.y, hero.x - z.x);
  moveEntity(hero, Math.cos(a) * 14, Math.sin(a) * 14, HERO_SIZE);
  z.stun = 1;
  drawHearts();
  if (hearts <= 0) endGame();
}

function updateItems() {
  world.items = world.items.filter((item) => {
    if (Math.hypot(item.x - hero.x, item.y - hero.y) > 11) return true;
    if (item.type === 'tape') { score += 100; sound.tape(); }
    else { hero.battery = Math.min(100, hero.battery + 45); hero.lockedOut = false; score += 25; sound.battery(); }
    return false;
  });
}

// Affiche un message bref en haut de l'écran.
function showToast(text) {
  $('toast').textContent = text;
  $('toast').classList.remove('hidden');
  toastTimer = 2.6;
}

// Projette des éclats depuis un point du monde.
function burst(x, y, colors, count) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(25, 110);
    world.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.35, .8), color: pick(colors) });
  }
}

// L'orbe Nova : tout ce qui se trouve autour du héros est pulvérisé.
function novaBlast() {
  const inBlast = (x, y) => Math.hypot(x - hero.x, y - hero.y) < NOVA_RADIUS;

  const destroyed = world.zombies.filter((z) => inBlast(z.x, z.y));
  world.zombies = world.zombies.filter((z) => !inBlast(z.x, z.y));
  destroyed.forEach((z) => burst(z.x, z.y - 4, [z.skin, z.spec.shirt, '#ffe14d'], 12));

  // Voitures, arbres et caisses sautent aussi : le passage se dégage.
  world.obstacles = world.obstacles.filter((o) => {
    if (!inBlast(o.x + o.w / 2, o.y + o.h / 2)) return true;
    burst(o.x + o.w / 2, o.y + o.h / 2, [o.color, '#ffb238', '#ff3d81', '#59616e'], 18);
    return false;
  });

  const points = destroyed.length * NOVA_POINTS;
  score += points;
  world.waves.push({ x: hero.x, y: hero.y, r: 6 });
  hero.inv = Math.max(hero.inv, 1.2);
  shake = reducedMotion ? 0 : 9;
  flash = reducedMotion ? .3 : .9;
  sound.boom();
  try { navigator.vibrate?.([60, 40, 160]); } catch { /* vibration indisponible */ }
  const n = destroyed.length;
  showToast(n ? `Orbe Nova : ${n} zombie${n > 1 ? 's' : ''} pulvérisé${n > 1 ? 's' : ''}, +${points}` : 'Orbe Nova : la voie est libre');
}

// Rencontre avec le policier et ramassage de l'orbe.
function updateSpecials() {
  const { cop, nova } = world;
  if (!cop.met && Math.hypot(cop.x - hero.x, cop.y - hero.y) < 16) {
    cop.met = true;
    score += COP_POINTS;
    sound.cop();
    showToast(`Le policier te salue : tiens bon, petit ! +${COP_POINTS}`);
  }
  if (!nova.taken && Math.hypot(nova.x - hero.x, nova.y - hero.y) < 12) {
    nova.taken = true;
    novaBlast();
  }
}

// Fait vivre les éclats et les ondes de choc.
function updateEffects(dt) {
  flash = Math.max(0, flash - dt * 3);
  toastTimer -= dt;
  if (toastTimer <= 0) $('toast').classList.add('hidden');
  for (const f of world.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; }
  world.fx = world.fx.filter((f) => f.life > 0);
  for (const w of world.waves) w.r += 300 * dt;
  world.waves = world.waves.filter((w) => w.r < NOVA_RADIUS * 1.5);
}

function update(dt) {
  time += dt;
  updateEffects(dt);
  cardTimer -= dt;
  if (cardTimer <= 0) $('level-card').classList.add('hidden');
  shake = Math.max(0, shake - dt * 16);

  for (const p of world.particles) {
    p.y += p.v * dt;
    p.x += Math.sin(time + p.s) * 4 * dt;
  }

  if (state === 'menu') {
    // Écran titre : la caméra remonte doucement la rue.
    camY -= dt * 7;
    if (camY < 0) camY = world.len - VIEW_H;
    for (const z of world.zombies) {
      if (Math.abs(z.y - camY - VIEW_H / 2) < VIEW_H) updateZombie(z, dt, false);
    }
    return;
  }
  if (state !== 'play') return;

  updateHero(dt);
  if (state !== 'play') return;

  // Seuls les zombies proches de l'écran sont actifs : le jeu reste fluide.
  const active = world.zombies.filter((z) => z.y > camY - 90 && z.y < camY + VIEW_H + 90);
  for (const z of active) {
    updateZombie(z, dt, true);
    if (state !== 'play') return;
  }
  separateZombies(active);
  updateItems();
  updateSpecials();

  // La caméra suit le héros en gardant de la vue vers l'avant.
  const target = clamp(hero.y - VIEW_H * .68, 0, world.len - VIEW_H);
  camY += (target - camY) * Math.min(1, dt * 6);

  drawHud();
  if (hero.y < world.goalY) completeLevel();
}

/* ==================== 7. DESSIN ==================== */

const canvas = $('game');
const ctx = canvas.getContext('2d');
const shadowCanvas = document.createElement('canvas');
const shadowCtx = shadowCanvas.getContext('2d');

function resize() {
  const box = canvas.getBoundingClientRect();
  VIEW_H = clamp(Math.round(VIEW_W * box.height / box.width), 260, 420);
  canvas.width = shadowCanvas.width = VIEW_W;
  canvas.height = shadowCanvas.height = VIEW_H;
  ctx.imageSmoothingEnabled = false;
}

// Raccourci : un rectangle aux coordonnées entières, donc net.
function px(c, x, y, w, h) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawGround() {
  const t = THEMES[world.cfg.theme];
  px(t.ground, 0, 0, VIEW_W, VIEW_H);
  px(t.side, 0, 0, 12, VIEW_H);
  px(t.side, VIEW_W - 12, 0, 12, VIEW_H);

  // Détails qui défilent, propres à chaque décor.
  const top = Math.floor(camY / 40) * 40;
  for (let y = top; y < camY + VIEW_H + 40; y += 40) {
    const sy = y - camY;
    const n = Math.abs(y * 7919) % 97;
    if (world.cfg.theme === 'street') {
      px(t.mark, VIEW_W / 2 - 1, sy, 3, 20);
      px(t.alt, 12, sy, 3, 39);
      px(t.alt, VIEW_W - 15, sy, 3, 39);
    } else if (world.cfg.theme === 'parking') {
      px(t.mark, 42, sy, 26, 1);
      px(t.mark, 112, sy, 26, 1);
    } else if (world.cfg.theme === 'rail') {
      for (let k = 0; k < 2; k++) px(t.mark, 44, sy + k * 20, 92, 5);
      px('#6f6a72', 62, sy, 3, 40);
      px('#6f6a72', 115, sy, 3, 40);
    } else {
      px(t.mark, 20 + n, sy + (n % 30), 3, 2);
      px(t.alt, 130 - (n % 50), sy + 12, 5, 3);
      px(t.mark, 60 + (n % 40), sy + 28, 2, 2);
    }
  }
}

// La station ou la sortie du quartier, tout en haut du niveau.
function drawGoal() {
  const sy = -camY;
  if (sy < -70) return;
  const isRadio = levelIndex === LEVELS.length - 1;
  px('#241a3f', 0, sy, VIEW_W, 42);
  px('#3a2c5c', 0, sy + 38, VIEW_W, 4);
  for (let x = 12; x < VIEW_W - 12; x += 24) {
    if (Math.abs(x - 78) > 22) px(Math.sin(x) > 0 ? '#ffb238' : '#3a2c5c', x, sy + 14, 8, 9);
  }
  px('#ffb238', 74, sy + 16, 32, 26);
  px('#fff0c9', 80, sy + 22, 20, 20);
  if (isRadio) {
    px('#8c84a3', 89, sy - 40, 2, 56);
    if (Math.sin(time * 6) > 0) px('#ff3d81', 87, sy - 44, 6, 4);
  }
  // Chevrons clignotants qui indiquent où aller.
  const c = Math.floor(time * 3) % 3;
  for (let i = 0; i < 3; i++) {
    const y = sy + 64 - i * 7;
    const col = i === c ? '#ffb238' : '#6d5a3a';
    px(col, 86, y, 8, 2); px(col, 84, y + 2, 3, 2); px(col, 93, y + 2, 3, 2);
  }
}

function drawLamp(l) {
  const sy = l.y - camY;
  px('#4a4560', l.x - 1, sy - 20, 2, 22);
  px('#4a4560', l.x - 4, sy - 22, 8, 2);
  px('#ffd27a', l.x - 3, sy - 20, 6, 2);
}

function drawItem(it) {
  const sy = it.y - camY + Math.sin(time * 4 + it.x) * 1.5;
  if (it.type === 'tape') {
    px('#efe6d2', it.x - 6, sy - 4, 12, 8);
    px('#ff3d81', it.x - 6, sy - 4, 12, 2);
    px('#1a1033', it.x - 4, sy, 3, 3);
    px('#1a1033', it.x + 1, sy, 3, 3);
  } else {
    px('#4fe0d2', it.x - 3, sy - 6, 7, 12);
    px('#efe6d2', it.x - 1, sy - 8, 3, 2);
    px('#1a1033', it.x - 1, sy - 2, 3, 1);
    px('#1a1033', it.x, sy - 3, 1, 3);
  }
}

function drawObstacle(o) {
  const x = o.x, y = o.y - camY;
  px('rgba(0,0,0,.3)', x + 2, y + 3, o.w, o.h);
  switch (o.kind) {
    case 'car':
      px(o.color, x, y, o.w, o.h);
      px('#1d2a3f', x + 3, y + 8, o.w - 6, 7);
      px('#1d2a3f', x + 3, y + 25, o.w - 6, 6);
      px('#ffe9a8', x + 2, y, 4, 2); px('#ffe9a8', x + o.w - 6, y, 4, 2);
      break;
    case 'carH':
      px(o.color, x, y, o.w, o.h);
      px('#1d2a3f', x + 7, y + 3, 7, o.h - 6);
      px('#1d2a3f', x + 25, y + 3, 6, o.h - 6);
      break;
    case 'bin':
      px('#59616e', x, y, o.w, o.h); px('#7c8594', x - 1, y, o.w + 2, 3);
      break;
    case 'tree':
      px('#4b3423', x + 6, y + 7, 5, 8);
      px('#1f5138', x - 5, y - 16, 27, 24);
      px('#2c6b49', x - 1, y - 20, 18, 20);
      px('#3c8259', x + 3, y - 18, 7, 6);
      break;
    case 'rock':
      px('#5b5f6b', x, y + 2, o.w, o.h - 2); px('#787c88', x + 3, y, o.w - 8, 6);
      break;
    case 'wagon':
      px('#6b3a2e', x, y, o.w, o.h);
      for (let i = 6; i < o.w; i += 12) px('#55291f', x + i, y, 2, o.h);
      px('#8a5040', x, y, o.w, 3);
      break;
    default:
      px('#8a6a3f', x, y, o.w, o.h);
      px('#6a4f2c', x + 2, y + 2, o.w - 4, o.h - 4);
      px('#8a6a3f', x + 8, y, 2, o.h);
  }
}

function drawHero() {
  if (hero.inv > 0 && Math.floor(time * 14) % 2) return; // clignote après un coup
  const x = Math.round(hero.x), y = Math.round(hero.y - camY);
  const step = hero.moving ? Math.round(Math.sin(hero.walk) * 2) : 0;
  const facingDown = Math.sin(hero.angle) > .35;

  px('rgba(0,0,0,.35)', x - 5, y + 6, 10, 3);
  px('#2b2f52', x - 4, y + 3 + step, 3, 5);     // jambes
  px('#2b2f52', x + 1, y + 3 - step, 3, 5);
  px('#d9503f', x - 5, y - 4, 10, 8);           // blouson
  if (!facingDown) px('#3f7c74', x - 3, y - 4, 6, 7); // sac à dos, vu de dos
  px('#e8b48c', x - 4, y - 11, 8, 7);           // tête
  px('#ffb238', x - 5, y - 13, 10, 4);          // casquette
  if (facingDown) {
    px('#ffb238', x - 5, y - 9, 10, 1);
    px('#1a1033', x - 3, y - 8, 2, 2); px('#1a1033', x + 1, y - 8, 2, 2);
  }
}

// Un policier en uniforme bleu, qui fait signe tant qu'on ne l'a pas rejoint.
function drawCop() {
  const { cop } = world;
  const x = Math.round(cop.x), y = Math.round(cop.y - camY);
  const wave = cop.met ? 0 : Math.round(Math.sin(time * 8) * 2);
  px('rgba(0,0,0,.35)', x - 5, y + 6, 10, 3);
  px('#16264f', x - 4, y + 3, 3, 5);
  px('#16264f', x + 1, y + 3, 3, 5);
  px('#2d55b0', x - 5, y - 4, 10, 8);       // uniforme
  px('#ffd24a', x + 1, y - 3, 2, 2);        // insigne
  px('#16264f', x - 5, y + 2, 10, 1);       // ceinture
  px('#2d55b0', x - 8, y - 4, 3, 5);        // bras gauche
  px('#2d55b0', x + 5, y - 9 + wave, 3, 7); // bras levé
  px('#e8b48c', x + 5, y - 11 + wave, 3, 2);
  px('#e8b48c', x - 4, y - 11, 8, 7);       // tête
  px('#1a1033', x - 2, y - 8, 1, 1);
  px('#1a1033', x + 2, y - 8, 1, 1);
  px('#16264f', x - 5, y - 14, 10, 4);      // casquette
  px('#0d1733', x - 6, y - 11, 12, 1);      // visière
  px('#ffd24a', x - 1, y - 13, 2, 2);
}

// Gyrophare au-dessus du policier : visible de loin, même dans le noir.
function drawCopBeacon() {
  const { cop } = world;
  const sy = cop.y - camY;
  if (cop.met || sy < -30 || sy > VIEW_H + 30) return;
  const red = Math.floor(time * 6) % 2 === 0;
  px(red ? '#ff3d4f' : '#5a3038', cop.x - 6, sy - 21, 5, 3);
  px(red ? '#2d3560' : '#4f8cff', cop.x + 1, sy - 21, 5, 3);
}

// L'orbe Nova : une étoile d'énergie qui pulse.
function drawNova() {
  const { nova } = world;
  const sy = nova.y - camY;
  if (nova.taken || sy < -30 || sy > VIEW_H + 30) return;
  const x = Math.round(nova.x), y = Math.round(sy + Math.sin(time * 3) * 2);
  const ray = 7 + Math.round(Math.sin(time * 7) * 2);
  px('#ff3d81', x - 1, y - ray, 2, ray * 2);
  px('#ff3d81', x - ray, y - 1, ray * 2, 2);
  px('#4fe0d2', x - 4, y - 4, 8, 8);
  px('#efe6d2', x - 2, y - 2, 4, 4);
}

// Éclats, onde de choc et flash de l'explosion.
function drawEffects() {
  for (const f of world.fx) px(f.color, f.x, f.y - camY, 2, 2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const w of world.waves) {
    const fade = clamp(1 - w.r / (NOVA_RADIUS * 1.5), 0, 1);
    ctx.strokeStyle = `rgba(79, 224, 210, ${fade})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w.x, w.y - camY, w.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 61, 129, ${fade})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.x, w.y - camY, Math.max(1, w.r - 10), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 244, 214, ${flash})`;
    ctx.fillRect(-12, -12, VIEW_W + 24, VIEW_H + 24);
  }
}

function drawZombie(z) {
  const big = z.spec.size > 4;
  const scale = big ? 1.6 : 1;
  const x = Math.round(z.x), y = Math.round(z.y - camY);
  const jitter = z.stun > 0 ? Math.round(Math.sin(time * 40)) : 0;
  const step = z.stun > 0 ? 0 : Math.round(Math.sin(z.walk) * 2);
  const skin = z.stun > 0 ? '#c9e6ef' : z.skin;
  const r = (dx, dy, w, h, c) => px(c, x + jitter + dx * scale, y + dy * scale, Math.ceil(w * scale), Math.ceil(h * scale));

  px('rgba(0,0,0,.35)', x - 5 * scale, y + 6 * scale, 10 * scale, 3);
  r(-4, 3 + step / 2, 3, 5, '#3b3247');
  r(1, 3 - step / 2, 3, 5, '#3b3247');
  r(-5, -4, 10, 8, z.spec.shirt);
  r(-2, 1, 3, 2, '#2a2038');                // accroc dans le vêtement
  r(-7, -3 + step / 2, 3, 3, skin);          // bras tendus
  r(4, -3 - step / 2, 3, 3, skin);
  r(-4, -11, 8, 7, skin);
  r(-4, -12, 8, 2, '#3d4a35');               // cheveux
  r(0, -6, 3, 1, '#4e2a35');                 // bouche
}

// Les yeux sont dessinés après l'obscurité : on les voit briller dans le noir.
function drawZombieEyes(z) {
  const scale = z.spec.size > 4 ? 1.6 : 1;
  const sy = z.y - camY;
  if (sy < -20 || sy > VIEW_H + 20) return;
  const blink = Math.sin(time * 1.3 + z.walk * .1 + z.x) > .96;
  if (blink) return;
  const c = z.stun > 0 ? '#ffffff' : z.type === 'runner' ? '#ff3d81' : '#ffe14d';
  px(c, z.x - 3 * scale, sy - 9 * scale, Math.ceil(2 * scale), Math.ceil(2 * scale));
  px(c, z.x + 1 * scale, sy - 9 * scale, Math.ceil(2 * scale), Math.ceil(2 * scale));
}

// L'obscurité : on peint un voile sombre, puis on y découpe les zones éclairées.
function drawDarkness() {
  const c = shadowCtx;
  c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, VIEW_W, VIEW_H);
  c.fillStyle = `rgba(9, 5, 26, ${world.cfg.dark})`;
  c.fillRect(0, 0, VIEW_W, VIEW_H);
  c.globalCompositeOperation = 'destination-out';

  const hole = (x, y, r, power = 1) => {
    const g = c.createRadialGradient(x, y, r * .25, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${power})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  };

  for (const l of world.lamps) {
    const sy = l.y - camY;
    if (sy > -60 && sy < VIEW_H + 60) hole(l.x, sy, 46, .85);
  }
  hole(90, world.goalY - 30 - camY, 80, .95);
  hole(world.cop.x, world.cop.y - camY - 4, 30, .9);
  if (!world.nova.taken) hole(world.nova.x, world.nova.y - camY, 26, .9);
  for (const w of world.waves) hole(w.x, w.y - camY, w.r + 30, 1);

  if (state !== 'menu') {
    const hy = hero.y - camY;
    hole(hero.x, hy, world.cfg.glow, .95);
    if (hero.lightOn) {
      c.save();
      c.beginPath();
      c.moveTo(hero.x, hy - 3);
      c.arc(hero.x, hy - 3, LIGHT_RANGE, hero.angle - LIGHT_ANGLE, hero.angle + LIGHT_ANGLE);
      c.closePath();
      c.clip();
      hole(hero.x, hy - 3, LIGHT_RANGE, 1);
      c.restore();
    }
  } else {
    hole(VIEW_W / 2, VIEW_H * .36, 70, .55);
  }
  ctx.drawImage(shadowCanvas, 0, 0);

  // Halos chauds par-dessus l'obscurité.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of world.lamps) {
    const sy = l.y - camY;
    if (sy < -60 || sy > VIEW_H + 60) continue;
    const g = ctx.createRadialGradient(l.x, sy, 2, l.x, sy, 44);
    g.addColorStop(0, 'rgba(255,178,56,.2)');
    g.addColorStop(1, 'rgba(255,178,56,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - 44, sy - 44, 88, 88);
  }
  if (state !== 'menu' && hero.lightOn) {
    const hy = hero.y - camY - 3;
    ctx.beginPath();
    ctx.moveTo(hero.x, hy);
    ctx.arc(hero.x, hy, LIGHT_RANGE, hero.angle - LIGHT_ANGLE, hero.angle + LIGHT_ANGLE);
    ctx.closePath();
    const g = ctx.createRadialGradient(hero.x, hy, 4, hero.x, hy, LIGHT_RANGE);
    g.addColorStop(0, 'rgba(255,225,150,.32)');
    g.addColorStop(1, 'rgba(255,225,150,0)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.restore();
}

function render() {
  ctx.save();
  if (shake > 0) ctx.translate(Math.round(rand(-shake, shake)), Math.round(rand(-shake, shake)));

  drawGround();
  drawGoal();

  const visible = (y, margin = 50) => y - camY > -margin && y - camY < VIEW_H + margin;
  world.items.filter((i) => visible(i.y)).forEach(drawItem);

  // Tri par profondeur : ce qui est plus bas à l'écran passe devant.
  const drawables = [
    ...world.obstacles.filter((o) => visible(o.y, 60)).map((o) => ({ y: o.y + o.h, draw: () => drawObstacle(o) })),
    ...world.lamps.filter((l) => visible(l.y, 40)).map((l) => ({ y: l.y, draw: () => drawLamp(l) })),
    ...world.zombies.filter((z) => visible(z.y)).map((z) => ({ y: z.y, draw: () => drawZombie(z) })),
  ];
  drawables.push({ y: world.cop.y, draw: drawCop });
  if (state !== 'menu') drawables.push({ y: hero.y, draw: drawHero });
  drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

  drawDarkness();
  world.zombies.forEach(drawZombieEyes);
  drawCopBeacon();
  drawNova();

  // Spores en suspension.
  for (const p of world.particles) {
    px('rgba(239,230,210,.4)', ((p.x % VIEW_W) + VIEW_W) % VIEW_W, p.y % VIEW_H, 1, 1);
  }
  drawEffects();
  ctx.restore();
}

/* ==================== 8. ÉCRANS ET DÉROULEMENT ==================== */

const screens = ['screen-menu', 'screen-pause', 'screen-over', 'screen-win'];
function showScreen(id) {
  screens.forEach((s) => $(s).classList.toggle('hidden', s !== id));
  const playing = id === null;
  $('hud').classList.toggle('hidden', !playing && id !== 'screen-pause');
  $('touch').classList.toggle('hidden', !playing);
}

const HEART = '<svg viewBox="0 0 7 6" aria-hidden="true" class="CL"><path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/></svg>';
function drawHearts() {
  $('hearts').innerHTML = Array.from({ length: MAX_HEARTS }, (_, i) =>
    HEART.replace('CL', i < hearts ? '' : 'lost')).join('');
  $('hearts').setAttribute('aria-label', `${Math.max(hearts, 0)} vies restantes`);
}

function drawHud() {
  $('score').textContent = score;
  const fill = $('battery-fill');
  fill.style.width = hero.battery + '%';
  fill.classList.toggle('low', hero.battery < 25);
  const startY = world.len - 40;
  $('progress-fill').style.width = clamp((startY - hero.y) / (startY - world.goalY) * 100, 0, 100) + '%';
  lightBtn.classList.toggle('on', hero.lightOn);
  lightBtn.classList.toggle('empty', hero.lockedOut);
}

function startLevel(index) {
  levelIndex = index;
  levelStartScore = score;
  buildLevel(index);
  state = 'play';
  showScreen(null);
  drawHearts();
  drawHud();
  $('level-num').textContent = `${index + 1}/${LEVELS.length}`;
  $('level-title').textContent = LEVELS[index].name;
  $('level-sub').textContent = LEVELS[index].sub;
  $('level-card').classList.remove('hidden');
  cardTimer = 2.2;
}

function newGame() {
  score = 0;
  hearts = MAX_HEARTS;
  sound.start();
  $('touch-hint').classList.remove('hidden');
  startLevel(0);
}

function saveBest() {
  if (score > Number(store.get('best', 0))) store.set('best', score);
}

function completeLevel() {
  score += 250 + hearts * 50;
  saveBest();
  if (levelIndex === LEVELS.length - 1) {
    state = 'win';
    sound.win();
    sound.stop();
    $('win-text').textContent = `Score final : ${score}`;
    showScreen('screen-win');
    return;
  }
  sound.win();
  hearts = Math.min(MAX_HEARTS, hearts + 1); // une vie offerte entre deux niveaux
  startLevel(levelIndex + 1);
}

function endGame() {
  state = 'over';
  saveBest();
  sound.lose();
  sound.stop();
  $('over-text').textContent = `Tu es tombé dans « ${LEVELS[levelIndex].name} » avec ${score} points.`;
  showScreen('screen-over');
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  sound.stop();
  input.stickId = null;
  input.x = input.y = 0;
  input.light = false;
  stickEl.classList.add('hidden');
  showScreen('screen-pause');
}

function resumeGame() {
  state = 'play';
  sound.start();
  showScreen(null);
}

function goToMenu() {
  state = 'menu';
  sound.stop();
  $('level-card').classList.add('hidden');
  $('toast').classList.add('hidden');
  showMenu();
}

function showMenu() {
  levelIndex = 0;
  buildLevel(0);
  camY = world.len - VIEW_H - 200;
  const best = Number(store.get('best', 0));
  $('best').textContent = best ? `Meilleur score : ${best}` : '';
  showScreen('screen-menu');
}

function updateSoundLabel() {
  $('btn-sound').textContent = sound.muted ? 'Activer le son' : 'Couper le son';
}

$('btn-play').addEventListener('click', newGame);
$('btn-pause').addEventListener('click', pauseGame);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-quit').addEventListener('click', goToMenu);
$('btn-over-menu').addEventListener('click', goToMenu);
$('btn-again').addEventListener('click', newGame);
$('btn-sound').addEventListener('click', () => { sound.toggle(); updateSoundLabel(); });
$('btn-retry').addEventListener('click', () => {
  score = levelStartScore;
  hearts = MAX_HEARTS;
  sound.start();
  startLevel(levelIndex);
});

// Pause automatique si on quitte l'application ou si un appel arrive.
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('resize', resize);

// La boucle principale.
let last = performance.now();
function loop(now) {
  // dt : temps écoulé depuis l'image précédente, plafonné pour éviter les sauts.
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

resize();
updateSoundLabel();
showMenu();
requestAnimationFrame(loop);

/* ==================== 9. INSTALLATION PWA ==================== */

// Enregistre le service worker, qui rend le jeu disponible hors ligne.
try {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
} catch { /* navigateur ou contexte sans service worker : le jeu reste jouable */ }

// Android et Chrome proposent une installation que l'on déclenche par un bouton.
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('btn-install').classList.remove('hidden');
});
$('btn-install').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => {});
  installPrompt = null;
  $('btn-install').classList.add('hidden');
});
window.addEventListener('appinstalled', () => $('btn-install').classList.add('hidden'));

// L'iPhone n'a pas ce bouton : on explique la marche à suivre.
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInstalled = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone;
if (isIOS && !isInstalled && window.top === window.self) $('ios-hint').classList.remove('hidden');
