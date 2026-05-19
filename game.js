// ============================================================
// DEAD CORRIDOR — v2 (rebuilt)
// Co-op zombie defense, cel-shaded, isometric.
// ============================================================

import * as THREE from 'three';

// ─── Detect mobile ───────────────────────────────────────────
const IS_MOBILE =
  matchMedia('(pointer: coarse)').matches ||
  Math.min(window.innerWidth, window.innerHeight) < 600;

// ============================================================
// CONFIG / DATA
// ============================================================
const ARENA = 32;                  // arena half-size: -16..+16
const PLAYER_R = 0.55;
const PLAYER_SPEED = 7.2;
const PLAYER_HP_MAX = 100;
const PLAYER_REGEN_DELAY = 3.5;
const PLAYER_REGEN_RATE = 7;
const BASE_FIRE_INT = 0.11;
const BASE_DMG = 18;
const BULLET_SPEED = 32;
const BULLET_LIFE = 0.85;
const SUPER_FULL = 100;

const ZTYPE = {
  walker:  { hp: 36,  spd: 2.4, dmg: 8,  atkInt: 1.0, atkR: 1.2, sz: 1.0,  score: 10, body: 0x7ab23f, dark: 0x42651e, skin: 0xcad97a, eye: 0xff3322, name: 'WALKER' },
  runner:  { hp: 22,  spd: 5.0, dmg: 6,  atkInt: 0.7, atkR: 1.1, sz: 0.85, score: 18, body: 0xd83a4f, dark: 0x6a1518, skin: 0xf08080, eye: 0xff8800, name: 'RUNNER' },
  spitter: { hp: 38,  spd: 1.8, dmg: 14, atkInt: 1.8, atkR: 12.0, sz: 1.05, score: 24, body: 0x4eb238, dark: 0x215a1a, skin: 0xa8e060, eye: 0x88ff44, name: 'SPITTER', ranged: true, projSpd: 14, projDmg: 14 },
  bomber:  { hp: 18,  spd: 3.8, dmg: 0,  atkInt: 0.1, atkR: 1.4, sz: 0.95, score: 22, body: 0xff7028, dark: 0x802a0e, skin: 0xffc070, eye: 0xff4400, name: 'BOMBER', explodes: true, expDmg: 36, expR: 3.2 },
  brute:   { hp: 220, spd: 1.4, dmg: 26, atkInt: 1.4, atkR: 1.6, sz: 1.85, score: 80, body: 0x556b3e, dark: 0x1f2818, skin: 0x8c7f4a, eye: 0xff0044, name: 'BRUTE' },
};

const PICKUP = {
  hp:      { name: 'MEDKIT',  color: 0x3ddc84, em: 0x2ecc71, icon: '❤', instant: true,  hpRestore: 40 },
  dmg:     { name: 'DAMAGE',  color: 0xb46bff, em: 0x9038ff, icon: '⚡', dur: 12, key: 'dmgT'   },
  rapid:   { name: 'RAPID',   color: 0xffeb3b, em: 0xffc107, icon: '🔥', dur: 12, key: 'rapidT' },
  shotgun: { name: 'SHOTGUN', color: 0xff7028, em: 0xff5a3a, icon: '💥', dur: 14, key: 'shotgunT' },
  shield:  { name: 'SHIELD',  color: 0x4a9eff, em: 0x6ab4ff, icon: '🛡', dur: 8,  key: 'shieldT' },
};

const WAVES = [
  { walker: 5,  runner: 0, spitter: 0, bomber: 0, brute: 0, desc: 'PREPARE FOR ASSAULT' },
  { walker: 7,  runner: 3, spitter: 0, bomber: 0, brute: 0, desc: 'RUNNERS INCOMING' },
  { walker: 6,  runner: 4, spitter: 2, bomber: 0, brute: 0, desc: 'SPITTERS DETECTED' },
  { walker: 5,  runner: 3, spitter: 2, bomber: 0, brute: 2, desc: 'BRUTE WARNING',  boss: true },
  { walker: 7,  runner: 5, spitter: 2, bomber: 2, brute: 0, desc: 'BOMBERS RUSHING' },
  { walker: 6,  runner: 7, spitter: 3, bomber: 3, brute: 0, desc: 'WATCH YOUR FLANKS' },
  { walker: 6,  runner: 5, spitter: 3, bomber: 2, brute: 3, desc: 'BRUTE PACK',     boss: true },
  { walker: 8,  runner: 8, spitter: 4, bomber: 4, brute: 0, desc: 'CHAOS UNLEASHED' },
  { walker: 10, runner: 8, spitter: 5, bomber: 4, brute: 1, desc: 'OVERRUN' },
  { walker: 8,  runner: 10,spitter: 5, bomber: 5, brute: 4, desc: 'FINAL STAND',    boss: true },
];
const SPAWN_INT = 0.42;
const REST_TIME = 5.0;
const PICKUP_DROP = 0.13;       // chance per kill
const MAX_ZOMBIES = 24;

// ============================================================
// DOM HELPERS
// ============================================================
const $ = (id) => document.getElementById(id);
const menu = $('menu');
const menuMain = $('menuMain');
const menuHost = $('menuHost');
const menuJoin = $('menuJoin');
const roomCodeEl = $('roomCode');
const hostStatus = $('hostStatus');
const joinInput = $('joinInput');
const joinStatus = $('joinStatus');
const hudEl = $('hud');
const waveBoxEl = $('waveBox');
const waveNumEl = $('waveNum');
const waveTotalEl = $('waveTotal');
const waveStatusEl = $('waveStatus');
const waveIntroEl = $('waveIntro');
const waveIntroNumEl = $('waveIntroNum');
const waveIntroDescEl = $('waveIntroDesc');
const scoreEl = $('scoreNum');
const killEl = $('killNum');
const hp1Card = $('hp1'), hp1Val = $('hp1Val'), hp1Fill = $('hp1Fill');
const hp2Card = $('hp2'), hp2Val = $('hp2Val'), hp2Fill = $('hp2Fill');
const powerupsEl = $('powerups');
const comboEl = $('combo');
const superBtnEl = $('superBtn');
const slot0El = $('slot0'), slot1El = $('slot1');
const dmgFlashEl = $('dmgFlash');
const lowHpEl = $('lowHp');

// ============================================================
// RENDERER + SCENE SETUP
// ============================================================
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({
  antialias: !IS_MOBILE,
  canvas,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
renderer.shadowMap.enabled = !IS_MOBILE;
renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0510);
scene.fog = new THREE.FogExp2(0x140820, 0.018);

// Isometric-ish camera (orthographic looking down at ~45°)
let camera;
const CAM_TARGET = new THREE.Vector3(0, 0, 0);
function setupCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const viewSize = IS_MOBILE ? 17 : 19;
  camera = new THREE.OrthographicCamera(
    -viewSize * aspect, viewSize * aspect,
    viewSize, -viewSize,
    0.1, 200,
  );
  // Position above + south for slight 3D perspective
  camera.position.set(0, 30, 22);
  camera.lookAt(0, 0, 0);
}
setupCamera();

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const viewSize = IS_MOBILE ? 17 : 19;
  camera.left = -viewSize * aspect;
  camera.right = viewSize * aspect;
  camera.top = viewSize;
  camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
resize();

// ─── Lighting (set up for cel material) ─────────────────────
scene.add(new THREE.AmbientLight(0x383040, 0.45));
scene.add(new THREE.HemisphereLight(0x564a62, 0x1a1620, 0.35));
const keyLight = new THREE.DirectionalLight(0xfff0d6, 1.35);
keyLight.position.set(-18, 36, 16);
keyLight.castShadow = !IS_MOBILE;
keyLight.shadow.mapSize.set(IS_MOBILE ? 1024 : 2048, IS_MOBILE ? 1024 : 2048);
keyLight.shadow.camera.left = -22; keyLight.shadow.camera.right = 22;
keyLight.shadow.camera.top = 22; keyLight.shadow.camera.bottom = -22;
keyLight.shadow.camera.near = 0.5; keyLight.shadow.camera.far = 80;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x6a8aff, 0.55);
rimLight.position.set(20, 22, -28); scene.add(rimLight);
const bounce = new THREE.DirectionalLight(0xff7a55, 0.22);
bounce.position.set(0, -10, 8); scene.add(bounce);

// ============================================================
// ASSET FACTORIES (procedural cel-shaded meshes)
// ============================================================
const TOON_GRADIENT = (() => {
  const data = new Uint8Array([72,72,80,255, 150,150,160,255, 220,220,230,255, 255,255,255,255]);
  const tex = new THREE.DataTexture(data, 4, 1);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();
function tmat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT, ...opts });
}
const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0x05050a, side: THREE.BackSide });
function outlined(mesh, scale = 1.05) {
  if (IS_MOBILE) return mesh;
  const o = new THREE.Mesh(mesh.geometry, OUTLINE_MAT);
  o.scale.multiplyScalar(scale);
  o.renderOrder = -1;
  mesh.add(o);
  return mesh;
}

// ─── Arena floor + bounds ────────────────────────────────────
function makeFloorTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1424'; g.fillRect(0, 0, 512, 512);
  // Hex/grid pattern
  g.strokeStyle = 'rgba(80,40,60,0.45)'; g.lineWidth = 1.2;
  const cell = 64;
  for (let x = 0; x <= 512; x += cell) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  for (let y = 0; y <= 512; y += cell) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  // Random splotches
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(${50+Math.random()*40}, 20, 30, ${Math.random() * 0.18})`;
    g.beginPath(); g.arc(Math.random()*512, Math.random()*512, Math.random()*5+1, 0, Math.PI*2); g.fill();
  }
  // Splattered blood
  for (let i = 0; i < 40; i++) {
    const x = Math.random()*512, y = Math.random()*512, r = 4 + Math.random()*16;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(80, 16, 14, 0.55)');
    grad.addColorStop(1, 'rgba(60, 8, 6, 0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const floorTex = makeFloorTexture();
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
  new THREE.MeshLambertMaterial({ map: floorTex, color: 0xb09098 }),
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = !IS_MOBILE;
scene.add(floor);
// Subtle glowing arena edge
const ringGeo = new THREE.RingGeometry(ARENA - 0.5, ARENA, 64);
const ringMat = new THREE.MeshBasicMaterial({ color: 0x4a2030, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = -Math.PI/2; ring.position.y = 0.01;
scene.add(ring);

// ─── Walls around arena ─────────────────────────────────────
function makeWalls() {
  const mat = tmat(0x261b34);
  const wallH = 1.6;
  const walls = [];
  const positions = [
    { x: 0, z: -ARENA, w: ARENA * 2, d: 0.6 },
    { x: 0, z:  ARENA, w: ARENA * 2, d: 0.6 },
    { x: -ARENA, z: 0, w: 0.6, d: ARENA * 2 },
    { x:  ARENA, z: 0, w: 0.6, d: ARENA * 2 },
  ];
  for (const p of positions) {
    const m = outlined(new THREE.Mesh(new THREE.BoxGeometry(p.w, wallH, p.d), mat), 1.02);
    m.position.set(p.x, wallH / 2, p.z);
    m.castShadow = m.receiveShadow = !IS_MOBILE;
    scene.add(m);
    walls.push(m);
  }
  // Corner pillars
  const pillarMat = tmat(0x331f3e);
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
    const p = outlined(new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.5, 1.6), pillarMat), 1.04);
    p.position.set(cx * (ARENA - 0.8), 1.75, cz * (ARENA - 0.8));
    p.castShadow = !IS_MOBILE;
    scene.add(p);
    // Glowing top
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.2, 1.8),
      new THREE.MeshBasicMaterial({ color: 0xff5a3a })
    );
    cap.position.set(cx * (ARENA - 0.8), 3.55, cz * (ARENA - 0.8));
    scene.add(cap);
  }
}
makeWalls();

// ─── PLAYER MESH ─────────────────────────────────────────────
function createPlayerMesh(idx) {
  const isP1 = idx === 0;
  const accent     = isP1 ? 0x3478ff : 0x36d97e;
  const accentDeep = isP1 ? 0x1f4cc8 : 0x1c9054;
  const accentGlow = isP1 ? 0x7ec0ff : 0x9cf2c8;
  const g = new THREE.Group();

  const vest   = tmat(accent,     { emissive: accentGlow, emissiveIntensity: 0.13 });
  const aDark  = tmat(accentDeep);
  const pants  = tmat(0x2a2f3d);
  const skin   = tmat(0xffd5a0);
  const helm   = tmat(0x16181f);
  const gun    = tmat(0x131520);
  const gunMet = tmat(0x3c3e4a);
  const boot   = tmat(0x0d0d14);

  // Boots
  const bootGeo = new THREE.BoxGeometry(0.32, 0.22, 0.5);
  const bL = outlined(new THREE.Mesh(bootGeo, boot), 1.07);
  bL.position.set(-0.2, 0.11, 0.06); bL.castShadow = !IS_MOBILE; g.add(bL);
  const bR = outlined(new THREE.Mesh(bootGeo, boot), 1.07);
  bR.position.set( 0.2, 0.11, 0.06); bR.castShadow = !IS_MOBILE; g.add(bR);
  // Legs (stubby)
  const legGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.45, 10);
  const lL = outlined(new THREE.Mesh(legGeo, pants), 1.07);
  lL.position.set(-0.2, 0.42, 0); lL.castShadow = !IS_MOBILE; g.add(lL);
  const lR = outlined(new THREE.Mesh(legGeo, pants), 1.07);
  lR.position.set( 0.2, 0.42, 0); lR.castShadow = !IS_MOBILE; g.add(lR);
  // Torso
  const tor = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.6, 0.48), vest), 1.05);
  tor.position.set(0, 0.92, 0); tor.castShadow = !IS_MOBILE; g.add(tor);
  // Chest plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.06), aDark);
  plate.position.set(0, 0.95, 0.24); g.add(plate);
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.07, 18),
    new THREE.MeshBasicMaterial({ color: accentGlow }));
  chest.position.set(0, 1.05, 0.275); g.add(chest);
  // Belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.5), tmat(0x111319));
  belt.position.set(0, 0.66, 0); g.add(belt); outlined(belt, 1.04);
  // Backpack
  const backpack = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.24), tmat(0x222a36)), 1.05);
  backpack.position.set(0, 1.04, 0.34); g.add(backpack);
  const bpStrap1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.04), tmat(0x111319));
  bpStrap1.position.set(-0.2, 1.0, 0.24); g.add(bpStrap1);
  const bpStrap2 = bpStrap1.clone(); bpStrap2.position.x = 0.2; g.add(bpStrap2);
  // Shoulder pauldrons
  const shGeo = new THREE.SphereGeometry(0.2, 12, 10);
  const shL = outlined(new THREE.Mesh(shGeo, vest), 1.06);
  shL.position.set(-0.48, 1.12, 0); g.add(shL);
  const shR = outlined(new THREE.Mesh(shGeo, vest), 1.06);
  shR.position.set( 0.48, 1.12, 0); g.add(shR);
  // Forearms
  const armGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.42, 10);
  const aL = outlined(new THREE.Mesh(armGeo, vest), 1.06);
  aL.position.set(-0.46, 0.84, -0.12); aL.rotation.x = -0.7; g.add(aL);
  const aR = outlined(new THREE.Mesh(armGeo, vest), 1.06);
  aR.position.set( 0.46, 0.84, -0.12); aR.rotation.x = -0.7; g.add(aR);
  // Gloves
  const glove = new THREE.SphereGeometry(0.13, 12, 10);
  const gL = outlined(new THREE.Mesh(glove, gun), 1.06);
  gL.position.set(-0.38, 0.76, -0.58); g.add(gL);
  const gR = outlined(new THREE.Mesh(glove, gun), 1.06);
  gR.position.set( 0.38, 0.76, -0.58); g.add(gR);
  // Head
  const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), skin), 1.05);
  head.position.set(0, 1.5, 0); head.castShadow = !IS_MOBILE; g.add(head);
  // Helmet
  const helmet = outlined(new THREE.Mesh(
    new THREE.SphereGeometry(0.41, 18, 12, 0, Math.PI*2, 0, Math.PI/1.85), helm), 1.04);
  helmet.position.set(0, 1.55, 0); helmet.castShadow = !IS_MOBILE; g.add(helmet);
  // Helmet rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 28), aDark);
  rim.position.set(0, 1.45, 0); rim.rotation.x = Math.PI/2; g.add(rim);
  // Visor (signature glowing strip)
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.37, 18, 8, 0, Math.PI*2, Math.PI/2 - 0.18, 0.28),
    new THREE.MeshBasicMaterial({ color: accentGlow, transparent: true, opacity: 0.95 }),
  );
  visor.position.set(0, 1.5, 0); g.add(visor);
  // Team disc on helmet top
  const team = new THREE.Mesh(new THREE.CircleGeometry(0.14, 18),
    new THREE.MeshBasicMaterial({ color: accentGlow }));
  team.position.set(0, 1.86, 0); team.rotation.x = -Math.PI/2; g.add(team);

  // RIFLE
  const rifle = new THREE.Group();
  const rb = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 1.0), gun), 1.04);
  rifle.add(rb);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.58, 10), gunMet);
  barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.03, -0.7); rifle.add(barrel);
  const muzzle = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12), gunMet), 1.05);
  muzzle.rotation.x = Math.PI/2; muzzle.position.set(0, 0.03, -1.05); rifle.add(muzzle);
  const stock = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.36), gunMet), 1.04);
  stock.position.set(0, 0, 0.6); rifle.add(stock);
  const mag = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.22), aDark), 1.05);
  mag.position.set(0, -0.24, 0.05); rifle.add(mag);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.12), aDark);
  grip.position.set(0, -0.2, -0.05); rifle.add(grip);
  const scope = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 10), gunMet), 1.05);
  scope.rotation.x = Math.PI/2; scope.position.set(0, 0.2, -0.1); rifle.add(scope);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), aDark);
  stripe.position.set(0, 0.15, -0.1); rifle.add(stripe);
  rifle.position.set(0.08, 0.88, -0.18);
  g.add(rifle);

  // Muzzle flash
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe5a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.set(0.08, 0.91, -1.32); g.add(flash);
  const flashCore = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flashCore.position.set(0.08, 0.91, -1.28); g.add(flashCore);

  // Powerup aura
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.position.y = 0.85; g.add(aura);

  // Shield bubble (when shield active)
  const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shieldBubble.position.y = 0.9; g.add(shieldBubble);

  return { g, rifle, flash, flashCore, legL: lL, legR: lR, aura, shieldBubble, head, armL: aL, armR: aR };
}

// ─── ZOMBIE MESH ─────────────────────────────────────────────
function createZombieMesh(type) {
  const spec = ZTYPE[type];
  const s = spec.sz;
  const g = new THREE.Group();
  const body = tmat(spec.body, type === 'bomber' ? { emissive: 0x441000, emissiveIntensity: 0.35 } : (type === 'brute' ? { emissive: 0x220000, emissiveIntensity: 0.2 } : {}));
  const dark = tmat(spec.dark);
  const skin = tmat(spec.skin);
  const eyeMat = new THREE.MeshBasicMaterial({ color: spec.eye });

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.17*s, 0.15*s, 0.45*s, 9);
  const lL = outlined(new THREE.Mesh(legGeo, dark), 1.07);
  lL.position.set(-0.17*s, 0.32*s, 0); lL.castShadow = !IS_MOBILE; g.add(lL);
  const lR = outlined(new THREE.Mesh(legGeo, dark), 1.07);
  lR.position.set( 0.17*s, 0.32*s, 0); lR.castShadow = !IS_MOBILE; g.add(lR);

  // Torso (hunched)
  const tor = outlined(new THREE.Mesh(new THREE.CapsuleGeometry(0.36*s, 0.42*s, 4, 10), body), 1.05);
  tor.position.set(0, 0.85*s, -0.08*s); tor.rotation.x = 0.22; tor.castShadow = !IS_MOBILE; g.add(tor);
  // Tattered stripes
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.4*s, 0.04*s, 0.04*s), dark);
    st.position.set(0, (0.75 + i*0.1)*s, 0.28*s); g.add(st);
  }
  // Wound
  const wound = new THREE.Mesh(new THREE.CircleGeometry(0.18*s, 14),
    tmat(0x6a0a0a, { emissive: 0x4a0808, emissiveIntensity: 0.5 }));
  wound.position.set(0.2*s, 0.92*s, 0.3*s); wound.rotation.y = Math.PI/2; g.add(wound);

  // Arms (raised forward)
  const armGeo = new THREE.CapsuleGeometry(0.13*s, 0.48*s, 4, 8);
  const aL = outlined(new THREE.Mesh(armGeo, body), 1.06);
  aL.position.set(-0.42*s, 0.96*s, -0.42*s); aL.rotation.x = -1.0; aL.rotation.z = 0.22; aL.castShadow = !IS_MOBILE; g.add(aL);
  const aR = outlined(new THREE.Mesh(armGeo, body), 1.06);
  aR.position.set( 0.42*s, 0.96*s, -0.42*s); aR.rotation.x = -1.0; aR.rotation.z = -0.22; aR.castShadow = !IS_MOBILE; g.add(aR);
  // Hands + claws
  const handGeo = new THREE.BoxGeometry(0.2*s, 0.18*s, 0.22*s);
  const hL = outlined(new THREE.Mesh(handGeo, skin), 1.06);
  hL.position.set(-0.5*s, 0.78*s, -0.92*s); g.add(hL);
  const hR = outlined(new THREE.Mesh(handGeo, skin), 1.06);
  hR.position.set( 0.5*s, 0.78*s, -0.92*s); g.add(hR);
  const clawMat = new THREE.MeshBasicMaterial({ color: 0xede5c0 });
  for (const hx of [-0.5, 0.5]) {
    for (let c = 0; c < 3; c++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.028*s, 0.13*s, 6), clawMat);
      claw.position.set((hx + (c-1)*0.06) * s, 0.74*s, -1.08*s);
      claw.rotation.x = Math.PI; g.add(claw);
    }
  }
  // Neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13*s, 0.16*s, 0.16*s, 8), skin);
  neck.position.set(0, 1.2*s, -0.04*s); neck.rotation.x = 0.3; g.add(neck);
  const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.32*s, 18, 14), skin), 1.05);
  head.position.set(0, 1.42*s, -0.18*s); head.rotation.x = 0.3; head.castShadow = !IS_MOBILE; g.add(head);
  // Jaw + teeth
  const jaw = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.26*s, 0.12*s, 0.22*s), tmat(0x2a1010)), 1.06);
  jaw.position.set(0, 1.3*s, -0.38*s); g.add(jaw);
  for (let i = -1; i <= 1; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03*s, 0.09*s, 5), clawMat);
    tooth.position.set(i*0.09*s, 1.36*s, -0.49*s); tooth.rotation.x = Math.PI; g.add(tooth);
  }
  // Eyes
  for (const dx of [-0.11, 0.11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06*s, 10, 8), eyeMat);
    eye.position.set(dx*s, 1.48*s, -0.4*s); g.add(eye);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.13*s, 10, 8),
      new THREE.MeshBasicMaterial({ color: spec.eye, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(dx*s, 1.48*s, -0.4*s); g.add(halo);
  }

  let bomb = null;
  if (type === 'bomber') {
    bomb = new THREE.Mesh(new THREE.SphereGeometry(0.28*s, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
    bomb.position.set(0, 0.92*s, 0.22*s); g.add(bomb);
    if (!IS_MOBILE) {
      const inner = new THREE.PointLight(0xff4400, 1.0, 4, 2);
      inner.position.set(0, 0.92*s, 0.22*s); g.add(inner);
      bomb.userData.light = inner;
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02*s, 0.02*s, 0.18*s, 6), dark);
    ant.position.set(0, 1.0*s, 0.4*s); g.add(ant);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04*s, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff8800 }));
    ball.position.set(0, 1.1*s, 0.42*s); g.add(ball);
  }
  if (type === 'spitter') {
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.22*s, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0x88ff44, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending }));
    sac.position.set(0, 1.2*s, -0.32*s); g.add(sac);
    bomb = sac;
  }
  if (type === 'brute') {
    for (let i = 0; i < 5; i++) {
      const spike = outlined(new THREE.Mesh(new THREE.ConeGeometry(0.1*s, 0.32*s, 6), dark), 1.06);
      spike.position.set((i-2)*0.13*s, 1.05*s, 0.28*s);
      spike.rotation.x = Math.PI - 0.4; g.add(spike);
    }
    for (const sx of [-0.45, 0.45]) {
      const pad = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.22*s, 12, 10), dark), 1.05);
      pad.position.set(sx*s, 1.15*s, -0.04*s); g.add(pad);
    }
  }
  if (type === 'runner') {
    for (const sx of [-0.28, 0.28]) {
      const sinew = new THREE.Mesh(new THREE.BoxGeometry(0.03*s, 0.4*s, 0.04*s),
        new THREE.MeshBasicMaterial({ color: 0xff5060 }));
      sinew.position.set(sx*s, 0.88*s, 0.3*s); g.add(sinew);
    }
  }
  return { g, legL: lL, legR: lR, armL: aL, armR: aR, head, bomb };
}

// ─── PICKUP MESH ─────────────────────────────────────────────
function createPickupMesh(type) {
  const spec = PICKUP[type];
  const g = new THREE.Group();
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42, 0),
    tmat(spec.color, { emissive: spec.em, emissiveIntensity: 0.6 }),
  );
  crystal.position.y = 0.7;
  crystal.castShadow = !IS_MOBILE;
  outlined(crystal, 1.05);
  g.add(crystal);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 10),
    new THREE.MeshBasicMaterial({ color: spec.em, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.y = 0.7; g.add(halo);
  const ringG = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24),
    new THREE.MeshBasicMaterial({ color: spec.em, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ringG.rotation.x = -Math.PI/2; ringG.position.y = 0.03; g.add(ringG);
  return { g, crystal, halo, ring: ringG };
}

// ─── BULLET MESH ─────────────────────────────────────────────
function createBulletMesh(color = 0xffe27a) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color }));
  g.add(core);
  const trail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(trail);
  return { g, core, trail };
}

// ============================================================
// GAME STATE
// ============================================================
const G = {
  phase: 'menu',
  t: 0,
  wave: 0,
  waveT: 0,
  toSpawn: 0,
  spawnAccum: 0,
  toSpawnList: [],
  score: 0,
  kills: 0,
  players: [],
  zombies: [],
  bullets: [],
  pickups: [],
  particles: [],
  myIdx: 0,
  isCoop: false,
  introShownFor: -1,
};

function makePlayer(idx) {
  const mesh = createPlayerMesh(idx);
  scene.add(mesh.g);
  return {
    idx,
    mesh,
    x: idx === 0 ? -3 : 3, z: 0, a: 0,
    vx: 0, vz: 0,
    hp: PLAYER_HP_MAX, alive: true,
    lastHitT: 0, hitT: 0,
    fireT: 0,
    walkPhase: Math.random() * 10,
    combo: 0, comboT: 0,
    score: 0, kills: 0,
    dmgT: 0, rapidT: 0, shotgunT: 0, shieldT: 0,
    super: 0,
    inv: [null, null],
    inv0Dirty: true, inv1Dirty: true,
    aim: 0, // aim direction angle
  };
}

// ============================================================
// INPUT (joysticks + super + items)
// ============================================================
const joys = { move: null, aim: null };
const JOY_MAX = 56;
function setupJoystick(elId, key) {
  const root = $(elId);
  const knob = root.querySelector('.joyKnob');
  const base = root.querySelector('.joyBase');
  let pointerId = null;
  let cx = 0, cy = 0;

  function start(ev) {
    const t = ev.touches ? ev.touches[0] : ev;
    if (ev.touches && joys[key]?.pid != null) return; // already tracking
    const rect = base.getBoundingClientRect();
    cx = rect.left + rect.width / 2;
    cy = rect.top + rect.height / 2;
    pointerId = ev.pointerId ?? (ev.touches ? ev.changedTouches[0].identifier : 'mouse');
    joys[key] = { pid: pointerId, dx: 0, dy: 0 };
    move(ev);
    ev.preventDefault();
  }
  function move(ev) {
    if (joys[key] == null) return;
    let cl;
    if (ev.touches) {
      for (const t of ev.touches) {
        if (t.identifier === joys[key].pid) { cl = t; break; }
      }
      if (!cl) return;
    } else {
      cl = ev;
    }
    const dx = cl.clientX - cx;
    const dy = cl.clientY - cy;
    const len = Math.hypot(dx, dy);
    let kx = dx, ky = dy;
    if (len > JOY_MAX) { kx = dx / len * JOY_MAX; ky = dy / len * JOY_MAX; }
    joys[key].dx = kx; joys[key].dy = ky;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    ev.preventDefault();
  }
  function end(ev) {
    if (joys[key] == null) return;
    if (ev.touches) {
      // Check if our pointer still in touches
      let still = false;
      for (const t of ev.touches) if (t.identifier === joys[key].pid) { still = true; break; }
      if (still) return;
    }
    joys[key] = null;
    knob.style.transform = 'translate(0, 0)';
  }
  // Touch
  root.addEventListener('touchstart', start, { passive: false });
  document.addEventListener('touchmove', move, { passive: false });
  document.addEventListener('touchend', end, { passive: false });
  document.addEventListener('touchcancel', end, { passive: false });
  // Mouse (for desktop testing)
  root.addEventListener('mousedown', (e) => { start(e); });
  document.addEventListener('mousemove', (e) => { if (joys[key]) move(e); });
  document.addEventListener('mouseup', (e) => { joys[key] = null; knob.style.transform = 'translate(0,0)'; });
}
setupJoystick('joyMove', 'move');
setupJoystick('joyAim', 'aim');

function joyVec(j) {
  if (!j) return { x: 0, y: 0, len: 0 };
  const len = Math.hypot(j.dx, j.dy);
  return {
    x: j.dx / JOY_MAX,
    y: j.dy / JOY_MAX,
    len: Math.min(1, len / JOY_MAX),
  };
}

// Desktop keyboard fallback
const keys = {};
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener('keyup',   (e) => { keys[e.key.toLowerCase()] = false; });

// Super button
superBtnEl.addEventListener('click', () => useSuper());
// Item slot taps
slot0El.addEventListener('click', () => useItem(0));
slot1El.addEventListener('click', () => useItem(1));

// ============================================================
// SIMULATION
// ============================================================
function spawnZombie(type) {
  const spec = ZTYPE[type];
  if (G.zombies.filter(z => z.alive).length >= MAX_ZOMBIES) return;
  // Spawn from arena edge
  const side = Math.floor(Math.random() * 4);
  let x, z;
  const margin = ARENA - 1.5;
  if (side === 0)      { x = -margin + Math.random() * 0.5; z = (Math.random() - 0.5) * margin * 2; }
  else if (side === 1) { x =  margin - Math.random() * 0.5; z = (Math.random() - 0.5) * margin * 2; }
  else if (side === 2) { x = (Math.random() - 0.5) * margin * 2; z = -margin + Math.random() * 0.5; }
  else                 { x = (Math.random() - 0.5) * margin * 2; z =  margin - Math.random() * 0.5; }
  const meshInfo = createZombieMesh(type);
  scene.add(meshInfo.g);
  G.zombies.push({
    id: Math.random().toString(36).slice(2, 8),
    type, x, z, a: 0, vx: 0, vz: 0,
    hp: spec.hp, hpMax: spec.hp,
    alive: true, deathT: 0,
    walkPhase: Math.random() * 10,
    attackCD: 0, lungeT: 0, hitT: 0,
    spitCD: 1 + Math.random(),
    mesh: meshInfo,
  });
}

function nearestPlayer(x, z) {
  let best = null, bd = Infinity;
  for (const p of G.players) {
    if (!p.alive) continue;
    const dx = p.x - x, dz = p.z - z;
    const d = dx*dx + dz*dz;
    if (d < bd) { bd = d; best = p; }
  }
  return { p: best, d: Math.sqrt(bd) };
}

function updatePlayers(dt) {
  // Local input
  const me = G.players[G.myIdx];
  if (!me) return;
  let mvX = 0, mvY = 0;
  const mv = joyVec(joys.move);
  if (mv.len > 0.05) { mvX = mv.x; mvY = mv.y; }
  else {
    if (keys['w'] || keys['arrowup'])    mvY -= 1;
    if (keys['s'] || keys['arrowdown'])  mvY += 1;
    if (keys['a'] || keys['arrowleft'])  mvX -= 1;
    if (keys['d'] || keys['arrowright']) mvX += 1;
    const l = Math.hypot(mvX, mvY);
    if (l > 0) { mvX /= l; mvY /= l; }
  }
  let aimX = 0, aimY = 0;
  const av = joyVec(joys.aim);
  if (av.len > 0.18) { aimX = av.x; aimY = av.y; }
  me.input = { mvX, mvY, aimX, aimY, aimLen: av.len };

  for (const p of G.players) {
    if (!p.alive) continue;
    const inp = p.input || { mvX: 0, mvY: 0, aimX: 0, aimY: 0, aimLen: 0 };
    p.vx = inp.mvX * PLAYER_SPEED;
    p.vz = inp.mvY * PLAYER_SPEED;
    p.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, p.x + p.vx * dt));
    p.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, p.z + p.vz * dt));
    p.walkPhase += dt * Math.hypot(inp.mvX, inp.mvY) * 9;

    // Aim from aim joystick, fallback to movement direction
    if (inp.aimLen > 0.18) {
      p.a = Math.atan2(inp.aimX, -inp.aimY);
    } else {
      const mvl = Math.hypot(inp.mvX, inp.mvY);
      if (mvl > 0.1) p.a = Math.atan2(inp.mvX, -inp.mvY);
    }

    // Powerup timers
    p.dmgT = Math.max(0, p.dmgT - dt);
    p.rapidT = Math.max(0, p.rapidT - dt);
    p.shotgunT = Math.max(0, p.shotgunT - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);

    // Combo decay
    if (p.combo > 0) {
      p.comboT -= dt;
      if (p.comboT <= 0) { p.combo = 0; }
    }
    // Regen
    p.fireT = Math.max(0, p.fireT - dt);
    p.hitT = Math.max(0, p.hitT - dt);
    if (G.t - p.lastHitT > PLAYER_REGEN_DELAY && p.hp < PLAYER_HP_MAX) {
      p.hp = Math.min(PLAYER_HP_MAX, p.hp + PLAYER_REGEN_RATE * dt);
    }

    // Fire bullets while aim joystick is engaged
    if (inp.aimLen > 0.55 && p.fireT <= 0) {
      const fireInt = BASE_FIRE_INT * (p.rapidT > 0 ? 0.45 : 1.0) * (p.shotgunT > 0 ? 1.6 : 1.0);
      p.fireT = fireInt;
      firePlayerWeapon(p);
    }
  }

  // Pick up nearby pickups
  for (const p of G.players) {
    if (!p.alive) continue;
    for (let i = G.pickups.length - 1; i >= 0; i--) {
      const pk = G.pickups[i];
      const dx = p.x - pk.x, dz = p.z - pk.z;
      if (dx*dx + dz*dz < 1.3*1.3) {
        collectPickup(p, pk);
        scene.remove(pk.mesh.g);
        G.pickups.splice(i, 1);
        break;
      }
    }
  }
}

function firePlayerWeapon(p) {
  const dx = Math.sin(p.a), dz = -Math.cos(p.a);
  const ox = p.x + dx * 0.6, oz = p.z + dz * 0.6;
  const dmgMult = (p.dmgT > 0 ? 2 : 1);
  if (p.shotgunT > 0) {
    // 5-pellet spread
    for (let i = -2; i <= 2; i++) {
      const angle = p.a + i * 0.13;
      const sx = Math.sin(angle), sz = -Math.cos(angle);
      spawnBullet(ox, oz, sx, sz, BASE_DMG * 0.72 * dmgMult, p.idx, p.dmgT > 0, 0xff7028);
    }
  } else {
    spawnBullet(ox, oz, dx, dz, BASE_DMG * dmgMult, p.idx, p.dmgT > 0);
  }
  p.mesh.muzzleFlashT = 0.08;
  p.super = Math.min(SUPER_FULL, p.super + 0.6);
  superDirty = true;
}

function spawnBullet(x, z, dx, dz, dmg, ownerIdx, crit, color = 0xffe27a) {
  const m = createBulletMesh(color);
  m.g.position.set(x, 1.0, z);
  scene.add(m.g);
  G.bullets.push({
    x, y: 1.0, z,
    vx: dx * BULLET_SPEED, vy: 0, vz: dz * BULLET_SPEED,
    life: BULLET_LIFE,
    dmg, ownerIdx, crit,
    mesh: m,
  });
}

function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.mesh.g.position.set(b.x, b.y, b.z);
    // Out of arena or expired
    if (b.life <= 0 || Math.abs(b.x) > ARENA + 0.5 || Math.abs(b.z) > ARENA + 0.5) {
      scene.remove(b.mesh.g);
      G.bullets.splice(i, 1);
      continue;
    }
    // Check zombies
    let hit = false;
    for (const z of G.zombies) {
      if (!z.alive) continue;
      const r = 0.5 * ZTYPE[z.type].sz;
      const ddx = b.x - z.x, ddz = b.z - z.z;
      if (ddx*ddx + ddz*ddz < r*r) {
        z.hp -= b.dmg;
        z.hitT = 0.14;
        spawnHitParticles(b.x, 1.1, b.z, 0xff4422, 5);
        spawnDmgNumber(b.x, 1.4, b.z, Math.round(b.dmg), b.crit ? 'crit' : '');
        if (z.hp <= 0 && z.alive) {
          z.alive = false; z.deathT = 0.001;
          killZombie(z, b.ownerIdx);
        }
        scene.remove(b.mesh.g);
        G.bullets.splice(i, 1);
        hit = true;
        break;
      }
    }
  }
}

function killZombie(z, ownerIdx) {
  const p = G.players[ownerIdx];
  if (p) {
    p.combo = Math.min(8, p.combo + 1);
    p.comboT = 3.2;
    p.kills++;
    const base = ZTYPE[z.type].score;
    const earned = Math.floor(base * comboMultiplier(p.combo));
    p.score += earned;
    G.score += earned;
    G.kills++;
    p.super = Math.min(SUPER_FULL, p.super + (z.type === 'brute' ? 28 : z.type === 'bomber' ? 6 : 14));
    superDirty = true;
    spawnDmgNumber(z.x, 2.0, z.z, `+${earned}` + (p.combo > 1 ? ` x${p.combo}` : ''), 'score');
  }
  // Drop pickup chance
  if (Math.random() < PICKUP_DROP * (z.type === 'brute' ? 4 : 1)) {
    const types = ['hp', 'dmg', 'rapid', 'shotgun', 'shield'];
    const pickupT = types[Math.floor(Math.random() * types.length)];
    spawnPickup(z.x, z.z, pickupT);
  }
  // Bomber explodes
  if (z.type === 'bomber') {
    setTimeout(() => bombExplode(z), 60);
  }
  spawnHitParticles(z.x, 1.0, z.z, 0xa01010, 12);
}
function comboMultiplier(c) {
  if (c <= 1) return 1;
  if (c <= 3) return 1.5;
  if (c <= 5) return 2;
  return 2.5;
}

function bombExplode(bomb) {
  const spec = ZTYPE.bomber;
  // AOE damage to players
  for (const p of G.players) {
    if (!p.alive) continue;
    const dx = p.x - bomb.x, dz = p.z - bomb.z;
    const d = Math.hypot(dx, dz);
    if (d < spec.expR) {
      const f = 1 - d / spec.expR;
      damagePlayer(p, spec.expDmg * f, true);
    }
  }
  // AOE damage to other zombies
  for (const z of G.zombies) {
    if (z === bomb || !z.alive) continue;
    const dx = z.x - bomb.x, dz = z.z - bomb.z;
    const d = Math.hypot(dx, dz);
    if (d < spec.expR) {
      const f = 1 - d / spec.expR;
      z.hp -= 32 * f; z.hitT = 0.12;
      if (z.hp <= 0 && z.alive) {
        z.alive = false; z.deathT = 0.001;
      }
    }
  }
  // Visual
  spawnExplosion(bomb.x, 0.5, bomb.z, spec.expR);
  shake(0.7);
}

function damagePlayer(p, dmg, isCrit = false) {
  if (!p.alive || p.shieldT > 0) {
    if (p.shieldT > 0) spawnDmgNumber(p.x, 2.0, p.z, 'BLOCK', 'crit');
    return;
  }
  p.hp -= dmg;
  p.hitT = 0.18;
  p.lastHitT = G.t;
  p.super = Math.min(SUPER_FULL, p.super + 4);
  superDirty = true;
  if (p.idx === G.myIdx) {
    dmgFlashEl.classList.add('flash');
    setTimeout(() => dmgFlashEl.classList.remove('flash'), 60);
    shake(0.4);
    spawnDmgNumber(p.x, 1.9, p.z, Math.round(dmg), 'self');
  }
  if (p.hp <= 0) { p.hp = 0; p.alive = false; }
}

function spawnPickup(x, z, type) {
  const m = createPickupMesh(type);
  m.g.position.set(x, 0, z);
  scene.add(m.g);
  G.pickups.push({ x, z, type, t: 0, mesh: m });
}

function collectPickup(p, pk) {
  const spec = PICKUP[pk.type];
  if (spec.instant) {
    p.hp = Math.min(PLAYER_HP_MAX, p.hp + spec.hpRestore);
    spawnDmgNumber(p.x, 2.0, p.z, '+HP', 'score');
  } else {
    // Try to fit in inventory
    if (p.inv[0] == null)      { p.inv[0] = pk.type; p.inv0Dirty = true; }
    else if (p.inv[1] == null) { p.inv[1] = pk.type; p.inv1Dirty = true; }
    else {
      // Inventory full — just activate immediately
      const key = spec.key;
      p[key] = Math.max(p[key] || 0, spec.dur);
    }
  }
}

function useItem(slot) {
  const p = G.players[G.myIdx];
  if (!p) return;
  const t = p.inv[slot];
  if (!t) return;
  const spec = PICKUP[t];
  if (spec.instant) {
    p.hp = Math.min(PLAYER_HP_MAX, p.hp + spec.hpRestore);
  } else {
    p[spec.key] = Math.max(p[spec.key] || 0, spec.dur);
  }
  p.inv[slot] = null;
  if (slot === 0) p.inv0Dirty = true; else p.inv1Dirty = true;
}

let superDirty = true;
function useSuper() {
  const p = G.players[G.myIdx];
  if (!p || !p.alive || p.super < SUPER_FULL) return;
  p.super = 0;
  superDirty = true;
  triggerSuper(p);
}

function triggerSuper(p) {
  // AOE huge blast around player
  const R = 6.5;
  for (const z of G.zombies) {
    if (!z.alive) continue;
    const dx = z.x - p.x, dz = z.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < R) {
      const f = 1 - d / R;
      const dmg = 150 * f;
      z.hp -= dmg;
      z.hitT = 0.22;
      // Knockback
      z.x += dx / Math.max(d, 0.1) * 0.5;
      z.z += dz / Math.max(d, 0.1) * 0.5;
      spawnDmgNumber(z.x, 1.8, z.z, Math.round(dmg), 'heavy');
      if (z.hp <= 0 && z.alive) {
        z.alive = false; z.deathT = 0.001;
        killZombie(z, p.idx);
      }
    }
  }
  spawnExplosion(p.x, 0.6, p.z, R);
  shake(1.2);
}

// ─── ZOMBIE AI ──────────────────────────────────────────────
function updateZombies(dt) {
  for (let i = G.zombies.length - 1; i >= 0; i--) {
    const z = G.zombies[i];
    z.hitT = Math.max(0, z.hitT - dt);
    z.lungeT = Math.max(0, z.lungeT - dt * 4);
    if (!z.alive) {
      z.deathT += dt;
      if (z.deathT > 1.5) {
        scene.remove(z.mesh.g);
        G.zombies.splice(i, 1);
      }
      continue;
    }
    const spec = ZTYPE[z.type];
    const { p: target, d } = nearestPlayer(z.x, z.z);
    if (!target) continue;
    const dxT = target.x - z.x, dzT = target.z - z.z;
    z.a = Math.atan2(dxT, -dzT);

    if (spec.ranged) {
      // Spitter: ranged attack
      if (d > spec.atkR * 0.6) {
        // Approach within range
        const nx = dxT / Math.max(d, 0.001), nz = dzT / Math.max(d, 0.001);
        z.x += nx * spec.spd * dt;
        z.z += nz * spec.spd * dt;
        z.walkPhase += dt * spec.spd * 2;
      }
      z.spitCD -= dt;
      if (z.spitCD <= 0 && d < spec.atkR) {
        z.spitCD = spec.atkInt + Math.random() * 0.5;
        // Spit projectile (spitter ball — separate from bullets)
        const sx = dxT / Math.max(d, 0.001), sz = dzT / Math.max(d, 0.001);
        const m = createBulletMesh(0xc0ff60);
        m.g.position.set(z.x, 1.3, z.z);
        scene.add(m.g);
        G.bullets.push({
          x: z.x, y: 1.3, z: z.z,
          vx: sx * spec.projSpd, vy: 0, vz: sz * spec.projSpd,
          life: 2.0,
          dmg: spec.projDmg,
          ownerIdx: -1, // hostile
          crit: false,
          mesh: m,
          hostile: true,
        });
        z.lungeT = 0.8;
      }
    } else if (spec.explodes) {
      // Bomber: chase and explode on contact
      if (d > spec.atkR) {
        const nx = dxT / Math.max(d, 0.001), nz = dzT / Math.max(d, 0.001);
        z.x += nx * spec.spd * dt;
        z.z += nz * spec.spd * dt;
        z.walkPhase += dt * spec.spd * 2;
      } else {
        // Trigger explosion
        z.alive = false; z.deathT = 0.001;
        bombExplode(z);
      }
    } else {
      // Melee zombie
      if (d > spec.atkR) {
        const nx = dxT / Math.max(d, 0.001), nz = dzT / Math.max(d, 0.001);
        z.x += nx * spec.spd * dt;
        z.z += nz * spec.spd * dt;
        z.walkPhase += dt * spec.spd * 2;
      } else {
        z.attackCD -= dt;
        if (z.attackCD <= 0) {
          z.attackCD = spec.atkInt;
          z.lungeT = 1.0;
          damagePlayer(target, spec.dmg);
        }
      }
    }
    // Stay inside arena
    z.x = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, z.x));
    z.z = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, z.z));

    // Update mesh: position, walk, swing, lunge, squash
    const g = z.mesh.g;
    let by = Math.sin(z.walkPhase) * 0.04 * spec.sz;
    const lOff = z.lungeT * 0.45;
    g.position.set(z.x + Math.sin(z.a) * lOff, by, z.z + (-Math.cos(z.a)) * lOff);
    g.rotation.y = z.a;
    const ls = Math.sin(z.walkPhase) * 0.3;
    z.mesh.legL.rotation.x = ls;
    z.mesh.legR.rotation.x = -ls;
    const asw = Math.sin(z.walkPhase * 0.5) * 0.15;
    z.mesh.armL.rotation.z = 0.22 + asw;
    z.mesh.armR.rotation.z = -0.22 - asw;
    if (z.hitT > 0) {
      const hk = z.hitT / 0.14;
      g.scale.set(1 + hk * 0.22, 1 - hk * 0.14, 1 + hk * 0.06);
    } else if (g.scale.x !== 1) g.scale.set(1, 1, 1);
    // Type-specific
    if (z.type === 'bomber' && z.mesh.bomb) {
      const pulse = 0.7 + Math.sin(G.t * 10) * 0.3;
      z.mesh.bomb.material.opacity = 0.65 * pulse;
      z.mesh.bomb.scale.setScalar(0.8 + pulse * 0.5);
    }
    if (z.type === 'spitter' && z.mesh.bomb) {
      z.mesh.bomb.scale.setScalar(0.7 + z.lungeT * 0.6);
    }
  }

  // Handle hostile projectiles (separate from bullets — added to G.bullets with hostile flag)
  // Already in updateBullets need to check hostile flag for player hits — let's do that
}

// Extend bullets to support hostile projectiles vs players
function updateBulletsVsPlayers() {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    if (!b.hostile) continue;
    for (const p of G.players) {
      if (!p.alive) continue;
      const dx = b.x - p.x, dz = b.z - p.z;
      if (dx*dx + dz*dz < 0.6*0.6) {
        damagePlayer(p, b.dmg);
        scene.remove(b.mesh.g);
        G.bullets.splice(i, 1);
        break;
      }
    }
  }
}

// ─── Particles & VFX ────────────────────────────────────────
function spawnHitParticles(x, y, z, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 5, 4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    m.position.set(x, y, z);
    scene.add(m);
    G.particles.push({
      mesh: m,
      vx: (Math.random() - 0.5) * 5,
      vy: 1 + Math.random() * 3,
      vz: (Math.random() - 0.5) * 5,
      life: 0.5 + Math.random() * 0.3,
    });
  }
}
function spawnExplosion(x, y, z, r) {
  spawnHitParticles(x, y, z, 0xff7020, 24);
  spawnHitParticles(x, y, z, 0xffeb3b, 12);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.6, 36),
    new THREE.MeshBasicMaterial({ color: 0xff7020, transparent: true, opacity: 0.95, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI/2;
  ring.position.set(x, 0.06, z);
  scene.add(ring);
  G.particles.push({ mesh: ring, isRing: true, life: 0.7, maxR: r, vy: 0 });
}
function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      scene.remove(pt.mesh);
      G.particles.splice(i, 1);
      continue;
    }
    if (pt.isRing) {
      const k = 1 - pt.life / 0.7;
      pt.mesh.scale.setScalar(0.5 + k * pt.maxR * 1.8);
      pt.mesh.material.opacity = (1 - k) * 0.85;
    } else {
      pt.vy -= 9 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      pt.mesh.material.opacity = Math.min(1, pt.life * 2);
      if (pt.mesh.position.y < 0.05) { pt.vy = -pt.vy * 0.4; pt.mesh.position.y = 0.05; }
    }
  }
}

let shakeAmt = 0;
function shake(amt) { shakeAmt = Math.max(shakeAmt, amt); }

// ─── Camera follow ──────────────────────────────────────────
function updateCamera(dt) {
  // Centroid of alive players
  let cx = 0, cz = 0, n = 0;
  for (const p of G.players) {
    if (!p.alive) continue;
    cx += p.x; cz += p.z; n++;
  }
  if (n === 0) return;
  cx /= n; cz /= n;
  CAM_TARGET.lerp(new THREE.Vector3(cx, 0, cz), 1 - Math.exp(-8 * dt));
  // Ortho camera target — move position with target offset
  camera.position.set(CAM_TARGET.x, 30, CAM_TARGET.z + 22);
  if (shakeAmt > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.5;
    camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.3;
    shakeAmt = Math.max(0, shakeAmt - dt * 3);
  }
  camera.lookAt(CAM_TARGET.x, 0, CAM_TARGET.z);
}

// ─── Player mesh sync ───────────────────────────────────────
function syncPlayerMeshes(dt) {
  for (const p of G.players) {
    const pm = p.mesh;
    pm.g.visible = p.alive;
    const moving = Math.hypot(p.vx, p.vz) > 0.5;
    const bobF = moving ? 10 : 2.4;
    const bobA = moving ? 0.06 : 0.025;
    pm.g.position.set(p.x, Math.abs(Math.sin(G.t * bobF + p.idx * 0.7)) * bobA, p.z);
    pm.g.rotation.y = p.a;
    const swing = Math.sin(p.walkPhase) * 0.45;
    pm.legL.rotation.x = swing;
    pm.legR.rotation.x = -swing;
    // Hit squash
    if (p.hitT > 0) {
      const hk = p.hitT / 0.18;
      pm.g.scale.set(1 + hk * 0.16, 1 - hk * 0.1, 1 + hk * 0.04);
    } else if (pm.g.scale.x !== 1) pm.g.scale.set(1, 1, 1);
    // Muzzle flash
    if ((pm.muzzleFlashT || 0) > 0) {
      const k = pm.muzzleFlashT / 0.08;
      pm.flash.material.opacity = k * 1.0;
      pm.flashCore.material.opacity = k;
      pm.flash.scale.setScalar(1 + (1 - k) * 0.6);
      pm.rifle.position.z = -0.18 + (1 - k) * 0.14;
      pm.rifle.rotation.x = -(1 - k) * 0.18;
      pm.muzzleFlashT = Math.max(0, pm.muzzleFlashT - dt);
    } else {
      pm.flash.material.opacity = 0;
      pm.flashCore.material.opacity = 0;
      pm.rifle.position.z = -0.18;
      pm.rifle.rotation.x = 0;
    }
    // Aura
    let auraOp = 0, auraColor = 0xffffff;
    if (p.dmgT > 0)   { auraOp = Math.min(0.35, p.dmgT / 12 * 0.35);   auraColor = 0xb46bff; }
    if (p.rapidT > 0) { auraOp = Math.min(0.35, p.rapidT / 12 * 0.35); auraColor = 0xffeb3b; }
    pm.aura.material.opacity = auraOp + Math.sin(G.t * 6) * 0.04;
    pm.aura.material.color.setHex(auraColor);
    pm.aura.scale.setScalar(1 + Math.sin(G.t * 4) * 0.08);
    // Shield bubble
    pm.shieldBubble.material.opacity = p.shieldT > 0 ? (0.25 + Math.sin(G.t * 8) * 0.05) : 0;
  }
}

// ─── Pickup mesh sync ───────────────────────────────────────
function syncPickupMeshes(dt) {
  for (const pk of G.pickups) {
    pk.t += dt;
    pk.mesh.crystal.rotation.y += dt * 2.2;
    pk.mesh.crystal.rotation.x = Math.sin(pk.t * 1.5) * 0.2;
    pk.mesh.crystal.position.y = 0.7 + Math.sin(pk.t * 3) * 0.13;
    pk.mesh.halo.position.y = pk.mesh.crystal.position.y;
    pk.mesh.halo.scale.setScalar(1 + Math.sin(pk.t * 4) * 0.18);
    pk.mesh.ring.scale.setScalar(1 + Math.sin(pk.t * 2.5 + 1) * 0.18);
  }
}

// ============================================================
// DAMAGE NUMBER POOL
// ============================================================
const _dmgV = new THREE.Vector3();
const DMG_POOL_N = 36;
const dmgPool = [];
let dmgIdx = 0;
function _ensureDmgPool() {
  if (dmgPool.length) return;
  for (let i = 0; i < DMG_POOL_N; i++) {
    const el = document.createElement('div');
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    hudEl.appendChild(el);
    dmgPool.push(el);
  }
}
function spawnDmgNumber(wx, wy, wz, value, cls = '') {
  _ensureDmgPool();
  _dmgV.set(wx, wy, wz).project(camera);
  if (_dmgV.z > 1) return;
  const sx = (_dmgV.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 40;
  const sy = (-_dmgV.y * 0.5 + 0.5) * window.innerHeight + (Math.random() - 0.5) * 14;
  const el = dmgPool[dmgIdx];
  dmgIdx = (dmgIdx + 1) % DMG_POOL_N;
  el.className = 'dmgNumber ' + cls;
  el.textContent = value;
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
  el.classList.remove('run');
  void el.offsetWidth;
  el.classList.add('run');
}

// ============================================================
// WAVE MANAGEMENT
// ============================================================
function startWave(idx) {
  G.wave = idx + 1;
  G.toSpawnList = [];
  const w = WAVES[idx];
  for (const type of ['walker','runner','spitter','bomber','brute']) {
    for (let i = 0; i < (w[type] || 0); i++) G.toSpawnList.push(type);
  }
  // Shuffle
  for (let i = G.toSpawnList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [G.toSpawnList[i], G.toSpawnList[j]] = [G.toSpawnList[j], G.toSpawnList[i]];
  }
  G.spawnAccum = 0;
  G.waveT = 0;
  G.introShownFor = G.wave;
  showWaveIntro(w, G.wave);
  if (G.wave === WAVES.length) waveBoxEl.classList.add('boss');
  else waveBoxEl.classList.toggle('boss', !!w.boss);
}

function updateWave(dt) {
  if (G.phase !== 'play') return;
  G.waveT += dt;
  // Spawn pacing
  G.spawnAccum += dt;
  while (G.spawnAccum > SPAWN_INT && G.toSpawnList.length) {
    G.spawnAccum -= SPAWN_INT;
    spawnZombie(G.toSpawnList.shift());
  }
  // Check wave complete
  const aliveZ = G.zombies.filter(z => z.alive).length;
  if (G.toSpawnList.length === 0 && aliveZ === 0 && G.waveT > 1.5) {
    if (G.wave >= WAVES.length) {
      G.phase = 'win';
      showBanner('🏆 VICTORY', '10 웨이브 클리어', '메인 메뉴');
    } else {
      // Brief rest then next wave
      G.phase = 'rest';
      setTimeout(() => { if (G.phase === 'rest') { G.phase = 'play'; startWave(G.wave); } }, REST_TIME * 1000);
    }
  }
}

function showWaveIntro(w, waveNum) {
  waveIntroNumEl.textContent = String(waveNum).padStart(2, '0');
  waveIntroDescEl.textContent = w.desc;
  waveIntroEl.classList.remove('show', 'boss');
  if (w.boss) waveIntroEl.classList.add('boss');
  void waveIntroEl.offsetWidth;
  waveIntroEl.classList.add('show');
}

// ============================================================
// HUD UPDATE
// ============================================================
function updateHUD(dt) {
  // Top bar
  if (G.phase === 'play' || G.phase === 'rest') {
    waveNumEl.textContent = String(G.wave).padStart(2, '0');
    waveTotalEl.textContent = ` / ${WAVES.length}`;
    const aliveZ = G.zombies.filter(z => z.alive).length;
    waveStatusEl.textContent = `REMAIN ${aliveZ + G.toSpawnList.length}`;
  }
  scoreEl.textContent = G.score.toLocaleString();
  killEl.textContent = G.kills;

  // HP cards
  const p1 = G.players[0], p2 = G.players[1];
  if (p1) {
    hp1Val.textContent = Math.round(p1.hp);
    hp1Fill.style.width = (p1.hp / PLAYER_HP_MAX * 100) + '%';
    hp1Fill.style.background = p1.hp > 60 ? 'var(--hp-good)' : p1.hp > 30 ? 'var(--hp-warn)' : 'var(--hp-low)';
    hp1Card.classList.toggle('hpDead', !p1.alive);
  }
  if (p2) {
    hp2Card.classList.remove('hidden');
    hp2Val.textContent = Math.round(p2.hp);
    hp2Fill.style.width = (p2.hp / PLAYER_HP_MAX * 100) + '%';
    hp2Fill.style.background = p2.hp > 60 ? 'var(--hp-good)' : p2.hp > 30 ? 'var(--hp-warn)' : 'var(--hp-low)';
    hp2Card.classList.toggle('hpDead', !p2.alive);
  }

  // Powerup badges + super
  const me = G.players[G.myIdx];
  if (me) {
    // Powerup badges
    let bH = '';
    if (me.dmgT > 0)     bH += `<div class="powerupBadge dmg">⚡ DMG×2 <span class="t">${me.dmgT.toFixed(1)}s</span></div>`;
    if (me.rapidT > 0)   bH += `<div class="powerupBadge fire">🔥 RAPID <span class="t">${me.rapidT.toFixed(1)}s</span></div>`;
    if (me.shotgunT > 0) bH += `<div class="powerupBadge dmg">💥 SHOTGUN <span class="t">${me.shotgunT.toFixed(1)}s</span></div>`;
    if (me.shieldT > 0)  bH += `<div class="powerupBadge shield">🛡 SHIELD <span class="t">${me.shieldT.toFixed(1)}s</span></div>`;
    if (powerupsEl.innerHTML !== bH) powerupsEl.innerHTML = bH;

    // Super
    if (superDirty) {
      const pct = Math.min(1, me.super / SUPER_FULL);
      superBtnEl.style.setProperty('--p', (pct * 100) + '%');
      superBtnEl.classList.toggle('ready', me.super >= SUPER_FULL);
      superDirty = false;
    }

    // Combo
    if (me.combo >= 2) {
      const t = `x${me.combo}  COMBO`;
      if (comboEl.textContent !== t) {
        comboEl.textContent = t;
        comboEl.classList.add('show');
        comboEl.classList.remove('peak'); void comboEl.offsetWidth; comboEl.classList.add('peak');
      }
    } else {
      comboEl.classList.remove('show');
    }

    // Inventory slots
    if (me.inv0Dirty) {
      slot0El.classList.toggle('empty', !me.inv[0]);
      slot0El.innerHTML = me.inv[0] ? `${PICKUP[me.inv[0]].icon}<span class="key">1</span>` : '';
      me.inv0Dirty = false;
    }
    if (me.inv1Dirty) {
      slot1El.classList.toggle('empty', !me.inv[1]);
      slot1El.innerHTML = me.inv[1] ? `${PICKUP[me.inv[1]].icon}<span class="key">2</span>` : '';
      me.inv1Dirty = false;
    }

    // Low HP vignette
    lowHpEl.classList.toggle('on', me.alive && me.hp < 30);
  }

  // Lose check
  if (G.phase === 'play') {
    const allDead = G.players.every(p => !p.alive);
    if (allDead) {
      G.phase = 'lose';
      showBanner('💀 ELIMINATED', `웨이브 ${G.wave}에서 전멸`, '다시 시작');
    }
  }
}

// ============================================================
// MENU / FLOW
// ============================================================
let bannerEl = null;
function showBanner(title, sub, btnLabel) {
  if (bannerEl) bannerEl.remove();
  const el = document.createElement('div');
  el.id = 'banner';
  el.innerHTML = `
    <div id="bannerTitle">${title}</div>
    <div id="bannerSub">${sub}</div>
    <button id="bannerBtn">${btnLabel}</button>
  `;
  document.body.appendChild(el);
  bannerEl = el;
  $('bannerBtn').addEventListener('click', () => location.reload());
}

function startGame(coop = false) {
  G.isCoop = coop;
  G.phase = 'play';
  G.t = 0;
  G.wave = 0;
  G.score = 0;
  G.kills = 0;
  G.players = [makePlayer(0)];
  if (coop) G.players.push(makePlayer(1));
  G.myIdx = 0;
  G.zombies.forEach(z => scene.remove(z.mesh.g));
  G.bullets.forEach(b => scene.remove(b.mesh.g));
  G.pickups.forEach(p => scene.remove(p.mesh.g));
  G.particles.forEach(p => scene.remove(p.mesh));
  G.zombies = []; G.bullets = []; G.pickups = []; G.particles = [];
  menu.classList.add('hidden');
  hudEl.classList.remove('hidden');
  enterImmersive();
  startWave(0);
}

async function enterImmersive() {
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  } catch {}
  try {
    if (screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch {}
}

// Menu buttons
$('btnSolo').addEventListener('click', () => startGame(false));
$('btnHost').addEventListener('click', () => {
  // TODO: multiplayer in Stage 2 — for now alias to solo
  startGame(false);
});
$('btnJoin').addEventListener('click', () => {
  // TODO: multiplayer in Stage 2
  startGame(false);
});
$('btnHostBack')?.addEventListener('click', () => {
  menuMain.classList.remove('hidden');
  menuHost.classList.add('hidden');
});
$('btnJoinBack')?.addEventListener('click', () => {
  menuMain.classList.remove('hidden');
  menuJoin.classList.add('hidden');
});

// ============================================================
// MAIN LOOP
// ============================================================
let prevT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prevT) / 1000);
  prevT = now;
  if (G.phase === 'play' || G.phase === 'rest') {
    G.t += dt;
    updatePlayers(dt);
    updateZombies(dt);
    updateBullets(dt);
    updateBulletsVsPlayers();
    updateParticles(dt);
    updateWave(dt);
    syncPlayerMeshes(dt);
    syncPickupMeshes(dt);
    updateCamera(dt);
    updateHUD(dt);
  } else {
    // menu rendering — could render a hero scene
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ============================================================
// SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=3').catch(() => {});
  });
}
