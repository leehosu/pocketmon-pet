import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SAVE_FILE } from './paths.js';
import { ROSTER, getSpeciesByKey, stageForLevel } from './roster.js';
import { levelForXp } from './xp-engine.js';
import { sign, verify } from './integrity.js';

export function defaultState() {
  return {
    species: null, level: 1, xp: 0, stage: 0,
    dailyXp: 0, dailyDate: null, seenIds: [],
    locked: false, rolledAt: null, lastActiveAt: null, lastSessionTs: 0,
  };
}

// level/stage는 저장 authority가 아니다 — 항상 xp에서 재계산.
function recompute(state) {
  const level = levelForXp(state.xp || 0);
  const species = getSpeciesByKey(state.species);
  const stage = species ? stageForLevel(species, level) : 0;
  return { ...state, level, stage };
}

export function loadState(dir) {
  const file = join(dir, SAVE_FILE);
  if (!existsSync(file)) return defaultState();
  const backupAndReset = () => {
    try { renameSync(file, file + '.bak'); } catch { /* ignore */ }
    return defaultState();
  };
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { return backupAndReset(); }
  // 서명 형식이 아니거나 검증 실패 → 조작/손상으로 간주해 초기화
  if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !('sig' in parsed)) {
    return backupAndReset();
  }
  if (!verify(parsed.data, parsed.sig)) return backupAndReset();
  return recompute({ ...defaultState(), ...parsed.data });
}

export function saveState(dir, state) {
  mkdirSync(dir, { recursive: true });
  const data = recompute(state);
  writeFileSync(join(dir, SAVE_FILE), JSON.stringify({ data, sig: sign(data) }, null, 2));
}

export function rollStarter(state, rng = Math.random) {
  if (state.locked) return state;
  const pick = ROSTER[Math.floor(rng() * ROSTER.length)];
  return { ...state, species: pick.key, locked: true, rolledAt: Date.now() };
}
