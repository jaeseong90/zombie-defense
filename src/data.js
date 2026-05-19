// Pure data — no Three.js or DOM deps
// Game constants, enemy/pickup specs, wave configs, upgrade pool.

export const ARENA = 32;
export const PLAYER_R = 0.55;
export const PLAYER_SPEED = 8.6;
export const PLAYER_HP_MAX = 100;
export const PLAYER_REGEN_DELAY = 3.5;
export const PLAYER_REGEN_RATE = 7;
export const BASE_FIRE_INT = 0.11;
export const BASE_DMG = 18;
export const BULLET_SPEED = 32;
export const BULLET_LIFE = 0.85;
export const SUPER_FULL = 100;
export const SPAWN_INT = 0.42;
export const REST_TIME = 5.0;
export const PICKUP_DROP = 0.13;
export const MAX_ZOMBIES = 24;

export const ZTYPE = {
  walker:  { hp: 36,  spd: 2.4, dmg: 8,  atkInt: 1.0, atkR: 1.2, sz: 1.0,  score: 10, body: 0x7ab23f, dark: 0x42651e, skin: 0xcad97a, eye: 0xff3322, name: 'WALKER' },
  runner:  { hp: 22,  spd: 5.0, dmg: 6,  atkInt: 0.7, atkR: 1.1, sz: 0.85, score: 18, body: 0xd83a4f, dark: 0x6a1518, skin: 0xf08080, eye: 0xff8800, name: 'RUNNER' },
  spitter: { hp: 38,  spd: 1.8, dmg: 14, atkInt: 1.8, atkR: 12.0, sz: 1.05, score: 24, body: 0x4eb238, dark: 0x215a1a, skin: 0xa8e060, eye: 0x88ff44, name: 'SPITTER', ranged: true, projSpd: 14, projDmg: 14 },
  bomber:  { hp: 18,  spd: 3.8, dmg: 0,  atkInt: 0.1, atkR: 1.4, sz: 0.95, score: 22, body: 0xff7028, dark: 0x802a0e, skin: 0xffc070, eye: 0xff4400, name: 'BOMBER', explodes: true, expDmg: 36, expR: 3.2 },
  brute:   { hp: 220, spd: 1.4, dmg: 26, atkInt: 1.4, atkR: 1.6, sz: 1.85, score: 80, body: 0x556b3e, dark: 0x1f2818, skin: 0x8c7f4a, eye: 0xff0044, name: 'BRUTE' },
};

export const PICKUP = {
  hp:      { name: 'MEDKIT',  color: 0x3ddc84, em: 0x2ecc71, icon: '❤', instant: true,  hpRestore: 40 },
  dmg:     { name: 'DAMAGE',  color: 0xb46bff, em: 0x9038ff, icon: '⚡', dur: 12, key: 'dmgT'   },
  rapid:   { name: 'RAPID',   color: 0xffeb3b, em: 0xffc107, icon: '🔥', dur: 12, key: 'rapidT' },
  shotgun: { name: 'SHOTGUN', color: 0xff7028, em: 0xff5a3a, icon: '💥', dur: 14, key: 'shotgunT' },
  shield:  { name: 'SHIELD',  color: 0x4a9eff, em: 0x6ab4ff, icon: '🛡', dur: 8,  key: 'shieldT' },
};

// 3-wave campaign, one theme per wave
export const WAVES = [
  {
    theme: 'subway',  desc: '지하철 침투',
    walker: 8, runner: 3, spitter: 0, bomber: 0, brute: 0,
    event: null,
  },
  {
    theme: 'hospital', desc: '오염 병동',
    walker: 8, runner: 5, spitter: 3, bomber: 2, brute: 0,
    event: 'fog',
  },
  {
    theme: 'carnival', desc: '최종 항전',
    walker: 10, runner: 8, spitter: 4, bomber: 4, brute: 3,
    boss: true, event: 'final',
  },
];

export const UPGRADES = [
  { id: 'maxhp',  icon: '❤', name: '+ MAX HP',       desc: '+25 최대 HP, 지금 +25 회복',     apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'dmg',    icon: '⚔', name: 'WEAPON UP',      desc: '+25% 데미지 (영구)',                  apply: (p) => { p.dmgMult *= 1.25; } },
  { id: 'fire',   icon: '🔫', name: 'TRIGGER FINGER', desc: '+15% 사격 속도 (영구)',           apply: (p) => { p.fireMult *= 0.85; } },
  { id: 'heal',   icon: '➕', name: 'FIELD MEDIC',    desc: '풀피, 재생력 +40%',                   apply: (p) => { p.hp = p.maxHp; p.regenMult *= 1.4; } },
  { id: 'super',  icon: '⚡', name: 'PRIMED',         desc: '슈퍼 충전 +30%',                          apply: (p) => { p.superGainMult *= 1.3; } },
  { id: 'combo',  icon: '🎯', name: 'COMBO BOOST',    desc: '콤보 배율 +0.5',                          apply: (p) => { p.comboBonus += 0.5; } },
  { id: 'speed',  icon: '👢', name: 'SWIFT BOOTS',    desc: '+12% 이동 속도',                          apply: (p) => { p.speedMult *= 1.12; } },
  { id: 'shield', icon: '🛡', name: 'WAVE SHIELD',    desc: '매 웨이브 시작 3초 쉴드', apply: (p) => { p.startShield = (p.startShield || 0) + 3; } },
];

export function comboMultiplier(c, bonus = 0) {
  let m;
  if (c <= 1) m = 1;
  else if (c <= 3) m = 1.5;
  else if (c <= 5) m = 2;
  else m = 2.5;
  return m + bonus;
}
