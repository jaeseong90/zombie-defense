// ============================================================
// DEAD CORRIDOR — v2 (rebuilt)
// Co-op zombie defense, cel-shaded, isometric.
// ============================================================

import * as THREE from 'three';
import {
  ARENA, PLAYER_R, PLAYER_SPEED, PLAYER_HP_MAX, PLAYER_REGEN_DELAY, PLAYER_REGEN_RATE,
  BASE_FIRE_INT, BASE_DMG, BULLET_SPEED, BULLET_LIFE, SUPER_FULL,
  SPAWN_INT, REST_TIME, PICKUP_DROP, MAX_ZOMBIES,
  ZTYPE, PICKUP, WAVES, UPGRADES, comboMultiplier,
} from './src/data.js';
import { settings, vib, loadBest, saveBest as _saveBest, saveSettings } from './src/settings.js';
import { audio, ensureAudio, startMusic, stopMusic } from './src/audio.js';
import { THEMES } from './src/themes.js';

// ─── Detect mobile ───────────────────────────────────────────
const IS_MOBILE =
  matchMedia('(pointer: coarse)').matches ||
  Math.min(window.innerWidth, window.innerHeight) < 600;

// Adapter: keep old saveBest() call sites working
function saveBest() { return _saveBest(G.score, G.wave, G.kills); }

// Build version (shown on menu)
const BUILD = 's16-themes';
const buildEl = document.getElementById('menuBuild');
if (buildEl) buildEl.textContent = BUILD;

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

// ─── Lighting (mutable — theme switches modify these) ───────
const ambient = new THREE.AmbientLight(0x383040, 0.45);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x564a62, 0x1a1620, 0.35);
scene.add(hemi);
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

// ─── Floor (texture swapped per theme) ──────────────────────
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
  new THREE.MeshLambertMaterial({ color: 0xb09098 }),
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = !IS_MOBILE;
scene.add(floor);

// ─── Theme-driven arena (walls, pillars, ring, props) ───────
const G_props = [];
let arenaWalls = [], arenaPillars = [], arenaPillarCaps = [], arenaRing = null;
let currentThemeName = null;

function applyTheme(name) {
  const theme = THEMES[name] || THEMES.subway;
  if (currentThemeName === name) return; // already applied
  currentThemeName = name;

  // Background + fog
  scene.background.setHex(theme.bgColor);
  scene.fog.color.setHex(theme.fogColor);
  scene.fog.density = theme.fogDensity;
  // Lighting
  ambient.color.setHex(theme.ambient);
  keyLight.color.setHex(theme.keyColor);
  keyLight.intensity = theme.keyIntensity;
  rimLight.color.setHex(theme.rimColor);
  rimLight.intensity = theme.rimIntensity;

  // Floor texture
  if (floor.material.map) floor.material.map.dispose();
  floor.material.map = theme.floorTex();
  floor.material.color.setHex(theme.floorColor);
  floor.material.needsUpdate = true;

  // Ring (arena edge)
  if (arenaRing) scene.remove(arenaRing);
  arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(ARENA - 0.5, ARENA, 64),
    new THREE.MeshBasicMaterial({ color: theme.ringColor, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
  );
  arenaRing.rotation.x = -Math.PI/2; arenaRing.position.y = 0.01;
  scene.add(arenaRing);

  // Walls + pillars
  for (const w of arenaWalls)      scene.remove(w);
  for (const p of arenaPillars)    scene.remove(p);
  for (const c of arenaPillarCaps) scene.remove(c);
  arenaWalls = []; arenaPillars = []; arenaPillarCaps = [];
  const wallMat = tmat(theme.wallColor);
  const wallH = 1.6;
  const wallPositions = [
    { x: 0, z: -ARENA, w: ARENA * 2, d: 0.6 },
    { x: 0, z:  ARENA, w: ARENA * 2, d: 0.6 },
    { x: -ARENA, z: 0, w: 0.6, d: ARENA * 2 },
    { x:  ARENA, z: 0, w: 0.6, d: ARENA * 2 },
  ];
  for (const p of wallPositions) {
    const m = outlined(new THREE.Mesh(new THREE.BoxGeometry(p.w, wallH, p.d), wallMat), 1.02);
    m.position.set(p.x, wallH / 2, p.z);
    m.castShadow = m.receiveShadow = !IS_MOBILE;
    scene.add(m); arenaWalls.push(m);
  }
  const pillarMat = tmat(theme.pillarColor);
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
    const p = outlined(new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.5, 1.6), pillarMat), 1.04);
    p.position.set(cx * (ARENA - 0.8), 1.75, cz * (ARENA - 0.8));
    p.castShadow = !IS_MOBILE;
    scene.add(p); arenaPillars.push(p);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.2, 1.8),
      new THREE.MeshBasicMaterial({ color: theme.pillarCapColor }),
    );
    cap.position.set(cx * (ARENA - 0.8), 3.55, cz * (ARENA - 0.8));
    scene.add(cap); arenaPillarCaps.push(cap);
  }

  // Props
  for (const p of G_props) scene.remove(p.g);
  G_props.length = 0;
  const newProps = theme.propBuilder(tmat, outlined);
  for (const p of newProps) {
    scene.add(p.g);
    G_props.push(p);
  }
}

// Initial theme: subway (first wave)
applyTheme('subway');
// AABB collide a circular entity (center x,z, radius r) against all props
function collideProps(ent, r) {
  for (const p of G_props) {
    const dx = ent.x - p.x, dz = ent.z - p.z;
    const ox = p.w + r, oz = p.d + r;
    if (Math.abs(dx) < ox && Math.abs(dz) < oz) {
      // Resolve along the shallower axis
      const px = ox - Math.abs(dx);
      const pz = oz - Math.abs(dz);
      if (px < pz) ent.x += (dx > 0 ? px : -px);
      else ent.z += (dz > 0 ? pz : -pz);
    }
  }
}

// ─── PLAYER MESH ─────────────────────────────────────────────
function createPlayerMesh(idx) {
  const isP1 = idx === 0;
  const accent     = isP1 ? 0x3478ff : 0x36d97e;
  const accentDeep = isP1 ? 0x1f4cc8 : 0x1c9054;
  const accentGlow = isP1 ? 0x7ec0ff : 0x9cf2c8;
  const g = new THREE.Group();
  // Upper body rotates with aim, lower body rotates with movement
  const lower = new THREE.Group(); g.add(lower);
  const upper = new THREE.Group(); g.add(upper);

  const vest   = tmat(accent,     { emissive: accentGlow, emissiveIntensity: 0.13 });
  const aDark  = tmat(accentDeep);
  const pants  = tmat(0x2a2f3d);
  const skin   = tmat(0xffd5a0);
  const helm   = tmat(0x16181f);
  const gun    = tmat(0x131520);
  const gunMet = tmat(0x3c3e4a);
  const boot   = tmat(0x0d0d14);

  // Boots (lower)
  const bootGeo = new THREE.BoxGeometry(0.32, 0.22, 0.5);
  const bL = outlined(new THREE.Mesh(bootGeo, boot), 1.07);
  bL.position.set(-0.2, 0.11, 0.06); bL.castShadow = !IS_MOBILE; lower.add(bL);
  const bR = outlined(new THREE.Mesh(bootGeo, boot), 1.07);
  bR.position.set( 0.2, 0.11, 0.06); bR.castShadow = !IS_MOBILE; lower.add(bR);
  // Legs — lower
  const legGeo = new THREE.CylinderGeometry(0.18, 0.16, 0.45, 10);
  const lL = outlined(new THREE.Mesh(legGeo, pants), 1.07);
  lL.position.set(-0.2, 0.42, 0); lL.castShadow = !IS_MOBILE; lower.add(lL);
  const lR = outlined(new THREE.Mesh(legGeo, pants), 1.07);
  lR.position.set( 0.2, 0.42, 0); lR.castShadow = !IS_MOBILE; lower.add(lR);
  // Torso
  const tor = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.6, 0.48), vest), 1.05);
  tor.position.set(0, 0.92, 0); tor.castShadow = !IS_MOBILE; upper.add(tor);
  // Chest plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.06), aDark);
  plate.position.set(0, 0.95, 0.24); upper.add(plate);
  const chest = new THREE.Mesh(new THREE.CircleGeometry(0.07, 18),
    new THREE.MeshBasicMaterial({ color: accentGlow }));
  chest.position.set(0, 1.05, 0.275); upper.add(chest);
  // Belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.5), tmat(0x111319));
  belt.position.set(0, 0.66, 0); upper.add(belt); outlined(belt, 1.04);
  // Backpack
  const backpack = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.24), tmat(0x222a36)), 1.05);
  backpack.position.set(0, 1.04, 0.34); upper.add(backpack);
  const bpStrap1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.04), tmat(0x111319));
  bpStrap1.position.set(-0.2, 1.0, 0.24); upper.add(bpStrap1);
  const bpStrap2 = bpStrap1.clone(); bpStrap2.position.x = 0.2; upper.add(bpStrap2);
  // Shoulder pauldrons
  const shGeo = new THREE.SphereGeometry(0.2, 12, 10);
  const shL = outlined(new THREE.Mesh(shGeo, vest), 1.06);
  shL.position.set(-0.48, 1.12, 0); upper.add(shL);
  const shR = outlined(new THREE.Mesh(shGeo, vest), 1.06);
  shR.position.set( 0.48, 1.12, 0); upper.add(shR);
  // Forearms
  const armGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.42, 10);
  const aL = outlined(new THREE.Mesh(armGeo, vest), 1.06);
  aL.position.set(-0.46, 0.84, -0.12); aL.rotation.x = -0.7; upper.add(aL);
  const aR = outlined(new THREE.Mesh(armGeo, vest), 1.06);
  aR.position.set( 0.46, 0.84, -0.12); aR.rotation.x = -0.7; upper.add(aR);
  // Gloves
  const glove = new THREE.SphereGeometry(0.13, 12, 10);
  const gL = outlined(new THREE.Mesh(glove, gun), 1.06);
  gL.position.set(-0.38, 0.76, -0.58); upper.add(gL);
  const gR = outlined(new THREE.Mesh(glove, gun), 1.06);
  gR.position.set( 0.38, 0.76, -0.58); upper.add(gR);
  // Head
  const head = outlined(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), skin), 1.05);
  head.position.set(0, 1.5, 0); head.castShadow = !IS_MOBILE; upper.add(head);
  // Helmet
  const helmet = outlined(new THREE.Mesh(
    new THREE.SphereGeometry(0.41, 18, 12, 0, Math.PI*2, 0, Math.PI/1.85), helm), 1.04);
  helmet.position.set(0, 1.55, 0); helmet.castShadow = !IS_MOBILE; upper.add(helmet);
  // Helmet rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 28), aDark);
  rim.position.set(0, 1.45, 0); rim.rotation.x = Math.PI/2; upper.add(rim);
  // Visor (signature glowing strip)
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.37, 18, 8, 0, Math.PI*2, Math.PI/2 - 0.18, 0.28),
    new THREE.MeshBasicMaterial({ color: accentGlow, transparent: true, opacity: 0.95 }),
  );
  visor.position.set(0, 1.5, 0); upper.add(visor);
  // Team disc on helmet top
  const team = new THREE.Mesh(new THREE.CircleGeometry(0.14, 18),
    new THREE.MeshBasicMaterial({ color: accentGlow }));
  team.position.set(0, 1.86, 0); team.rotation.x = -Math.PI/2; upper.add(team);

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
  upper.add(rifle);

  // Muzzle flash
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe5a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.set(0.08, 0.91, -1.32); upper.add(flash);
  const flashCore = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff8c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flashCore.position.set(0.08, 0.91, -1.28); upper.add(flashCore);

  // Powerup aura
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.position.y = 0.85; upper.add(aura);

  // Shield bubble (when shield active)
  const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 18),
    new THREE.MeshBasicMaterial({ color: 0x4a9eff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  shieldBubble.position.y = 0.9; upper.add(shieldBubble);

  // Aim indicator (thin line on ground toward aim direction)
  const aimGeo = new THREE.PlaneGeometry(0.18, 5);
  const aimMat = new THREE.MeshBasicMaterial({ color: accentGlow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const aimLine = new THREE.Mesh(aimGeo, aimMat);
  aimLine.rotation.x = -Math.PI / 2;
  aimLine.position.set(0, 0.03, -2.5);
  upper.add(aimLine);

  return { g, lower, upper, rifle, flash, flashCore, legL: lL, legR: lR, aura, shieldBubble, head, armL: aL, armR: aR, aimLine };
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
  // HP bar billboard for bosses (brute)
  let hpBar = null;
  if (type === 'brute') hpBar = createBossHpBar(s);
  if (hpBar) g.add(hpBar.sprite);
  if (type === 'runner') {
    for (const sx of [-0.28, 0.28]) {
      const sinew = new THREE.Mesh(new THREE.BoxGeometry(0.03*s, 0.4*s, 0.04*s),
        new THREE.MeshBasicMaterial({ color: 0xff5060 }));
      sinew.position.set(sx*s, 0.88*s, 0.3*s); g.add(sinew);
    }
  }
  return { g, legL: lL, legR: lR, armL: aL, armR: aR, head, bomb, hpBar };
}
function createBossHpBar(s) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 20;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6 * s, 0.45 * s, 1);
  sprite.position.y = 4.4 * s;
  drawBossHpBar(ctx, 1.0);
  return { sprite, canvas, ctx, tex };
}
function drawBossHpBar(ctx, ratio) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(20, 6, 14, 0.86)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 90, 60, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
  const fillW = (w - 5) * Math.max(0, ratio);
  const grd = ctx.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, '#ff3a4a');
  grd.addColorStop(0.55, '#ff7a3a');
  grd.addColorStop(1, '#ffc060');
  ctx.fillStyle = grd;
  ctx.fillRect(2.5, 2.5, fillW, h - 5);
  // Hex lines (texture)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let i = 8; i < fillW; i += 12) {
    ctx.beginPath();
    ctx.moveTo(2.5 + i, 2.5);
    ctx.lineTo(2.5 + i, h - 2.5);
    ctx.stroke();
  }
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
  shopCards: [], shopBought: [], shopTimeLeft: 0,
  event: null, zSpdMult: 1, spawnIntMult: 1, dropMult: 1,
};

function makePlayer(idx) {
  const mesh = createPlayerMesh(idx);
  scene.add(mesh.g);
  return {
    idx,
    mesh,
    x: idx === 0 ? -3 : 3, z: 0, a: 0,
    vx: 0, vz: 0,
    hp: PLAYER_HP_MAX, maxHp: PLAYER_HP_MAX,
    alive: true,
    lastHitT: 0, hitT: 0,
    fireT: 0,
    walkPhase: Math.random() * 10,
    combo: 0, comboT: 0,
    score: 0, kills: 0,
    dmgT: 0, rapidT: 0, shotgunT: 0, shieldT: 0,
    super: 0,
    inv: [null, null],
    inv0Dirty: true, inv1Dirty: true,
    aim: 0,
    // Stats (modified by shop upgrades)
    dmgMult: 1, fireMult: 1, speedMult: 1, regenMult: 1, superGainMult: 1,
    comboBonus: 0, startShield: 0,
    upgrades: [],
  };
}

// ============================================================
// INPUT (joysticks + super + items)
// ============================================================
// ─── Dynamic joysticks — appear at finger position on touchZone ──
const joys = { move: null, aim: null };
const JOY_MAX = 64;
function setupDynamicJoystick(zoneId, joyId, key) {
  const zone = $(zoneId);
  const joy = $(joyId);
  const knob = joy.querySelector('.joyKnob');
  const hint = $(key === 'move' ? 'moveHint' : 'aimHint');

  function place(joy, cx, cy) {
    joy.style.left = cx + 'px';
    joy.style.top  = cy + 'px';
  }
  function setKnob(dx, dy) {
    const len = Math.hypot(dx, dy);
    let kx = dx, ky = dy;
    if (len > JOY_MAX) { kx = dx / len * JOY_MAX; ky = dy / len * JOY_MAX; }
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    joys[key].dx = kx; joys[key].dy = ky;
  }
  function start(clientX, clientY, pid) {
    joys[key] = { pid, cx: clientX, cy: clientY, dx: 0, dy: 0 };
    place(joy, clientX, clientY);
    joy.classList.add('active');
    hint?.classList.add('gone');
    knob.style.transform = 'translate(0,0)';
  }
  function move(clientX, clientY) {
    if (!joys[key]) return;
    setKnob(clientX - joys[key].cx, clientY - joys[key].cy);
  }
  function end() {
    joys[key] = null;
    joy.classList.remove('active');
    knob.style.transform = 'translate(0,0)';
  }
  // Touch
  zone.addEventListener('touchstart', (e) => {
    if (joys[key]) return; // already tracking a finger
    const t = e.changedTouches[0];
    start(t.clientX, t.clientY, t.identifier);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchmove', (e) => {
    if (!joys[key]) return;
    for (const t of e.touches) {
      if (t.identifier === joys[key].pid) { move(t.clientX, t.clientY); e.preventDefault(); return; }
    }
  }, { passive: false });
  document.addEventListener('touchend', (e) => {
    if (!joys[key]) return;
    for (const t of e.touches) if (t.identifier === joys[key].pid) return; // still pressed
    end();
  });
  document.addEventListener('touchcancel', end);
  // Mouse for desktop testing
  zone.addEventListener('mousedown', (e) => {
    if (joys[key]) return;
    start(e.clientX, e.clientY, 'mouse');
  });
  document.addEventListener('mousemove', (e) => { if (joys[key] && joys[key].pid === 'mouse') move(e.clientX, e.clientY); });
  document.addEventListener('mouseup',   (e) => { if (joys[key] && joys[key].pid === 'mouse') end(); });
}
setupDynamicJoystick('moveZone', 'joyMove', 'move');
setupDynamicJoystick('aimZone',  'joyAim',  'aim');

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
  // Set position BEFORE adding to scene so it doesn't flash at origin for one frame
  meshInfo.g.position.set(x, 0, z);
  const aim = Math.atan2(-x, z); // face roughly toward center
  meshInfo.g.rotation.y = aim;
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
  // Brute entry: shockwave + camera shake
  if (type === 'brute') {
    spawnExplosion(x, 0.4, z, 4);
    shake(0.6);
    ensureAudio(); audio.boom?.();
  }
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

function gatherLocalInput() {
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
}

function updatePlayers(dt) {
  // On host with peer: apply peer input to player[1]
  if (G.isCoop && isHost && G.players[1]) {
    G.players[1].input = { mvX: peerInput.mvX, mvY: peerInput.mvY, aimX: peerInput.aimX, aimY: peerInput.aimY, aimLen: peerInput.aimLen };
    if (peerInput.useSuper) {
      const p2 = G.players[1];
      if (p2.alive && p2.super >= SUPER_FULL) { p2.super = 0; triggerSuper(p2); pendingEvents.push({ t: 'super', x: p2.x, z: p2.z, who: 1 }); }
      peerInput.useSuper = false;
    }
    if (peerInput.useSlot >= 0) {
      useItemForPlayer(G.players[1], peerInput.useSlot);
      peerInput.useSlot = -1;
    }
  }
  for (const p of G.players) {
    if (!p.alive) continue;
    const inp = p.input || { mvX: 0, mvY: 0, aimX: 0, aimY: 0, aimLen: 0 };
    p.vx = inp.mvX * PLAYER_SPEED * p.speedMult;
    p.vz = inp.mvY * PLAYER_SPEED * p.speedMult;
    p.x = Math.max(-ARENA + 1, Math.min(ARENA - 1, p.x + p.vx * dt));
    p.z = Math.max(-ARENA + 1, Math.min(ARENA - 1, p.z + p.vz * dt));
    collideProps(p, PLAYER_R);
    p.walkPhase += dt * Math.hypot(inp.mvX, inp.mvY) * 9;

    // Aim from aim joystick, fallback to movement direction
    if (inp.aimLen > 0.18) {
      let targetA = Math.atan2(inp.aimX, -inp.aimY);
      // Soft aim-assist: pull toward nearest enemy within a small cone
      let bestZ = null, bestDA = 0.28, bestZA = 0;
      for (const z of G.zombies) {
        if (!z.alive) continue;
        const dx = z.x - p.x, dz = z.z - p.z;
        const dd = Math.hypot(dx, dz);
        if (dd > 16) continue;
        const zA = Math.atan2(dx, -dz);
        let da = zA - targetA;
        while (da >  Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < bestDA) { bestDA = Math.abs(da); bestZ = z; bestZA = zA; }
      }
      if (bestZ) {
        let da = bestZA - targetA;
        while (da >  Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        targetA += da * 0.55;
      }
      p.a = targetA;
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
    if (G.t - p.lastHitT > PLAYER_REGEN_DELAY && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + PLAYER_REGEN_RATE * p.regenMult * dt);
    }

    // Fire bullets while aim joystick is engaged
    if (inp.aimLen > 0.55 && p.fireT <= 0) {
      const fireInt = BASE_FIRE_INT * p.fireMult * (p.rapidT > 0 ? 0.45 : 1.0) * (p.shotgunT > 0 ? 1.6 : 1.0);
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
  const buffMult = (p.dmgT > 0 ? 2 : 1) * p.dmgMult;
  if (p.shotgunT > 0) {
    // 5-pellet spread
    for (let i = -2; i <= 2; i++) {
      const angle = p.a + i * 0.13;
      const sx = Math.sin(angle), sz = -Math.cos(angle);
      spawnBullet(ox, oz, sx, sz, BASE_DMG * 0.72 * buffMult, p.idx, p.dmgT > 0, 0xff7028);
    }
  } else {
    spawnBullet(ox, oz, dx, dz, BASE_DMG * buffMult, p.idx, p.dmgT > 0);
  }
  p.mesh.muzzleFlashT = 0.08;
  p.super = Math.min(SUPER_FULL, p.super + 0.6 * p.superGainMult);
  superDirty = true;
}

// ─── Bullet pool (GC-free combat) ───────────────────────────
const BULLET_POOL_N = IS_MOBILE ? 64 : 96;
const bulletPool = [];
for (let i = 0; i < BULLET_POOL_N; i++) {
  const m = createBulletMesh(0xffffff);
  m.g.visible = false;
  scene.add(m.g);
  bulletPool.push({ mesh: m, active: false });
}
function _getBulletSlot() {
  for (const b of bulletPool) if (!b.active) return b;
  return null;
}
function _releaseBullet(b) {
  if (b.poolRef) {
    b.poolRef.active = false;
    b.poolRef.mesh.g.visible = false;
  } else if (b.mesh && b.mesh.g) {
    scene.remove(b.mesh.g);
  }
}
function spawnBullet(x, z, dx, dz, dmg, ownerIdx, crit, color = 0xffe27a) {
  const slot = _getBulletSlot();
  if (!slot) return; // pool exhausted — drop the shot
  slot.active = true;
  slot.mesh.core.material.color.setHex(color);
  slot.mesh.trail.material.color.setHex(color);
  slot.mesh.g.position.set(x, 1.0, z);
  slot.mesh.g.visible = true;
  G.bullets.push({
    poolRef: slot,
    x, y: 1.0, z,
    vx: dx * BULLET_SPEED, vy: 0, vz: dz * BULLET_SPEED,
    life: BULLET_LIFE,
    dmg, ownerIdx, crit,
    mesh: slot.mesh,
  });
}
function spawnProjectile(x, z, dx, dz, speed, dmg, color, hostile, life) {
  const slot = _getBulletSlot();
  if (!slot) return;
  slot.active = true;
  slot.mesh.core.material.color.setHex(color);
  slot.mesh.trail.material.color.setHex(color);
  slot.mesh.g.position.set(x, 1.3, z);
  slot.mesh.g.visible = true;
  G.bullets.push({
    poolRef: slot,
    x, y: 1.3, z,
    vx: dx * speed, vy: 0, vz: dz * speed,
    life: life || 2.0,
    dmg, ownerIdx: hostile ? -1 : 0, crit: false,
    mesh: slot.mesh,
    hostile,
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
      _releaseBullet(b);
      G.bullets.splice(i, 1);
      continue;
    }
    // Block by props (cover) — only at low-mid bullet height (which is 1.0)
    let blocked = false;
    for (const pr of G_props) {
      const dx = b.x - pr.x, dz = b.z - pr.z;
      if (Math.abs(dx) < pr.w + 0.1 && Math.abs(dz) < pr.d + 0.1) { blocked = true; break; }
    }
    if (blocked) {
      spawnHitParticles(b.x, b.y, b.z, 0xffd070, 6);
      _releaseBullet(b);
      G.bullets.splice(i, 1);
      continue;
    }
    // Visual-only bullets (peer-side from broadcast events) don't collide
    if (b.visualOnly) continue;
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
  let earned = 0;
  if (p) {
    p.combo = Math.min(8, p.combo + 1);
    p.comboT = 3.2;
    p.kills++;
    const base = ZTYPE[z.type].score;
    earned = Math.floor(base * comboMultiplier(p.combo, p.comboBonus));
    p.score += earned;
    G.score += earned;
    G.kills++;
    p.super = Math.min(SUPER_FULL, p.super + (z.type === 'brute' ? 28 : z.type === 'bomber' ? 6 : 14) * p.superGainMult);
    superDirty = true;
    spawnDmgNumber(z.x, 2.0, z.z, `+${earned}` + (p.combo > 1 ? ` x${p.combo}` : ''), 'score');
  }
  pendingEvents.push({ t: 'kill', x: z.x, z: z.z, s: earned, cb: p ? p.combo : 1 });
  ensureAudio(); audio.kill?.();
  // Drop pickup chance (modified by wave event)
  if (Math.random() < PICKUP_DROP * (G.dropMult || 1) * (z.type === 'brute' ? 4 : 1)) {
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
  pendingEvents.push({ t: 'pop', x: bomb.x, z: bomb.z, r: spec.expR });
  ensureAudio(); audio.boom?.();
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
    vib(dmg > 20 ? 80 : 30);
  }
  if (p.hp <= 0) { p.hp = 0; p.alive = false; }
}

function spawnPickup(x, z, type) {
  const m = createPickupMesh(type);
  m.g.position.set(x, 0, z);
  scene.add(m.g);
  G.pickups.push({ id: 'pk-' + (pickupIdCounter++), x, z, type, t: 0, mesh: m });
}

function collectPickup(p, pk) {
  const spec = PICKUP[pk.type];
  if (p.idx === G.myIdx) vib(15);
  pendingEvents.push({ t: 'pickup', x: pk.x, z: pk.z, c: spec.em });
  ensureAudio(); audio.pickup?.();
  if (spec.instant) {
    p.hp = Math.min(p.maxHp, p.hp + spec.hpRestore);
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

function useItemForPlayer(p, slot) {
  if (!p) return;
  const t = p.inv[slot];
  if (!t) return;
  const spec = PICKUP[t];
  if (spec.instant) {
    p.hp = Math.min(p.maxHp, p.hp + spec.hpRestore);
  } else {
    p[spec.key] = Math.max(p[spec.key] || 0, spec.dur);
  }
  p.inv[slot] = null;
  if (slot === 0) p.inv0Dirty = true; else p.inv1Dirty = true;
}
function useItem(slot) {
  useItemForPlayer(G.players[G.myIdx], slot);
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
  pendingEvents.push({ t: 'super', x: p.x, z: p.z });
  ensureAudio(); audio.super?.();
  vib(120);
}

// ─── ZOMBIE AI ──────────────────────────────────────────────
function updateZombies(dt) {
  for (let i = G.zombies.length - 1; i >= 0; i--) {
    const z = G.zombies[i];
    z.hitT = Math.max(0, z.hitT - dt);
    z.lungeT = Math.max(0, z.lungeT - dt * 4);
    if (!z.alive) {
      z.deathT += dt;
      const k = Math.min(1, z.deathT / 0.7);
      if (z.deathTilt == null) z.deathTilt = (Math.random() - 0.5) * 0.6;
      z.mesh.g.rotation.x = k * (Math.PI / 2.2);
      z.mesh.g.rotation.z = k * z.deathTilt;
      z.mesh.g.position.y = -k * 0.25;
      z.mesh.g.scale.setScalar(1 - k * 0.18);
      // Fade body materials (but skip outlines — they're already inside)
      if (!z.fadedOnce) {
        z.fadedOnce = true;
        z.mesh.g.traverse((o) => {
          if (o.material) {
            o.material.transparent = true;
          }
        });
      }
      z.mesh.g.traverse((o) => {
        if (o.material && o.material.transparent) o.material.opacity = Math.max(0, 1 - k);
      });
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
        z.x += nx * spec.spd * (G.zSpdMult || 1) * dt;
        z.z += nz * spec.spd * (G.zSpdMult || 1) * dt;
        z.walkPhase += dt * spec.spd * 2;
      }
      z.spitCD -= dt;
      if (z.spitCD <= 0 && d < spec.atkR) {
        z.spitCD = spec.atkInt + Math.random() * 0.5;
        const sx = dxT / Math.max(d, 0.001), sz = dzT / Math.max(d, 0.001);
        spawnProjectile(z.x, z.z, sx, sz, spec.projSpd, spec.projDmg, 0xc0ff60, true, 2.0);
        z.lungeT = 0.8;
      }
    } else if (spec.explodes) {
      // Bomber: chase and explode on contact
      if (d > spec.atkR) {
        const nx = dxT / Math.max(d, 0.001), nz = dzT / Math.max(d, 0.001);
        z.x += nx * spec.spd * (G.zSpdMult || 1) * dt;
        z.z += nz * spec.spd * (G.zSpdMult || 1) * dt;
        z.walkPhase += dt * spec.spd * 2;
      } else {
        // Trigger explosion
        z.alive = false; z.deathT = 0.001;
        bombExplode(z);
      }
    } else {
      // Melee zombie (brute does AOE slam, others do single-target lunge)
      if (d > spec.atkR) {
        const nx = dxT / Math.max(d, 0.001), nz = dzT / Math.max(d, 0.001);
        z.x += nx * spec.spd * (G.zSpdMult || 1) * dt;
        z.z += nz * spec.spd * (G.zSpdMult || 1) * dt;
        z.walkPhase += dt * spec.spd * 2;
      } else {
        z.attackCD -= dt;
        if (z.attackCD <= 0) {
          z.attackCD = spec.atkInt;
          z.lungeT = 1.0;
          if (z.type === 'brute') {
            // Ground slam: AOE around brute
            const R = spec.atkR * 1.8;
            for (const pp of G.players) {
              if (!pp.alive) continue;
              const ddx = pp.x - z.x, ddz = pp.z - z.z;
              const dd = Math.hypot(ddx, ddz);
              if (dd < R) damagePlayer(pp, spec.dmg * (1 - dd / R * 0.4));
            }
            // Visual shockwave
            spawnExplosion(z.x, 0.4, z.z, R);
            shake(0.6);
            ensureAudio(); audio.boom?.();
            pendingEvents.push({ t: 'pop', x: z.x, z: z.z, r: R });
          } else {
            damagePlayer(target, spec.dmg);
          }
        }
      }
    }
    // Stay inside arena + collide with props
    z.x = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, z.x));
    z.z = Math.max(-ARENA + 0.5, Math.min(ARENA - 0.5, z.z));
    collideProps(z, 0.45 * spec.sz);

    // Update mesh: heavy shamble walk
    const g = z.mesh.g;
    // Step-bob: each leg plant lifts the body (uses |sin| so always upward)
    const stepBob = Math.abs(Math.sin(z.walkPhase * 0.5)) * 0.12 * spec.sz;
    const lOff = z.lungeT * 0.5;
    g.position.set(z.x + Math.sin(z.a) * lOff, stepBob, z.z + (-Math.cos(z.a)) * lOff);
    g.rotation.y = z.a;
    // Side-to-side hip roll while walking
    g.rotation.z = Math.sin(z.walkPhase) * 0.10 * spec.sz;
    g.rotation.x = 0.06 + Math.sin(z.walkPhase * 0.5) * 0.04;  // permanent forward hunch + sway
    // Big leg stride (no foot is mid-air during plant moment)
    const ls = Math.sin(z.walkPhase) * 0.55;
    z.mesh.legL.rotation.x = ls;
    z.mesh.legR.rotation.x = -ls;
    // Heavy shoulder lurch — arms swing opposite + drop/raise with body
    const asw = Math.sin(z.walkPhase * 0.5) * 0.28;
    z.mesh.armL.rotation.z = 0.22 + asw;
    z.mesh.armR.rotation.z = -0.22 - asw;
    // Subtle arm lift back-and-forth
    const armBack = Math.sin(z.walkPhase + Math.PI/2) * 0.18;
    z.mesh.armL.rotation.x = -1.0 + armBack;
    z.mesh.armR.rotation.x = -1.0 - armBack;
    // Head nod (lurches forward each step)
    if (z.mesh.head) {
      z.mesh.head.rotation.x = 0.3 + Math.sin(z.walkPhase * 0.5 + Math.PI) * 0.18;
      z.mesh.head.rotation.z = Math.sin(z.walkPhase) * 0.08;
    }
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
    // Boss HP bar update
    if (z.mesh.hpBar) {
      const ratio = Math.max(0, z.hp / z.hpMax);
      if (z._lastHpR == null || Math.abs(z._lastHpR - ratio) > 0.008) {
        drawBossHpBar(z.mesh.hpBar.ctx, ratio);
        z.mesh.hpBar.tex.needsUpdate = true;
        z._lastHpR = ratio;
      }
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
    const speed = Math.hypot(p.vx, p.vz);
    const moving = speed > 0.5;
    // Step-bob synced to leg phase (each step lifts the body) — feels like real walking
    const bob = moving
      ? Math.abs(Math.sin(p.walkPhase * 0.5)) * 0.13
      : Math.abs(Math.sin(G.t * 2.4 + p.idx * 0.7)) * 0.03;
    pm.g.position.set(p.x, bob, p.z);
    // Upper body rotates with aim direction (so rifle/flash align with shots)
    pm.upper.rotation.y = p.a;
    // Lower body rotates with movement direction (or aim if standing still)
    const moveAngle = moving ? Math.atan2(p.vx, -p.vz) : p.a;
    pm.lower.rotation.y = moveAngle;
    // Body lean in direction of motion (world-aligned, looks natural in ortho)
    const leanK = 0.16;
    pm.g.rotation.x = (p.vz / PLAYER_SPEED) * leanK;
    pm.g.rotation.z = -(p.vx / PLAYER_SPEED) * leanK + (moving ? Math.sin(p.walkPhase) * 0.06 : 0);
    const leanAmt = Math.min(1, speed / PLAYER_SPEED) * leanK;
    // Big stride leg swing — visible in lower body's local frame (along move direction)
    const swing = Math.sin(p.walkPhase) * (moving ? 0.75 : 0.08);
    pm.legL.rotation.x = swing;
    pm.legR.rotation.x = -swing;
    // Arm sway counter-phase + lift on opposite leg
    if (pm.armL) {
      const aSwing = Math.sin(p.walkPhase + Math.PI) * (moving ? 0.28 : 0.04);
      pm.armL.rotation.x = -0.7 + aSwing;
      pm.armR.rotation.x = -0.7 - aSwing;
    }
    // Head counter-tilt + slight nod
    if (pm.head) {
      pm.head.rotation.x = -leanAmt * 0.6 + (moving ? Math.sin(p.walkPhase * 0.5) * 0.04 : 0);
    }
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
    // Aim line
    if (pm.aimLine) {
      const aLen = Math.hypot(p.input?.aimX || 0, p.input?.aimY || 0);
      const target = aLen > 0.18 ? 0.42 + Math.sin(G.t * 7) * 0.08 : 0;
      pm.aimLine.material.opacity += (target - pm.aimLine.material.opacity) * 0.18;
    }
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
    // Magnet toward nearest alive player within range (host/solo only — peer follows via state sync)
    if (amAuthoritative()) {
      let bd = Infinity, bp = null;
      for (const p of G.players) {
        if (!p.alive) continue;
        const dx = p.x - pk.x, dz = p.z - pk.z;
        const d2 = dx*dx + dz*dz;
        if (d2 < bd) { bd = d2; bp = p; }
      }
      if (bp && bd < 4.5 * 4.5) {
        const d = Math.max(0.1, Math.sqrt(bd));
        const pull = (4.5 - d) / 4.5 * 4.5;
        pk.x += (bp.x - pk.x) / d * pull * dt;
        pk.z += (bp.z - pk.z) / d * pull * dt;
        pk.mesh.g.position.x = pk.x;
        pk.mesh.g.position.z = pk.z;
      }
    }
  }
}

// ─── Atmospheric dust/embers (floating background particles) ──
const DUST_COUNT = IS_MOBILE ? 40 : 80;
const dustGroup = new THREE.Group();
scene.add(dustGroup);
const dustParticles = [];
for (let i = 0; i < DUST_COUNT; i++) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.05 + Math.random() * 0.04, 4, 3),
    new THREE.MeshBasicMaterial({
      color: Math.random() < 0.6 ? 0xff7028 : 0xffd070,
      transparent: true, opacity: 0.5 + Math.random() * 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  const x = (Math.random() - 0.5) * ARENA * 1.6;
  const z = (Math.random() - 0.5) * ARENA * 1.6;
  const y = 1 + Math.random() * 6;
  m.position.set(x, y, z);
  dustGroup.add(m);
  dustParticles.push({
    m, vy: 0.2 + Math.random() * 0.5,
    drift: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * Math.PI * 2,
  });
}
let dustT = 0;
function updateDust(dt) {
  dustT += dt;
  for (const p of dustParticles) {
    p.m.position.y += p.vy * dt;
    p.m.position.x += Math.sin(dustT * 0.3 + p.phase) * p.drift * dt * 6;
    if (p.m.position.y > 8) {
      p.m.position.y = -0.5;
      p.m.position.x = (Math.random() - 0.5) * ARENA * 1.6;
      p.m.position.z = (Math.random() - 0.5) * ARENA * 1.6;
    }
    p.m.material.opacity = (0.4 + Math.sin(dustT * 1.6 + p.phase) * 0.3);
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
// ============================================================
// SHOP (upgrade cards between waves)
// ============================================================
let shopTimerHandle = null;
// Initiate a new shop session (host or solo). Stores cards in G.shopCards.
function startShop() {
  const pool = UPGRADES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  G.shopCards = pool.slice(0, 3).map(u => u.id);
  G.shopBought = [];
  G.shopTimeLeft = 8;
  G.phase = 'shop';
  pendingEvents.push({ t: 'shopopen', cards: G.shopCards.slice() });
  renderShop();
  if (!G.isCoop || isHost) {
    // Authoritative: start timer
    shopTimerHandle = setInterval(() => {
      G.shopTimeLeft -= 1;
      const n = document.getElementById('shopTimerN');
      if (n) n.textContent = G.shopTimeLeft;
      if (G.shopTimeLeft <= 0 || G.shopBought.length >= G.shopCards.length) closeShop();
    }, 1000);
  }
}
function renderShop() {
  const old = document.getElementById('shop');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'shop';
  el.innerHTML = `
    <div id="shopHeader">
      <div id="shopTitle">업그레이드</div>
      <div id="shopSub">${G.isCoop ? '두 명 모두에게 적용 · 1장 선택' : `웨이브 ${G.wave + 1} 준비 — 하나 선택`}</div>
    </div>
    <div id="shopCards"></div>
    <div id="shopFooter">
      <button id="shopSkip">SKIP</button>
      <div id="shopTimer"><span class="num" id="shopTimerN">${G.shopTimeLeft}</span> s</div>
    </div>
  `;
  document.body.appendChild(el);
  const cardsEl = document.getElementById('shopCards');
  G.shopCards.forEach((id, i) => {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) return;
    const c = document.createElement('div');
    c.className = 'shopCard' + (G.shopBought.includes(i) ? ' bought' : '');
    c.dataset.i = i;
    c.innerHTML = `
      <div class="shopCardIcon">${u.icon}</div>
      <div class="shopCardName">${u.name}</div>
      <div class="shopCardDesc">${u.desc}</div>
    `;
    c.addEventListener('click', () => requestBuy(i));
    cardsEl.appendChild(c);
  });
  document.getElementById('shopSkip').addEventListener('click', () => requestSkip());
}
function refreshShopCards() {
  const cardsEl = document.getElementById('shopCards');
  if (!cardsEl) return;
  cardsEl.querySelectorAll('.shopCard').forEach(el => {
    const i = +el.dataset.i;
    el.classList.toggle('bought', G.shopBought.includes(i));
  });
}
function requestBuy(i) {
  if (G.shopBought.includes(i)) return;
  if (G.isCoop && !isHost) {
    const me = G.players[G.myIdx];
    if (me) me.pendingShopBuy = i;
    ensureAudio(); audio.pickup?.();
  } else {
    applyShopBuy(i);
  }
}
function requestSkip() {
  if (G.isCoop && !isHost) {
    const me = G.players[G.myIdx];
    if (me) me.pendingShopSkip = true;
  } else {
    closeShop();
  }
}
function applyShopBuy(i) {
  if (G.shopBought.includes(i)) return;
  const id = G.shopCards[i];
  const u = UPGRADES.find(x => x.id === id);
  if (!u) return;
  for (const p of G.players) { u.apply(p); p.upgrades.push(id); }
  G.shopBought.push(i);
  ensureAudio(); audio.pickup?.();
  vib(20);
  refreshShopCards();
  pendingEvents.push({ t: 'shopbuy', i });
  // Close once a card is picked (shared upgrade)
  setTimeout(() => closeShop(), 400);
}
function closeShop() {
  if (shopTimerHandle) { clearInterval(shopTimerHandle); shopTimerHandle = null; }
  const el = document.getElementById('shop');
  if (el) el.remove();
  G.shopCards = [];
  G.shopBought = [];
  G.phase = 'play';
  pendingEvents.push({ t: 'shopclose' });
  if (!G.isCoop || isHost) startWave(G.wave);
}
// Backward-compatible names (older callers)
const showShop = startShop;
const buyUpgrade = (id) => {
  const i = G.shopCards.indexOf(id);
  if (i >= 0) applyShopBuy(i);
};

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
  // Apply per-wave start shield from upgrades
  for (const p of G.players) {
    if (p.startShield) p.shieldT = Math.max(p.shieldT || 0, p.startShield);
  }
  // Apply theme (sets baseline floor/walls/lighting/fog/props)
  applyTheme(w.theme || 'subway');
  // Then layer wave event modifiers on top
  G.event = w.event || null;
  G.zSpdMult = 1; G.spawnIntMult = 1; G.dropMult = 1;
  if (G.event === 'speed')   { G.zSpdMult = 1.2; }
  if (G.event === 'fog')     { scene.fog.density *= 1.55; }
  if (G.event === 'dark')    { keyLight.intensity *= 0.5; rimLight.intensity *= 0.5; }
  if (G.event === 'frenzy')  { G.spawnIntMult = 0.55; G.zSpdMult = 1.12; }
  if (G.event === 'chaos')   { G.dropMult = 2.2; }
  if (G.event === 'final')   { G.spawnIntMult = 0.55; G.zSpdMult = 1.08; }
  showWaveIntro(w, G.wave);
  if (G.wave === WAVES.length) waveBoxEl.classList.add('boss');
  else waveBoxEl.classList.toggle('boss', !!w.boss);
  pendingEvents.push({ t: 'wave', n: G.wave });
  ensureAudio(); audio.wave?.();
  vib(60);
}

function updateWave(dt) {
  if (G.phase !== 'play') return;
  G.waveT += dt;
  // Spawn pacing (event modifier)
  const spawnInt = SPAWN_INT * (G.spawnIntMult || 1);
  G.spawnAccum += dt;
  while (G.spawnAccum > spawnInt && G.toSpawnList.length) {
    G.spawnAccum -= spawnInt;
    spawnZombie(G.toSpawnList.shift());
  }
  // Check wave complete
  const aliveZ = G.zombies.filter(z => z.alive).length;
  if (G.toSpawnList.length === 0 && aliveZ === 0 && G.waveT > 1.5) {
    if (G.wave >= WAVES.length) {
      G.phase = 'win';
      pendingEvents.push({ t: 'win' });
      ensureAudio(); audio.win?.();
      vib([60, 60, 120]);
      const best = saveBest();
      stopMusic();
      showBanner('🏆 VICTORY', `SCORE ${G.score.toLocaleString()} · BEST ${best.bestScore.toLocaleString()}`, '메인 메뉴');
    } else {
      // Both solo & coop: shop between waves
      startShop();
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
    hp1Fill.style.width = (p1.hp / p1.maxHp * 100) + '%';
    hp1Fill.style.background = p1.hp > 60 ? 'var(--hp-good)' : p1.hp > 30 ? 'var(--hp-warn)' : 'var(--hp-low)';
    hp1Card.classList.toggle('hpDead', !p1.alive);
    if (p1._lastHp != null && p1.hp < p1._lastHp - 0.5) {
      hp1Card.classList.remove('hit'); void hp1Card.offsetWidth; hp1Card.classList.add('hit');
    }
    p1._lastHp = p1.hp;
  }
  if (p2) {
    hp2Card.classList.remove('hidden');
    hp2Val.textContent = Math.round(p2.hp);
    hp2Fill.style.width = (p2.hp / p2.maxHp * 100) + '%';
    hp2Fill.style.background = p2.hp > 60 ? 'var(--hp-good)' : p2.hp > 30 ? 'var(--hp-warn)' : 'var(--hp-low)';
    hp2Card.classList.toggle('hpDead', !p2.alive);
    if (p2._lastHp != null && p2.hp < p2._lastHp - 0.5) {
      hp2Card.classList.remove('hit'); void hp2Card.offsetWidth; hp2Card.classList.add('hit');
    }
    p2._lastHp = p2.hp;
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

    // Combo with tier escalation
    if (me.combo >= 2) {
      const t = `x${me.combo}  COMBO`;
      const tier = me.combo >= 7 ? 'tier3' : me.combo >= 5 ? 'tier2' : me.combo >= 3 ? 'tier1' : '';
      if (comboEl.textContent !== t) {
        comboEl.textContent = t;
        comboEl.className = 'show ' + tier;
        comboEl.classList.remove('peak'); void comboEl.offsetWidth; comboEl.classList.add('peak');
      } else if (!comboEl.classList.contains(tier) && tier) {
        comboEl.className = 'show ' + tier + ' peak';
      }
    } else {
      comboEl.className = '';
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
      pendingEvents.push({ t: 'lose' });
      ensureAudio(); audio.lose?.();
      vib([120, 80, 120]);
      const best = saveBest();
      stopMusic();
      showBanner('💀 ELIMINATED', `웨이브 ${G.wave} · SCORE ${G.score.toLocaleString()} · BEST ${best.bestScore.toLocaleString()}`, '다시 시작');
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

function startGame(coop = false, isPeerJoin = false) {
  G.isCoop = coop;
  G.phase = 'play';
  G.t = 0;
  if (!isPeerJoin) {
    G.wave = 0;
    G.score = 0;
    G.kills = 0;
  }
  G.zombies.forEach(z => scene.remove(z.mesh.g));
  G.bullets.forEach(b => scene.remove(b.mesh.g));
  G.pickups.forEach(p => scene.remove(p.mesh.g));
  G.particles.forEach(p => scene.remove(p.mesh));
  for (const p of G.players) if (p?.mesh?.g) scene.remove(p.mesh.g);
  G.zombies = []; G.bullets = []; G.pickups = []; G.particles = [];
  G.players = [makePlayer(0)];
  if (coop) G.players.push(makePlayer(1));
  G.myIdx = isPeerJoin ? 1 : 0;
  menu.classList.add('hidden');
  hudEl.classList.remove('hidden');
  enterImmersive();
  ensureAudio();
  startMusic();
  if (!isPeerJoin) startWave(0);
  // First HUD draw
  hp2Card.classList.toggle('hidden', !coop);
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

// ============================================================
// NETWORK (P2P via PeerJS) — host runs simulation, peer sends input
// ============================================================
let peer = null, conn = null, isHost = false, connected = false;
let netLastSend = 0;
const NET_HZ_NUM = 25;
const peerInput = { mvX: 0, mvY: 0, aimX: 0, aimY: 0, aimLen: 0, useSlot: -1, useSuper: false };
const pendingEvents = []; // visual events to broadcast (shots, kills, etc.)
let pickupIdCounter = 1;

function randomCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function setupConn(c) {
  conn = c;
  conn.on('data', handleNetMsg);
  conn.on('close', () => onDisconnect());
  conn.on('error', () => onDisconnect());
  connected = true;
}
function onDisconnect() {
  connected = false;
  if (G.phase === 'play' || G.phase === 'rest') {
    stopMusic();
    showBanner('🔌 연결 끊김', '상대방과의 연결이 해제되었습니다', '메인 메뉴');
  }
}
function netSend(m) { if (conn && connected) try { conn.send(m); } catch {} }

function handleNetMsg(m) {
  if (!m || !m.t) return;
  if (m.t === 'state' && !isHost) applyNetState(m);
  else if (m.t === 'input' && isHost) {
    Object.assign(peerInput, m);
    if (m.shopBuy != null && m.shopBuy >= 0) applyShopBuy(m.shopBuy);
    if (m.shopSkip) closeShop();
  }
  else if (m.t === 'event') applyEvent(m.e);
}

function applyNetState(m) {
  const prevPhase = G.phase;
  const prevWave = G.wave;
  G.phase = m.ph;
  G.wave = m.wv;
  G.score = m.sc;
  G.kills = m.kl;
  G.toSpawnList.length = m.ts || 0; // for HUD remain counter
  // Sync theme on wave change (peer follows host)
  if (G.wave !== prevWave && G.wave >= 1 && G.wave <= WAVES.length) {
    const themeName = WAVES[G.wave - 1].theme || 'subway';
    applyTheme(themeName);
  }
  // Shop sync
  if (m.ph === 'shop' && m.sh) {
    const newCards = m.sh.c || [];
    const cardsChanged = (G.shopCards || []).join(',') !== newCards.join(',');
    G.shopCards = newCards;
    G.shopBought = m.sh.b || [];
    G.shopTimeLeft = m.sh.tl || 0;
    if (cardsChanged || !document.getElementById('shop')) {
      renderShop();
    } else {
      refreshShopCards();
      const n = document.getElementById('shopTimerN');
      if (n) n.textContent = G.shopTimeLeft;
    }
  } else if (prevPhase === 'shop' && m.ph !== 'shop') {
    const el = document.getElementById('shop');
    if (el) el.remove();
    G.shopCards = []; G.shopBought = [];
  }
  // Players
  for (let i = 0; i < 2; i++) {
    const sp = m.ps?.[i]; const p = G.players[i];
    if (!sp || !p) continue;
    p.x = sp.x; p.z = sp.z; p.a = sp.a;
    p.vx = sp.vx || 0; p.vz = sp.vz || 0;
    if (sp.wp != null) p.walkPhase = sp.wp;
    if (p.hp > sp.hp && i === G.myIdx) {
      // We took damage
      dmgFlashEl.classList.add('flash');
      setTimeout(() => dmgFlashEl.classList.remove('flash'), 60);
      shake(0.4);
      ensureAudio(); audio.dmg?.();
    }
    p.hp = sp.hp; p.alive = sp.al;
    p.super = sp.su; superDirty = true;
    p.dmgT = sp.dm; p.rapidT = sp.rp; p.shieldT = sp.sh; p.shotgunT = sp.sg;
    p.combo = sp.cb;
    const newInv0 = sp.i0 || null, newInv1 = sp.i1 || null;
    if (p.inv[0] !== newInv0) { p.inv[0] = newInv0; p.inv0Dirty = true; }
    if (p.inv[1] !== newInv1) { p.inv[1] = newInv1; p.inv1Dirty = true; }
    if (sp.hit && i !== G.myIdx) {} // optional remote hit feedback
  }
  // Zombies
  const ids = new Set();
  for (const sz of (m.zs || [])) {
    ids.add(sz.id);
    let z = G.zombies.find(o => o.id === sz.id);
    if (!z) {
      const mi = createZombieMesh(sz.t);
      scene.add(mi.g);
      z = { id: sz.id, type: sz.t, x: sz.x, z: sz.z, a: sz.a, hp: sz.hp, hpMax: ZTYPE[sz.t].hp, alive: true, deathT: 0, walkPhase: Math.random()*10, attackCD: 0, lungeT: 0, hitT: 0, mesh: mi };
      G.zombies.push(z);
    } else {
      if (z.hp > sz.hp) z.hitT = 0.14;
      z.x = sz.x; z.z = sz.z; z.a = sz.a; z.hp = sz.hp;
      z.alive = sz.hp > 0;
    }
  }
  for (let i = G.zombies.length - 1; i >= 0; i--) {
    const z = G.zombies[i];
    if (!ids.has(z.id) && z.alive) {
      z.alive = false; z.deathT = 0.001;
    }
  }
  // Pickups
  const pkIds = new Set();
  for (const spk of (m.pks || [])) {
    pkIds.add(spk.id);
    let pk = G.pickups.find(p => p.id === spk.id);
    if (!pk) {
      const mi = createPickupMesh(spk.t);
      mi.g.position.set(spk.x, 0, spk.z);
      scene.add(mi.g);
      G.pickups.push({ id: spk.id, x: spk.x, z: spk.z, type: spk.t, t: 0, mesh: mi });
    }
  }
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    if (!pkIds.has(G.pickups[i].id)) {
      scene.remove(G.pickups[i].mesh.g);
      G.pickups.splice(i, 1);
    }
  }
  // Events (visual VFX broadcast)
  for (const e of (m.evs || [])) applyEvent(e);
}

function applyEvent(e) {
  if (!e) return;
  if (e.t === 'shot') {
    // Spawn visual-only bullet on peer (via pool)
    const slot = _getBulletSlot();
    if (slot) {
      slot.active = true;
      slot.mesh.core.material.color.setHex(e.c || 0xffe27a);
      slot.mesh.trail.material.color.setHex(e.c || 0xffe27a);
      slot.mesh.g.position.set(e.x, 1.0, e.z);
      slot.mesh.g.visible = true;
      G.bullets.push({
        poolRef: slot,
        x: e.x, y: 1.0, z: e.z,
        vx: e.dx * BULLET_SPEED, vy: 0, vz: e.dz * BULLET_SPEED,
        life: BULLET_LIFE,
        dmg: 0, ownerIdx: e.o, crit: false,
        mesh: slot.mesh, visualOnly: true,
      });
    }
    if (e.o >= 0 && G.players[e.o]) G.players[e.o].mesh.muzzleFlashT = 0.08;
    audio?.shot?.();
  } else if (e.t === 'hit') {
    spawnHitParticles(e.x, e.y, e.z, e.c || 0xff4422, e.n || 5);
    spawnDmgNumber(e.x, e.y + 0.4, e.z, e.d, e.cr ? 'crit' : '');
    audio?.hit?.();
  } else if (e.t === 'kill') {
    spawnHitParticles(e.x, 1.0, e.z, 0xa01010, 14);
    spawnDmgNumber(e.x, 1.8, e.z, `+${e.s}` + (e.cb > 1 ? ` x${e.cb}` : ''), 'score');
    audio?.kill?.();
  } else if (e.t === 'pop') {
    spawnExplosion(e.x, 0.5, e.z, e.r);
    shake(0.7);
    audio?.boom?.();
  } else if (e.t === 'super') {
    spawnExplosion(e.x, 0.6, e.z, 6.5);
    shake(1.2);
    audio?.super?.();
  } else if (e.t === 'pickup') {
    spawnHitParticles(e.x, 0.8, e.z, e.c, 18);
    audio?.pickup?.();
  } else if (e.t === 'wave') {
    if (e.n != null) showWaveIntro(WAVES[e.n - 1] || { desc: '' }, e.n);
    audio?.wave?.();
  } else if (e.t === 'win') {
    audio?.win?.();
    showBanner('🏆 VICTORY', `${WAVES.length} 웨이브 클리어`, '메인 메뉴');
  } else if (e.t === 'lose') {
    audio?.lose?.();
    showBanner('💀 ELIMINATED', `웨이브 ${G.wave}에서 전멸`, '다시 시작');
  }
}

function netSendState() {
  if (!isHost || !connected) return;
  const psd = G.players.map(p => ({
    x: p.x, z: p.z, a: p.a, hp: p.hp, al: p.alive, su: p.super,
    vx: p.vx, vz: p.vz, wp: p.walkPhase,
    dm: p.dmgT, rp: p.rapidT, sh: p.shieldT, sg: p.shotgunT,
    cb: p.combo, i0: p.inv[0], i1: p.inv[1],
  }));
  const zsd = G.zombies.filter(z => z.alive).map(z => ({
    id: z.id, t: z.type, x: z.x, z: z.z, a: z.a, hp: z.hp,
  }));
  const pksd = G.pickups.map(p => ({ id: p.id, t: p.type, x: p.x, z: p.z }));
  const evs = pendingEvents.splice(0);
  const shopData = G.phase === 'shop' ? { c: G.shopCards, b: G.shopBought, tl: G.shopTimeLeft } : null;
  netSend({ t: 'state', ph: G.phase, wv: G.wave, sc: G.score, kl: G.kills, ts: G.toSpawnList.length, ps: psd, zs: zsd, pks: pksd, evs, sh: shopData });
}

function netSendInput() {
  if (isHost || !connected) return;
  const me = G.players[G.myIdx];
  if (!me) return;
  const inp = me.input || {};
  const msg = {
    t: 'input',
    mvX: inp.mvX || 0, mvY: inp.mvY || 0,
    aimX: inp.aimX || 0, aimY: inp.aimY || 0, aimLen: inp.aimLen || 0,
    useSlot: me.pendingUseSlot ?? -1,
    useSuper: me.pendingUseSuper ?? false,
    shopBuy: me.pendingShopBuy ?? -1,
    shopSkip: me.pendingShopSkip ? 1 : 0,
  };
  netSend(msg);
  me.pendingUseSlot = -1;
  me.pendingUseSuper = false;
  me.pendingShopBuy = -1;
  me.pendingShopSkip = false;
}

// Override input gathering to support peer input on host side
const _origUpdatePlayers = updatePlayers;
// (no override — we patch inside updatePlayers via G.isCoop check)

// Apply peer input on host: in updatePlayers, when looping, use peerInput for idx=1 if peer
// We adjust updatePlayers to read from inputs[i] map.

// ─── Menu actions ─────────────────────────────────────────────
function startHost() {
  menuMain.classList.add('hidden');
  menuHost.classList.remove('hidden');
  hostStatus.innerHTML = '<span class="spinner"></span> 서버에 연결 중…';
  let attempts = 0;
  function tryOpen() {
    const code = randomCode();
    peer = new Peer('dc-' + code, { debug: 1 });
    peer.on('open', () => {
      roomCodeEl.textContent = code;
      hostStatus.textContent = '코드 공유 후 P2 접속 대기 중…';
    });
    peer.on('connection', (c) => {
      isHost = true;
      setupConn(c);
      c.on('open', () => {
        hostStatus.textContent = '연결됨! 출격 준비…';
        setTimeout(() => startGame(true), 600);
      });
    });
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && attempts < 4) { attempts++; peer.destroy(); tryOpen(); }
      else hostStatus.textContent = '오류: ' + (err.type || err.message);
    });
  }
  tryOpen();
}
function startJoin() {
  menuMain.classList.add('hidden');
  menuJoin.classList.remove('hidden');
  joinInput.value = '';
  joinStatus.textContent = '';
  setTimeout(() => joinInput.focus(), 100);
}
function doJoin() {
  const code = (joinInput.value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) { joinStatus.textContent = '6자리 코드를 정확히 입력하세요'; return; }
  joinStatus.innerHTML = '<span class="spinner"></span> 연결 중…';
  peer = new Peer(undefined, { debug: 1 });
  peer.on('open', () => {
    const c = peer.connect('dc-' + code, { reliable: false, serialization: 'json' });
    c.on('open', () => {
      isHost = false;
      setupConn(c);
      joinStatus.textContent = '연결됨!';
      setTimeout(() => startGame(true, true), 400);
    });
    c.on('error', () => { joinStatus.textContent = '연결 실패'; });
  });
  peer.on('error', (err) => { joinStatus.textContent = '오류: ' + (err.type || err.message); });
}

$('btnSolo').addEventListener('click', () => startGame(false));
$('btnHost').addEventListener('click', () => startHost());
$('btnJoin').addEventListener('click', () => startJoin());
$('btnHostBack')?.addEventListener('click', () => {
  menuMain.classList.remove('hidden');
  menuHost.classList.add('hidden');
  if (peer) { peer.destroy(); peer = null; }
});
$('btnJoinBack')?.addEventListener('click', () => {
  menuMain.classList.remove('hidden');
  menuJoin.classList.add('hidden');
  if (peer) { peer.destroy(); peer = null; }
});
joinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
joinInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});
$('btnJoinConfirm').addEventListener('click', doJoin);

// ============================================================
// AUDIO / SETTINGS — extracted to ./src/audio.js and ./src/settings.js
// (Imports at top of this file.) Stub-out the duplicated definitions below:
const _STUB_audio_block = (() => null); _STUB_audio_block();
/*
function ensureAudio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  audio.shot   = () => { if (settings.sfx) playShot(); };
  audio.hit    = () => { if (settings.sfx) playHit(); };
  audio.kill   = () => { if (settings.sfx) playKill(); };
  audio.boom   = () => { if (settings.sfx) playBoom(); };
  audio.super  = () => { if (settings.sfx) playSuper(); };
  audio.pickup = () => { if (settings.sfx) playPickup(); };
  audio.wave   = () => { if (settings.sfx) playWave(); };
  audio.win    = () => { if (settings.sfx) playWin(); };
  audio.lose   = () => { if (settings.sfx) playLose(); };
  audio.dmg    = () => { if (settings.sfx) playDmg(); };
}
function tone(freq, dur, type = 'sine', vol = 0.18, when = 0) {
  if (!actx) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = vol;
  g.gain.setValueAtTime(vol, actx.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + when + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(actx.currentTime + when); o.stop(actx.currentTime + when + dur + 0.05);
}
function sweep(fromF, toF, dur, type = 'sawtooth', vol = 0.15) {
  if (!actx) return;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(fromF, actx.currentTime);
  o.frequency.exponentialRampToValueAtTime(toF, actx.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(); o.stop(actx.currentTime + dur + 0.05);
}
function noise(dur, vol = 0.18, filterFreq = 1200) {
  if (!actx) return;
  const bufferSize = Math.floor(actx.sampleRate * dur);
  const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = buffer;
  const f = actx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = actx.createGain();
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(actx.destination);
  src.start();
}
function playShot() {
  sweep(280, 80, 0.07, 'square', 0.10);
  noise(0.05, 0.12, 2400);
}
function playHit() {
  sweep(140, 60, 0.06, 'triangle', 0.13);
  noise(0.04, 0.08, 600);
}
function playKill() {
  sweep(220, 60, 0.18, 'square', 0.12);
  noise(0.1, 0.07, 800);
}
function playBoom() {
  sweep(200, 30, 0.45, 'sawtooth', 0.22);
  noise(0.4, 0.18, 600);
}
function playSuper() {
  sweep(180, 1200, 0.55, 'sawtooth', 0.18);
  sweep(80, 400, 0.8, 'triangle', 0.14);
  noise(0.5, 0.14, 1800);
}
function playPickup() {
  tone(440, 0.08, 'triangle', 0.16);
  tone(660, 0.08, 'triangle', 0.16, 0.05);
  tone(880, 0.12, 'triangle', 0.14, 0.1);
}
function playWave() {
  tone(220, 0.18, 'square', 0.14);
  tone(330, 0.22, 'square', 0.14, 0.12);
}
function playWin() {
  const notes = [392, 523, 659, 784, 988];
  notes.forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.12));
}
function playLose() {
  sweep(220, 60, 1.4, 'sawtooth', 0.18);
  noise(1.0, 0.10, 400);
}
function playDmg() {
  sweep(180, 80, 0.25, 'square', 0.16);
}

// ─── Music (looping procedural drone + beat) ─────────────────
let musicGain = null;
let musicOsc1 = null, musicOsc2 = null, musicLfo = null;
let musicBeatHandle = null;
function startMusic() {
  if (!settings.music) return;
  if (!actx || musicGain) return;
  musicGain = actx.createGain();
  musicGain.gain.value = 0.038;
  musicGain.connect(actx.destination);
  // Low drone (A1 + E2 fifth)
  musicOsc1 = actx.createOscillator();
  musicOsc1.type = 'sawtooth';
  musicOsc1.frequency.value = 55;
  const filter1 = actx.createBiquadFilter();
  filter1.type = 'lowpass'; filter1.frequency.value = 240; filter1.Q.value = 6;
  musicOsc1.connect(filter1); filter1.connect(musicGain);
  musicOsc1.start();
  musicOsc2 = actx.createOscillator();
  musicOsc2.type = 'sawtooth';
  musicOsc2.frequency.value = 82.5;
  const filter2 = actx.createBiquadFilter();
  filter2.type = 'lowpass'; filter2.frequency.value = 320; filter2.Q.value = 4;
  const g2 = actx.createGain(); g2.gain.value = 0.6;
  musicOsc2.connect(filter2); filter2.connect(g2); g2.connect(musicGain);
  musicOsc2.start();
  // LFO for tension
  musicLfo = actx.createOscillator();
  musicLfo.frequency.value = 0.18;
  const lfoGain = actx.createGain();
  lfoGain.gain.value = 0.012;
  musicLfo.connect(lfoGain);
  lfoGain.connect(musicGain.gain);
  musicLfo.start();
  // Beat: low kick every ~2 sec
  let beat = 0;
  musicBeatHandle = setInterval(() => {
    if (!actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(80, t);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.18);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + 0.2);
    // Hihat-ish at half-beat
    if (beat % 2 === 1) {
      const buf = actx.createBuffer(1, 0.05 * actx.sampleRate, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = actx.createBufferSource();
      s.buffer = buf;
      const f = actx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 4000;
      const gh = actx.createGain(); gh.gain.value = 0.08;
      s.connect(f); f.connect(gh); gh.connect(actx.destination);
      s.start();
    }
    beat++;
  }, 1100);
}
function stopMusic() {
  if (musicOsc1) { try { musicOsc1.stop(); } catch {}; musicOsc1 = null; }
  if (musicOsc2) { try { musicOsc2.stop(); } catch {}; musicOsc2 = null; }
  if (musicLfo) { try { musicLfo.stop(); } catch {}; musicLfo = null; }
  if (musicBeatHandle) { clearInterval(musicBeatHandle); musicBeatHandle = null; }
  musicGain = null;
}

// ─── Settings (localStorage) ──────────────────────────────────
const settings = { music: true, sfx: true, vibrate: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('dc_settings') || '{}')); } catch {}
function saveSettings() { try { localStorage.setItem('dc_settings', JSON.stringify(settings)); } catch {} }

// ─── Haptic vibration helper ──────────────────────────────────
function vib(ms) { if (settings.vibrate) try { navigator.vibrate?.(ms); } catch {} }

// ─── Best score persistence ───────────────────────────────────
const STORE_KEY = 'dc_best_v1';
function loadBest() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
  catch { return {}; }
}
*/
// End of stubbed-out audio/settings block
function showBest() {
  const cur = loadBest();
  if (!cur.bestScore) return;
  const el = document.createElement('div');
  el.style.cssText = 'font-size:10px;letter-spacing:0.28em;color:var(--text-muted);font-weight:700;margin-top:14px;';
  el.innerHTML = `BEST · <span style="color:var(--accent-gold);">${cur.bestScore.toLocaleString()}</span> · WAVE ${cur.bestWave}/${WAVES.length} · TOTAL KILLS ${cur.totalKills || 0}`;
  const left = document.getElementById('menuFeatures');
  if (left) left.parentNode.appendChild(el);
}
showBest();

// Wire local sound effects (single-player and host-side)
const _origFire = firePlayerWeapon;
function firePlayerWeapon_wrapped(p) {
  _origFire(p);
  ensureAudio();
  audio.shot?.();
  // Broadcast shot event
  const dx = Math.sin(p.a), dz = -Math.cos(p.a);
  const ox = p.x + dx * 0.6, oz = p.z + dz * 0.6;
  if (p.shotgunT > 0) {
    for (let i = -2; i <= 2; i++) {
      const a2 = p.a + i * 0.13;
      pendingEvents.push({ t: 'shot', x: ox, z: oz, dx: Math.sin(a2), dz: -Math.cos(a2), o: p.idx, c: 0xff7028 });
    }
  } else {
    pendingEvents.push({ t: 'shot', x: ox, z: oz, dx, dz, o: p.idx });
  }
}
// Replace
firePlayerWeapon = firePlayerWeapon_wrapped;

// Audio for damage taken
const _origDamage = damagePlayer;
function damagePlayer_wrapped(p, dmg, isCrit) {
  _origDamage(p, dmg, isCrit);
  if (p.idx === G.myIdx) audio.dmg?.();
}
damagePlayer = damagePlayer_wrapped;

// Audio for super activation (route to host on peer side)
const _origUseSuper = useSuper;
useSuper = function () {
  const p = G.players[G.myIdx];
  if (!p || !p.alive || p.super < SUPER_FULL) return;
  if (G.isCoop && !isHost) {
    p.pendingUseSuper = true;
    ensureAudio(); audio.super?.();  // optimistic feedback
  } else {
    _origUseSuper();
  }
};

// Item use (route to host on peer side)
const _origUseItem = useItem;
useItem = function (slot) {
  const me = G.players[G.myIdx];
  if (!me || !me.inv[slot]) return;
  if (G.isCoop && !isHost) {
    me.pendingUseSlot = slot;
    ensureAudio(); audio.pickup?.();  // optimistic feedback
  } else {
    _origUseItem(slot);
    ensureAudio(); audio.pickup?.();
  }
};

// ============================================================
// MAIN LOOP
// ============================================================
const amAuthoritative = () => !G.isCoop || isHost;

let prevT = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prevT) / 1000);
  prevT = now;
  // Atmospheric dust always animates (cheap)
  updateDust(dt);
  if (G.phase === 'menu') {
    tickHeroScene(dt);
  } else if (!paused && (G.phase === 'play' || G.phase === 'rest' || G.phase === 'shop')) {
    G.t += dt;
    gatherLocalInput();
    if (G.phase !== 'shop' && amAuthoritative()) {
      updatePlayers(dt);
      updateZombies(dt);
      updateBullets(dt);
      updateBulletsVsPlayers();
      updateParticles(dt);
      updateWave(dt);
    } else if (G.phase !== 'shop') {
      // Peer: visual-only bullet movement + particles
      updateBullets(dt);
      updateParticles(dt);
    }
    // Network (or clear stale events in solo)
    if (G.isCoop && connected && (now - netLastSend) > 1000 / NET_HZ_NUM) {
      if (isHost) netSendState(); else netSendInput();
      netLastSend = now;
    } else if (!G.isCoop) {
      pendingEvents.length = 0;
    }
    syncPlayerMeshes(dt);
    syncPickupMeshes(dt);
    if (G.phase !== 'shop') updateCamera(dt);
    updateHUD(dt);
  } else if (paused) {
    // While paused: still send heartbeat network state so peer doesn't desync hard
    if (G.isCoop && connected && (now - netLastSend) > 1000 / NET_HZ_NUM) {
      if (isHost) netSendState(); else netSendInput();
      netLastSend = now;
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ============================================================
// PAUSE + SETTINGS UI
// ============================================================
const pauseBtnEl = $('pauseBtn');
const pauseModalEl = $('pauseModal');
const btnResume = $('btnResume');
const btnToggleMusic = $('btnToggleMusic');
const btnToggleSfx = $('btnToggleSfx');
const btnToggleVib = $('btnToggleVib');
const btnQuit = $('btnQuit');
let paused = false;

function syncToggles() {
  const upd = (el, label, on) => {
    if (!el) return;
    el.textContent = `${label} : ${on ? 'ON' : 'OFF'}`;
    el.classList.toggle('off', !on);
  };
  upd(btnToggleMusic, '🎵 음악', settings.music);
  upd(btnToggleSfx,   '🔊 효과음', settings.sfx);
  upd(btnToggleVib,   '📳 진동',  settings.vibrate);
}
function openPause() {
  if (G.phase !== 'play' && G.phase !== 'rest' && G.phase !== 'shop') return;
  paused = true;
  const stats = `WAVE ${G.wave}/${WAVES.length} · SCORE ${G.score.toLocaleString()} · KILLS ${G.kills}`;
  $('pauseStats').textContent = stats;
  syncToggles();
  pauseModalEl.classList.remove('hidden');
}
function closePause() {
  paused = false;
  pauseModalEl.classList.add('hidden');
}
pauseBtnEl.addEventListener('click', openPause);
btnResume.addEventListener('click', closePause);
btnToggleMusic.addEventListener('click', () => {
  settings.music = !settings.music; saveSettings();
  if (settings.music) startMusic(); else stopMusic();
  syncToggles();
});
btnToggleSfx.addEventListener('click', () => {
  settings.sfx = !settings.sfx; saveSettings(); syncToggles();
});
btnToggleVib.addEventListener('click', () => {
  settings.vibrate = !settings.vibrate; saveSettings(); syncToggles();
  if (settings.vibrate) navigator.vibrate?.(20);
});
btnQuit.addEventListener('click', () => {
  stopMusic();
  saveBest();
  location.reload();
});

// Modify main loop to respect paused — patch via wrapping requestAnimationFrame.
// (Implemented by adding `paused` check inside the existing loop body.)
const _origLoop = loop;
// (loop already references runs render; we'll guard updates by reading `paused` flag.)

// ============================================================
// MENU HERO SCENE — animate lobby characters during menu
// ============================================================
let heroPlayer = null;
let heroZombies = [];
function setupHeroScene() {
  heroPlayer = createPlayerMesh(0);
  heroPlayer.g.position.set(2, 0, 2);
  heroPlayer.g.rotation.y = Math.PI * 1.2;
  scene.add(heroPlayer.g);
  const types = ['walker', 'runner', 'brute', 'spitter'];
  for (let i = 0; i < 4; i++) {
    const m = createZombieMesh(types[i]);
    const ang = Math.PI * 2 * (i / 4) + 0.3;
    const r = 8 + Math.random() * 2;
    m.g.position.set(Math.sin(ang) * r, 0, Math.cos(ang) * r + 2);
    m.g.rotation.y = ang + Math.PI;
    scene.add(m.g);
    heroZombies.push({ m, ang, r, t: Math.random() * 5, type: types[i] });
  }
  // Position camera for menu view (slightly different angle)
  camera.position.set(0, 28, 22);
  camera.lookAt(2, 0, 2);
}
function tickHeroScene(dt) {
  if (!heroPlayer) return;
  // Player slow rotate + idle bob
  heroPlayer.g.rotation.y += dt * 0.18;
  const t = performance.now() / 1000;
  heroPlayer.g.position.y = Math.abs(Math.sin(t * 2.4)) * 0.04;
  const swing = Math.sin(t * 2.0) * 0.06;
  heroPlayer.legL.rotation.x = swing;
  heroPlayer.legR.rotation.x = -swing;
  // Zombies orbit/shamble
  for (const z of heroZombies) {
    z.t += dt;
    z.ang += dt * 0.08;
    const r = z.r + Math.sin(z.t * 0.5) * 0.4;
    z.m.g.position.x = Math.sin(z.ang) * r;
    z.m.g.position.z = Math.cos(z.ang) * r + 2;
    z.m.g.position.y = Math.sin(z.t * 4) * 0.04 * ZTYPE[z.type].sz;
    z.m.g.rotation.y = z.ang + Math.PI;
    const ls = Math.sin(z.t * 4) * 0.18;
    z.m.legL.rotation.x = ls;
    z.m.legR.rotation.x = -ls;
    const asw = Math.sin(z.t * 2) * 0.1;
    z.m.armL.rotation.z = 0.22 + asw;
    z.m.armR.rotation.z = -0.22 - asw;
  }
}
function teardownHeroScene() {
  if (heroPlayer) { scene.remove(heroPlayer.g); heroPlayer = null; }
  for (const z of heroZombies) scene.remove(z.m.g);
  heroZombies = [];
}
setupHeroScene();

// Hook into startGame to remove hero scene
const _origStartGame = startGame;
startGame = function (coop, isPeerJoin) {
  teardownHeroScene();
  _origStartGame(coop, isPeerJoin);
};

// ============================================================
// SERVICE WORKER
// ============================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=3').catch(() => {});
  });
}
