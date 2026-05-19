// Persistent settings + haptic + best-score storage.
// Pure JS, no Three.js / DOM beyond localStorage.

export const settings = { music: true, sfx: true, vibrate: true };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('dc_settings') || '{}'));
} catch {}
export function saveSettings() {
  try { localStorage.setItem('dc_settings', JSON.stringify(settings)); } catch {}
}

export function vib(ms) {
  if (!settings.vibrate) return;
  try { navigator.vibrate?.(ms); } catch {}
}

const BEST_KEY = 'dc_best_v1';
export function loadBest() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); }
  catch { return {}; }
}
export function saveBest(score, wave, kills) {
  const cur = loadBest();
  if (!cur.bestScore || score > cur.bestScore) cur.bestScore = score;
  if (!cur.bestWave  || wave  > cur.bestWave)  cur.bestWave  = wave;
  cur.totalKills = (cur.totalKills || 0) + kills;
  cur.totalRuns  = (cur.totalRuns  || 0) + 1;
  try { localStorage.setItem(BEST_KEY, JSON.stringify(cur)); } catch {}
  return cur;
}
