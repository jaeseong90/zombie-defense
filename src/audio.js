// Procedural Web Audio: shot/hit/kill/boom/super/pickup/wave/win/lose/dmg
// + looping music (bass drone + kick + hat)
// Respects user settings (sfx/music toggles).

import { settings } from './settings.js';

export const audio = {};
let actx = null;

export function ensureAudio() {
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
function playShot()  { sweep(280, 80, 0.07, 'square', 0.10);   noise(0.05, 0.12, 2400); }
function playHit()   { sweep(140, 60, 0.06, 'triangle', 0.13); noise(0.04, 0.08, 600); }
function playKill()  { sweep(220, 60, 0.18, 'square', 0.12);   noise(0.1,  0.07, 800); }
function playBoom()  { sweep(200, 30, 0.45, 'sawtooth', 0.22); noise(0.4,  0.18, 600); }
function playSuper() { sweep(180, 1200, 0.55, 'sawtooth', 0.18); sweep(80, 400, 0.8, 'triangle', 0.14); noise(0.5, 0.14, 1800); }
function playPickup() { tone(440, 0.08, 'triangle', 0.16); tone(660, 0.08, 'triangle', 0.16, 0.05); tone(880, 0.12, 'triangle', 0.14, 0.1); }
function playWave() { tone(220, 0.18, 'square', 0.14); tone(330, 0.22, 'square', 0.14, 0.12); }
function playWin()  { [392, 523, 659, 784, 988].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.12)); }
function playLose() { sweep(220, 60, 1.4, 'sawtooth', 0.18); noise(1.0, 0.10, 400); }
function playDmg()  { sweep(180, 80, 0.25, 'square', 0.16); }

// ─── Looping music (bass drone + kick + hat) ──────────────────
let musicGain = null;
let musicOsc1 = null, musicOsc2 = null, musicLfo = null;
let musicBeatHandle = null;
export function startMusic() {
  if (!settings.music) return;
  if (!actx || musicGain) return;
  musicGain = actx.createGain();
  musicGain.gain.value = 0.038;
  musicGain.connect(actx.destination);

  musicOsc1 = actx.createOscillator();
  musicOsc1.type = 'sawtooth'; musicOsc1.frequency.value = 55;
  const filter1 = actx.createBiquadFilter();
  filter1.type = 'lowpass'; filter1.frequency.value = 240; filter1.Q.value = 6;
  musicOsc1.connect(filter1); filter1.connect(musicGain); musicOsc1.start();

  musicOsc2 = actx.createOscillator();
  musicOsc2.type = 'sawtooth'; musicOsc2.frequency.value = 82.5;
  const filter2 = actx.createBiquadFilter();
  filter2.type = 'lowpass'; filter2.frequency.value = 320; filter2.Q.value = 4;
  const g2 = actx.createGain(); g2.gain.value = 0.6;
  musicOsc2.connect(filter2); filter2.connect(g2); g2.connect(musicGain); musicOsc2.start();

  musicLfo = actx.createOscillator();
  musicLfo.frequency.value = 0.18;
  const lfoGain = actx.createGain();
  lfoGain.gain.value = 0.012;
  musicLfo.connect(lfoGain); lfoGain.connect(musicGain.gain); musicLfo.start();

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
    if (beat % 2 === 1) {
      const buf = actx.createBuffer(1, 0.05 * actx.sampleRate, actx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = actx.createBufferSource(); s.buffer = buf;
      const f = actx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 4000;
      const gh = actx.createGain(); gh.gain.value = 0.08;
      s.connect(f); f.connect(gh); gh.connect(actx.destination); s.start();
    }
    beat++;
  }, 1100);
}
export function setMusicTone(rootHz, fifthHz) {
  if (!actx || !musicOsc1 || !musicOsc2) return;
  const now = actx.currentTime;
  musicOsc1.frequency.cancelScheduledValues(now);
  musicOsc2.frequency.cancelScheduledValues(now);
  musicOsc1.frequency.setTargetAtTime(rootHz, now, 0.6);
  musicOsc2.frequency.setTargetAtTime(fifthHz, now, 0.6);
}
export function stopMusic() {
  if (musicOsc1) { try { musicOsc1.stop(); } catch {} musicOsc1 = null; }
  if (musicOsc2) { try { musicOsc2.stop(); } catch {} musicOsc2 = null; }
  if (musicLfo)  { try { musicLfo.stop();  } catch {} musicLfo  = null; }
  if (musicBeatHandle) { clearInterval(musicBeatHandle); musicBeatHandle = null; }
  musicGain = null;
}
