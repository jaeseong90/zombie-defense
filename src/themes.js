// Per-wave arena themes — each builds: floor texture, prop layout, lighting palette.
// Pure Three.js mesh factories; takes shared helpers (tmat, outlined, IS_MOBILE) as deps.

import * as THREE from 'three';

// ─── Procedural floor textures ───────────────────────────────
export function makeSubwayFloor() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  // Concrete base
  g.fillStyle = '#262a32'; g.fillRect(0, 0, 1024, 1024);
  // Speckle grime
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${20+Math.random()*40}, ${20+Math.random()*30}, ${30+Math.random()*30}, ${Math.random() * 0.5})`;
    g.fillRect(Math.random()*1024, Math.random()*1024, 1.8, 1.8);
  }
  // Tile lines (horizontal)
  g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
  for (let y = 0; y <= 1024; y += 128) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke();
  }
  // Tile lines (vertical)
  for (let x = 0; x <= 1024; x += 128) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke();
  }
  // Yellow safety strip
  g.fillStyle = '#d4a72c';
  for (let x = 0; x < 1024; x += 32) {
    g.fillRect(x, 0, 22, 22);
    g.fillRect(x, 1002, 22, 22);
  }
  // Rail tracks (two parallel rails running across)
  g.fillStyle = '#5a5a64';
  g.fillRect(0, 320, 1024, 18);
  g.fillRect(0, 680, 1024, 18);
  // Sleepers (cross ties)
  g.fillStyle = '#3a2a1c';
  for (let x = -20; x < 1024; x += 56) {
    g.fillRect(x, 300, 36, 80);
    g.fillRect(x, 660, 36, 80);
  }
  // Rust + oil stains
  for (let i = 0; i < 50; i++) {
    const x = Math.random()*1024, y = Math.random()*1024, r = 8 + Math.random()*40;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(40, 20, 10, 0.4)');
    grad.addColorStop(1, 'rgba(20, 10, 5, 0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
  }
  return canvasToTex(c, 3);
}

export function makeHospitalFloor() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  // White tile base
  g.fillStyle = '#d8d6cc'; g.fillRect(0, 0, 1024, 1024);
  // Grime / cracks
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(${80+Math.random()*60}, ${80+Math.random()*50}, ${70+Math.random()*50}, ${Math.random() * 0.25})`;
    g.fillRect(Math.random()*1024, Math.random()*1024, 2.2, 2.2);
  }
  // Tile lines
  g.strokeStyle = 'rgba(80,80,90,0.55)'; g.lineWidth = 2.4;
  for (let y = 0; y <= 1024; y += 96) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke();
  }
  for (let x = 0; x <= 1024; x += 96) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke();
  }
  // Random cracks
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 22; i++) {
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath();
    let x = Math.random()*1024, y = Math.random()*1024;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random()-0.5)*120; y += (Math.random()-0.5)*120;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Blood splatter (LOTS)
  for (let i = 0; i < 60; i++) {
    const x = Math.random()*1024, y = Math.random()*1024, r = 6 + Math.random()*60;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(100, 14, 14, 0.6)');
    grad.addColorStop(0.6, 'rgba(70, 8, 8, 0.4)');
    grad.addColorStop(1, 'rgba(40, 5, 5, 0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
    // Spatter dots
    for (let j = 0; j < 6; j++) {
      const dx = (Math.random()-0.5) * r * 2.5;
      const dy = (Math.random()-0.5) * r * 2.5;
      g.fillStyle = `rgba(80, 8, 8, ${0.3 + Math.random()*0.3})`;
      g.beginPath(); g.arc(x+dx, y+dy, Math.random()*4, 0, Math.PI*2); g.fill();
    }
  }
  // Green safety stripes near edges
  g.fillStyle = '#3a8a4a';
  g.fillRect(0, 980, 1024, 6);
  g.fillRect(0, 38, 1024, 6);
  return canvasToTex(c, 4);
}

export function makeCarnivalFloor() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  // Red+white checker base
  const tile = 128;
  for (let y = 0; y < 1024; y += tile) {
    for (let x = 0; x < 1024; x += tile) {
      const isRed = ((x / tile) + (y / tile)) % 2 === 0;
      g.fillStyle = isRed ? '#7a1d2c' : '#d4c4a8';
      g.fillRect(x, y, tile, tile);
    }
  }
  // Sawdust + popcorn flecks
  for (let i = 0; i < 5000; i++) {
    const tone = Math.random();
    g.fillStyle = tone < 0.5
      ? `rgba(${200+Math.random()*40}, ${180+Math.random()*40}, ${100+Math.random()*60}, ${Math.random() * 0.7})`
      : `rgba(${80+Math.random()*40}, ${30+Math.random()*30}, ${20+Math.random()*30}, ${Math.random() * 0.5})`;
    g.fillRect(Math.random()*1024, Math.random()*1024, 1.6, 1.6);
  }
  // Confetti splotches
  const confettiCol = ['#ffd54f', '#42a5f5', '#66bb6a', '#ec407a', '#ab47bc'];
  for (let i = 0; i < 80; i++) {
    g.fillStyle = confettiCol[Math.floor(Math.random()*confettiCol.length)] + '99';
    const x = Math.random()*1024, y = Math.random()*1024;
    g.fillRect(x, y, 4 + Math.random()*8, 4 + Math.random()*8);
  }
  // Ringmaster star (faded)
  g.strokeStyle = 'rgba(255, 200, 100, 0.18)';
  g.lineWidth = 24;
  drawStar(g, 512, 512, 5, 280, 120);
  return canvasToTex(c, 2);
}

function drawStar(ctx, cx, cy, points, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function canvasToTex(canvas, repeat = 3) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ─── Theme prop builders ─────────────────────────────────────
// Each returns { mesh, w, d } that can be added to the prop list for collision.

function tm(color, opts = {}) {
  // Lightweight stand-in: a quick toon-ish material that doesn't need shared TOON_GRADIENT.
  // (Real builds pass tmat through opts.tmat — fallback to MeshStandardMaterial when missing.)
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15, ...opts });
}

// Subway: vending machine
function makeVendingMachine(x, z, tmat, outlined) {
  const g = new THREE.Group();
  const body = outlined(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.85, 0.7), tmat(0x3a4060)), 1.03);
  body.position.y = 0.92; g.add(body);
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.36, 0.04), tmat(0x0a0a14));
  front.position.set(0, 1.05, 0.37); g.add(front);
  // Glowing soda bottles row
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 8),
        new THREE.MeshBasicMaterial({ color: j === 0 ? 0xff6244 : 0x44a4ff }));
      bottle.position.set(-0.3 + i*0.2, 0.85 + j*0.35, 0.39);
      g.add(bottle);
    }
  }
  // Glowing logo
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xffe266, transparent: true, opacity: 0.95 }));
  logo.position.set(0, 1.65, 0.36); g.add(logo);
  g.position.set(x, 0, z);
  return { g, x, z, w: 0.5, d: 0.4, type: 'vending' };
}

function makeSubwayBench(x, z, tmat, outlined, rotY = 0) {
  const g = new THREE.Group();
  // Seat
  const seat = outlined(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.4), tmat(0x5a3a24)), 1.04);
  seat.position.y = 0.46; g.add(seat);
  // Back rest
  const back = outlined(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.46, 0.08), tmat(0x5a3a24)), 1.04);
  back.position.set(0, 0.7, -0.18); g.add(back);
  // Metal legs
  const lmat = tmat(0x2a2a30);
  for (const lx of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.4), lmat);
    leg.position.set(lx, 0.25, 0); g.add(leg);
  }
  g.position.set(x, 0, z); g.rotation.y = rotY;
  return { g, x, z, w: 0.85, d: 0.35, type: 'bench' };
}

function makeSubwayTicket(x, z, tmat, outlined, rotY = 0) {
  const g = new THREE.Group();
  const pole = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.4, 12), tmat(0x4a5a6a)), 1.04);
  pole.position.y = 0.7; g.add(pole);
  // Glowing yellow turnstile blade
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.06), tmat(0xd4a72c, { emissive: 0xd4a72c, emissiveIntensity: 0.4 }));
  arm.position.set(0.42, 1.0, 0); g.add(arm);
  g.position.set(x, 0, z); g.rotation.y = rotY;
  return { g, x, z, w: 0.5, d: 0.5, type: 'gate' };
}

// Hospital: IV stand, gurney, medical cart
function makeIVStand(x, z, tmat, outlined) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), tmat(0xc4c4cc, { metalness: 0.6 }));
  pole.position.y = 0.9; g.add(pole);
  // Wheel base
  const baseFloor = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.06, 14), tmat(0x202028));
  baseFloor.position.y = 0.03; g.add(baseFloor);
  // Hook hanger
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12), tmat(0xc4c4cc, { metalness: 0.7 }));
  hook.position.set(0, 1.8, 0); hook.rotation.x = Math.PI/2; g.add(hook);
  // IV bag (glowing)
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x88ff44, transparent: true, opacity: 0.85 }));
  bag.position.set(0, 1.5, 0); g.add(bag);
  // Drip tube
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), tmat(0xddddee));
  tube.position.set(0, 1.2, 0); g.add(tube);
  g.position.set(x, 0, z);
  return { g, x, z, w: 0.3, d: 0.3, type: 'iv' };
}

function makeGurney(x, z, tmat, outlined, rotY = 0) {
  const g = new THREE.Group();
  // Mattress
  const mat = outlined(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.8), tmat(0xddd6d0)), 1.03);
  mat.position.y = 0.78; g.add(mat);
  // Frame
  const fr = outlined(new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 0.86), tmat(0x4a4a52, { metalness: 0.5 })), 1.03);
  fr.position.y = 0.65; g.add(fr);
  // Legs / wheels
  const lmat = tmat(0x2a2a30, { metalness: 0.6 });
  for (const dx of [-0.85, 0.85]) for (const dz of [-0.32, 0.32]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), lmat);
    leg.position.set(dx, 0.32, dz); g.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), tmat(0x111118));
    wheel.position.set(dx, 0.08, dz); g.add(wheel);
  }
  // Headboard with red cross
  const head = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.7), tmat(0xeeeae4)), 1.03);
  head.position.set(-0.95, 1.05, 0); g.add(head);
  const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xff4242 }));
  cross1.position.set(-0.92, 1.05, 0); g.add(cross1);
  const cross2 = cross1.clone();
  cross2.geometry = new THREE.BoxGeometry(0.04, 0.06, 0.18);
  g.add(cross2);
  // Blood stain on mattress
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4),
    new THREE.MeshBasicMaterial({ color: 0x6a0a0a, transparent: true, opacity: 0.55 }));
  stain.rotation.x = -Math.PI/2; stain.position.set(0.3, 0.88, 0.1);
  g.add(stain);
  g.position.set(x, 0, z); g.rotation.y = rotY;
  return { g, x, z, w: 1.05, d: 0.45, type: 'gurney' };
}

function makeMedCart(x, z, tmat, outlined) {
  const g = new THREE.Group();
  // Box body
  const body = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.5), tmat(0xc4c4ce, { metalness: 0.45 })), 1.04);
  body.position.y = 0.55; g.add(body);
  // Drawers
  for (let i = 0; i < 3; i++) {
    const dr = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.22, 0.04), tmat(0x88888e));
    dr.position.set(0, 0.4 + i*0.26, 0.27); g.add(dr);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.03), tmat(0x404048));
    handle.position.set(0, 0.4 + i*0.26, 0.3); g.add(handle);
  }
  // Top tray with vials
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.5), tmat(0xeeeaee));
  tray.position.y = 1.04; g.add(tray);
  for (let i = -1; i <= 1; i++) {
    const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8),
      new THREE.MeshBasicMaterial({ color: i === 0 ? 0xa8ff60 : (i < 0 ? 0xff6088 : 0x88c4ff), transparent: true, opacity: 0.85 }));
    vial.position.set(i * 0.16, 1.15, 0.1); g.add(vial);
  }
  // Wheels
  for (const dx of [-0.3, 0.3]) for (const dz of [-0.2, 0.2]) {
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), tmat(0x111118));
    wheel.position.set(dx, 0.06, dz); g.add(wheel);
  }
  g.position.set(x, 0, z);
  return { g, x, z, w: 0.4, d: 0.3, type: 'cart' };
}

// Carnival: balloon pole, popcorn cart, banner pole
function makeBalloonPole(x, z, tmat, outlined) {
  const g = new THREE.Group();
  const pole = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), tmat(0x6a4a2a)), 1.04);
  pole.position.y = 1.2; g.add(pole);
  // Cluster of balloons on top
  const colors = [0xff4444, 0xffe266, 0x66c4ff, 0x66ff88, 0xff66c4];
  for (let i = 0; i < 5; i++) {
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshBasicMaterial({ color: colors[i] }));
    const a = (i / 5) * Math.PI * 2;
    balloon.position.set(Math.sin(a) * 0.16, 2.55 + Math.cos(i) * 0.08, Math.cos(a) * 0.16);
    g.add(balloon);
  }
  // Strings
  const sm = tmat(0x2a2a30);
  for (let i = 0; i < 5; i++) {
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4), sm);
    str.position.set(Math.sin(i) * 0.06, 2.2, Math.cos(i) * 0.06);
    g.add(str);
  }
  g.position.set(x, 0, z);
  return { g, x, z, w: 0.15, d: 0.15, type: 'balloon' };
}

function makePopcornCart(x, z, tmat, outlined) {
  const g = new THREE.Group();
  // Red+white striped cart body
  const body = outlined(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.85, 0.7), tmat(0xeeeae4)), 1.04);
  body.position.y = 0.65; g.add(body);
  // Stripes
  for (let i = 0; i < 4; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.86, 0.72), tmat(0xc02838));
    stripe.position.set(-0.45 + i*0.3, 0.65, 0); g.add(stripe);
  }
  // Glass dome with popcorn
  const dome = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.6 }));
  dome.position.y = 1.36; g.add(dome);
  // Popcorn (cluster of small white spheres inside dome)
  for (let i = 0; i < 12; i++) {
    const pop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff8d4 }));
    pop.position.set((Math.random()-0.5)*0.8, 1.2 + Math.random()*0.3, (Math.random()-0.5)*0.4);
    g.add(pop);
  }
  // Wheel
  for (const dx of [-0.45, 0.45]) {
    const wh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), tmat(0x2a1818));
    wh.position.set(dx, 0.13, 0); g.add(wh);
  }
  // Sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2),
    new THREE.MeshBasicMaterial({ color: 0xffe266 }));
  sign.position.set(0, 1.78, 0.36); g.add(sign);
  g.position.set(x, 0, z);
  return { g, x, z, w: 0.65, d: 0.4, type: 'popcorn' };
}

// ─── Internal arena structures (per-theme layout pieces) ────
// These are full-tall walls/columns/centerpieces that radically change the playground geometry.

function makeSubwayDivider(x, z, w, d, tmat, outlined) {
  // Long tile-clad subway platform wall
  const g = new THREE.Group();
  const wall = outlined(new THREE.Mesh(new THREE.BoxGeometry(w, 1.8, d), tmat(0x4a4254)), 1.03);
  wall.position.y = 0.9; g.add(wall);
  // Tile grid markings via stripes
  const stripeMat = tmat(0x1a1820);
  for (let yy = 0.3; yy < 1.7; yy += 0.45) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.04, d + 0.02), stripeMat);
    s.position.y = yy; g.add(s);
  }
  // Yellow safety strip at base
  const safetyStripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.06, d + 0.02), tmat(0xd4a72c, { emissive: 0xd4a72c, emissiveIntensity: 0.5 }));
  safetyStripe.position.y = 0.05; g.add(safetyStripe);
  g.position.set(x, 0, z);
  return { g, x, z, w: w / 2, d: d / 2, type: 'wall' };
}
function makeSubwayPillar(x, z, tmat, outlined) {
  const g = new THREE.Group();
  const col = outlined(new THREE.Mesh(new THREE.BoxGeometry(0.9, 3.4, 0.9), tmat(0x52465c)), 1.03);
  col.position.y = 1.7; g.add(col);
  // Two metal bands
  for (const yy of [0.6, 2.7]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.95), tmat(0x2a262e));
    band.position.y = yy; g.add(band);
  }
  // Glowing platform sign
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffd540 }));
  sign.position.set(0, 2.4, 0); g.add(sign);
  g.position.set(x, 0, z);
  return { g, x, z, w: 0.5, d: 0.5, type: 'pillar' };
}

function makeHospitalWall(x, z, w, d, tmat, outlined) {
  // Clinical wall with red cross signage
  const g = new THREE.Group();
  const wall = outlined(new THREE.Mesh(new THREE.BoxGeometry(w, 1.7, d), tmat(0xe2dcce)), 1.03);
  wall.position.y = 0.85; g.add(wall);
  // Green safety line at top
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.06, d + 0.02), tmat(0x3a8a4a, { emissive: 0x3a8a4a, emissiveIntensity: 0.4 }));
  trim.position.y = 1.66; g.add(trim);
  // Red cross emblems on longer side
  if (w > 4) {
    for (let dx = -w/2 + 1.5; dx <= w/2 - 1.5; dx += 3.5) {
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.14), new THREE.MeshBasicMaterial({ color: 0xff3a3a }));
      cross1.position.set(dx, 1.0, d / 2 + 0.01); g.add(cross1);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3a3a }));
      cross2.position.set(dx, 1.0, d / 2 + 0.01); g.add(cross2);
    }
  }
  // Blood drip
  const drip = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), new THREE.MeshBasicMaterial({ color: 0x6a0a0a, transparent: true, opacity: 0.55 }));
  drip.position.set(Math.random() * w * 0.4 - w * 0.2, 0.95, d / 2 + 0.011);
  g.add(drip);
  g.position.set(x, 0, z);
  return { g, x, z, w: w / 2, d: d / 2, type: 'wall' };
}

function makeCarnivalCarousel(x, z, tmat, outlined) {
  // Central rotating carousel-style structure
  const g = new THREE.Group();
  // Base disc
  const base = outlined(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.4, 24), tmat(0x6a1828)), 1.02);
  base.position.y = 0.2; g.add(base);
  // Striped center post
  const post = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.6, 16), tmat(0xeeeae4)), 1.03);
  post.position.y = 2.0; g.add(post);
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.5, 16), tmat(0xc02838));
    s.position.y = 0.4 + i * 0.6; g.add(s);
  }
  // Striped canopy roof
  const canopy = outlined(new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 12, 1, false), tmat(0xc02838)), 1.03);
  canopy.position.y = 4.3; g.add(canopy);
  // Canopy white stripes
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(new THREE.ConeGeometry(2.84, 1.24, 3, 1, true, (i / 6) * Math.PI * 2 + 0.5, Math.PI / 6), tmat(0xeeeae4));
    stripe.position.y = 4.3; g.add(stripe);
  }
  // Top sphere with star
  const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), tmat(0xffd540, { emissive: 0xffd540, emissiveIntensity: 0.5 }));
  topBall.position.y = 5.1; g.add(topBall);
  // Carousel horses (4 simple chibi shapes around the post)
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const horse = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.9), tmat(0xeeeae4));
    body.position.y = 1.3; horse.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.4), tmat(0xeeeae4));
    head.position.set(0, 1.65, -0.55); horse.add(head);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.3), tmat(0xc02838));
    mane.position.set(0, 1.78, -0.45); horse.add(mane);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.92), tmat(0xc02838));
    stripe.position.y = 1.4; horse.add(stripe);
    horse.position.set(Math.sin(a) * 1.6, 0, Math.cos(a) * 1.6);
    horse.rotation.y = a;
    g.add(horse);
  }
  g.position.set(x, 0, z);
  return { g, x, z, w: 2.6, d: 2.6, type: 'carousel' };
}

function makeCarnivalTent(x, z, color, tmat, outlined) {
  const g = new THREE.Group();
  // Striped tent
  const tent = outlined(new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.6, 12, 1), tmat(color)), 1.03);
  tent.position.y = 1.3; g.add(tent);
  // White stripes (visual only)
  for (let i = 0; i < 6; i++) {
    const stripe = new THREE.Mesh(new THREE.ConeGeometry(2.04, 2.65, 3, 1, true, (i / 6) * Math.PI * 2 + 0.5, Math.PI / 6), tmat(0xeeeae4));
    stripe.position.y = 1.3; g.add(stripe);
  }
  // Top pennant
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ color: 0xffe266, side: THREE.DoubleSide }));
  pennant.position.set(0.25, 2.7, 0); pennant.rotation.y = Math.PI/4; g.add(pennant);
  // Entrance arch (dark)
  const arch = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.05), tmat(0x111118));
  arch.position.set(0, 0.45, 1.5); g.add(arch);
  g.position.set(x, 0, z);
  return { g, x, z, w: 1.4, d: 1.4, type: 'tent' };
}

function makeCarnivalLamp(x, z, tmat, outlined) {
  const g = new THREE.Group();
  const pole = outlined(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 8), tmat(0x2a1010)), 1.04);
  pole.position.y = 1.4; g.add(pole);
  // Tilted lantern shade
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 6),
    new THREE.MeshBasicMaterial({ color: 0xc02838 }));
  shade.position.set(0, 2.7, 0); shade.rotation.x = 0.15;
  g.add(shade);
  // Glowing bulb
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe266 }));
  bulb.position.set(0, 2.45, 0.1);
  g.add(bulb);
  g.position.set(x, 0, z);
  return { g, x, z, w: 0.12, d: 0.12, type: 'lamp' };
}

// ─── Theme registry ──────────────────────────────────────────
export const THEMES = {
  subway: {
    name: 'SUBWAY',
    floorTex: makeSubwayFloor,
    floorColor: 0xb09090,
    wallColor: 0x2a2030,
    pillarColor: 0x3a1f30,
    pillarCapColor: 0xffd54f,
    bgColor: 0x0a0c16,
    fogColor: 0x1a1e2a,
    fogDensity: 0.020,
    keyColor: 0xfff0c0, keyIntensity: 1.05,
    rimColor: 0xff8b3a, rimIntensity: 0.5,
    ambient: 0x2a2030,
    ringColor: 0xd4a72c,
    propBuilder: (tmat, outlined) => [
      // Two long subway-style dividing walls create three "tracks" (north/center/south lanes)
      makeSubwayDivider(-10, -7.5, 12, 0.8, tmat, outlined),
      makeSubwayDivider( 10, -7.5, 12, 0.8, tmat, outlined),
      makeSubwayDivider(-10,  7.5, 12, 0.8, tmat, outlined),
      makeSubwayDivider( 10,  7.5, 12, 0.8, tmat, outlined),
      // Platform pillars (along center lane, but leaving spawn area at origin open)
      makeSubwayPillar(-14, 0, tmat, outlined),
      makeSubwayPillar( 14, 0, tmat, outlined),
      makeSubwayPillar(-10, 0, tmat, outlined),
      makeSubwayPillar( 10, 0, tmat, outlined),
      // Decor
      makeVendingMachine(-12, -12, tmat, outlined),
      makeVendingMachine( 12, -12, tmat, outlined),
      makeSubwayBench(-12,  12, tmat, outlined, 0),
      makeSubwayBench( 12,  12, tmat, outlined, 0),
      makeSubwayTicket(-3, -13, tmat, outlined, 0),
      makeSubwayTicket( 3, -13, tmat, outlined, 0),
      makeSubwayTicket(-3,  13, tmat, outlined, 0),
      makeSubwayTicket( 3,  13, tmat, outlined, 0),
    ],
  },

  hospital: {
    name: 'HOSPITAL',
    floorTex: makeHospitalFloor,
    floorColor: 0xeeeae0,
    wallColor: 0xc4c4ca,
    pillarColor: 0x9a9aa4,
    pillarCapColor: 0x3a8a4a,
    bgColor: 0x121420,
    fogColor: 0x162818,
    fogDensity: 0.040,
    keyColor: 0xeaffe8, keyIntensity: 1.25,
    rimColor: 0x88ff66, rimIntensity: 0.5,
    ambient: 0x303a2c,
    ringColor: 0x6affa0,
    propBuilder: (tmat, outlined) => [
      // Cross-shape internal walls dividing arena into 4 wards with central passage
      makeHospitalWall( 0, -10, 0.8, 8,  tmat, outlined),   // vertical, top
      makeHospitalWall( 0,  10, 0.8, 8,  tmat, outlined),   // vertical, bottom
      makeHospitalWall(-10, 0, 8,   0.8, tmat, outlined),   // horizontal, left
      makeHospitalWall( 10, 0, 8,   0.8, tmat, outlined),   // horizontal, right
      // Beds in each ward
      makeGurney(-10, -8, tmat, outlined, 0),
      makeGurney( 10, -8, tmat, outlined, Math.PI),
      makeGurney(-10,  8, tmat, outlined, 0),
      makeGurney( 10,  8, tmat, outlined, Math.PI),
      makeGurney(-6, -3, tmat, outlined, Math.PI/2),
      makeGurney( 6,  3, tmat, outlined, -Math.PI/2),
      // IV stands and carts scattered
      makeIVStand(-7, -7, tmat, outlined),
      makeIVStand( 7, -7, tmat, outlined),
      makeIVStand(-7,  7, tmat, outlined),
      makeIVStand( 7,  7, tmat, outlined),
      makeIVStand(-12,  3, tmat, outlined),
      makeIVStand( 12, -3, tmat, outlined),
      makeMedCart(-5, 12, tmat, outlined),
      makeMedCart( 5, -12, tmat, outlined),
      makeMedCart(-12, -3, tmat, outlined),
      makeMedCart( 12,  3, tmat, outlined),
    ],
  },

  carnival: {
    name: 'CARNIVAL',
    floorTex: makeCarnivalFloor,
    floorColor: 0xeeeae4,
    wallColor: 0x6a1a2a,
    pillarColor: 0xc02838,
    pillarCapColor: 0xffe266,
    bgColor: 0x180410,
    fogColor: 0x2a0610,
    fogDensity: 0.024,
    keyColor: 0xfff0d0, keyIntensity: 1.2,
    rimColor: 0xff66aa, rimIntensity: 0.6,
    ambient: 0x4a1828,
    ringColor: 0xffd540,
    propBuilder: (tmat, outlined) => [
      // Central showpiece: striped carousel — must navigate around it
      makeCarnivalCarousel(0, 0, tmat, outlined),
      // Four corner tents (different colors)
      makeCarnivalTent(-11, -11, 0xc02838, tmat, outlined),
      makeCarnivalTent( 11, -11, 0x42a5f5, tmat, outlined),
      makeCarnivalTent(-11,  11, 0x66bb6a, tmat, outlined),
      makeCarnivalTent( 11,  11, 0xab47bc, tmat, outlined),
      // Stalls + decor around perimeter
      makePopcornCart(-8, -13, tmat, outlined),
      makePopcornCart( 8,  13, tmat, outlined),
      makeBalloonPole(-13, -3, tmat, outlined),
      makeBalloonPole( 13,  3, tmat, outlined),
      makeBalloonPole(-3, -13, tmat, outlined),
      makeBalloonPole( 3,  13, tmat, outlined),
      makeCarnivalLamp(-7,  5, tmat, outlined),
      makeCarnivalLamp( 7, -5, tmat, outlined),
      makeCarnivalLamp(-13, 13, tmat, outlined),
      makeCarnivalLamp( 13, -13, tmat, outlined),
    ],
  },
};
