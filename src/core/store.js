import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SAVE_FILE } from './paths.js';
import { ROSTER, getSpeciesByKey, stageForLevel } from './roster.js';
import { levelForXp, trimSeenIds } from './xp-engine.js';
import { normalizeGymBadges } from './gym-challenge.js';

export function defaultState() {
  return {
    species: null, level: 1, xp: 0, stage: 0,
    dailyXp: 0, dailyDate: null, seenIds: [],
    locked: false, rolledAt: null, lastActiveAt: null, lastSessionTs: 0,
    hatched: false, // 최초엔 알 상태. 부화("!" 클릭) 시에만 종이 랜덤 결정된다.
    battleProfile: null,
    gymBadges: [],
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
  // seenIds도 여기서 함께 정규화 — 이미 커진 기존 세이브가 로드/저장 한 번으로 회복된다.
  return {
    ...state,
    level,
    stage,
    seenIds: trimSeenIds(state.seenIds),
    gymBadges: normalizeGymBadges(state.gymBadges),
  };
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
  // 손상(비객체) 시에만 백업 후 초기화. (개인용 — 서명/치팅 방지 없음)
  if (!parsed || typeof parsed !== 'object') return backupAndReset();
  // level/stage는 항상 xp에서 재계산(저장값 신뢰 안 함 — 손상/실수 방지 목적).
  return recompute({ ...defaultState(), ...parsed });
}

export function saveState(dir, state) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, SAVE_FILE), JSON.stringify(recompute(state), null, 2));
}

export function rollStarter(state, rng = Math.random) {
  if (state.locked) return state;
  const pick = ROSTER[Math.floor(rng() * ROSTER.length)];
  return { ...state, species: pick.key, locked: true, rolledAt: Date.now() };
}
