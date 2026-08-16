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
    hatched: false, // 최초엔 알 상태. 부화("!" 클릭) 시에만 종이 랜덤 결정된다.
  };
}

// level은 항상 xp에서 재계산(저장 authority 아님).
// stage는 사용자 클릭 진화로만 오르므로 강제 상승시키지 않고, 레벨이 허용하는 최대치로만
// clamp한다(치팅으로 과도하게 올린 값 방어). 저장된 stage(사용자 진화 결과)는 유지.
function recompute(state) {
  const level = levelForXp(state.xp || 0);
  const species = getSpeciesByKey(state.species);
  const maxStage = species ? stageForLevel(species, level) : 0;
  const stage = Math.max(0, Math.min(state.stage || 0, maxStage));
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
