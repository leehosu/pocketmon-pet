// AI-GENERATED: 영속 DV/stat EXP와 야생전 결과를 관리한다.
import { addStatExp, normalizeDvs, normalizeStatExp } from './gen2-stats.js';
import { getGen2Species } from './gen2-data.js';

export const LOSS_COOLDOWN_MS = 10 * 60 * 1000;

function randomDv(rng) {
  const value = Number(rng());
  return Math.max(0, Math.min(15, Math.floor((Number.isFinite(value) ? value : 0) * 16)));
}

export function createBattleProfile(rng = Math.random) {
  return {
    dvs: {
      attack: randomDv(rng),
      defense: randomDv(rng),
      speed: randomDv(rng),
      special: randomDv(rng),
    },
    statExp: { hp: 0, attack: 0, defense: 0, speed: 0, special: 0 },
    wins: 0,
    losses: 0,
    encounterCooldownUntil: 0,
  };
}

export function normalizeBattleProfile(profile) {
  if (!profile?.dvs) return null;
  return {
    dvs: normalizeDvs(profile.dvs),
    statExp: normalizeStatExp(profile.statExp),
    wins: Math.max(0, Math.floor(Number(profile.wins) || 0)),
    losses: Math.max(0, Math.floor(Number(profile.losses) || 0)),
    encounterCooldownUntil: Math.max(0, Math.floor(Number(profile.encounterCooldownUntil) || 0)),
  };
}

export function ensureBattleProfile(state, rng = Math.random) {
  if (!state?.hatched) return state;
  const normalized = normalizeBattleProfile(state.battleProfile);
  if (normalized && JSON.stringify(normalized) === JSON.stringify(state.battleProfile)) return state;
  return { ...state, battleProfile: normalized || createBattleProfile(rng) };
}

export function recordBattleVictory(profile, defeatedSpeciesId) {
  const normalized = normalizeBattleProfile(profile) || createBattleProfile(() => 0);
  return {
    ...normalized,
    statExp: addStatExp(normalized.statExp, defeatedSpeciesId),
    wins: normalized.wins + 1,
  };
}

export function recordBattleLoss(profile, now = Date.now()) {
  const normalized = normalizeBattleProfile(profile) || createBattleProfile(() => 0);
  return {
    ...normalized,
    losses: normalized.losses + 1,
    encounterCooldownUntil: Math.floor(now) + LOSS_COOLDOWN_MS,
  };
}

export function wildBattleExperience(speciesId, level) {
  const species = getGen2Species(speciesId);
  if (!species) throw new Error(`Unknown Generation II species: ${speciesId}`);
  const battleLevel = Math.max(1, Math.min(100, Math.floor(Number(level) || 1)));
  return Math.floor(species.baseExp * battleLevel / 7);
}
