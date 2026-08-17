// AI-GENERATED: pokecrystal의 CalcMonStatC 정수 계산을 재현한다.
import { GEN2_SPECIES } from './data/gen2-data.generated.js';

export const GEN2_MAX_LEVEL = 100;
export const GEN2_MAX_STAT_EXP = 65_535;
export const GEN2_MAX_STAT = 999;

function clampInt(value, min, max) {
  const number = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : min;
  return Math.max(min, Math.min(max, number));
}

export function normalizeDvs(dvs = {}) {
  return {
    attack: clampInt(dvs.attack, 0, 15),
    defense: clampInt(dvs.defense, 0, 15),
    speed: clampInt(dvs.speed, 0, 15),
    special: clampInt(dvs.special, 0, 15),
  };
}

export function normalizeStatExp(statExp = {}) {
  return {
    hp: clampInt(statExp.hp, 0, GEN2_MAX_STAT_EXP),
    attack: clampInt(statExp.attack, 0, GEN2_MAX_STAT_EXP),
    defense: clampInt(statExp.defense, 0, GEN2_MAX_STAT_EXP),
    speed: clampInt(statExp.speed, 0, GEN2_MAX_STAT_EXP),
    special: clampInt(statExp.special, 0, GEN2_MAX_STAT_EXP),
  };
}

export function hpDvFrom(dvs) {
  const value = normalizeDvs(dvs);
  return ((value.attack & 1) << 3)
    | ((value.defense & 1) << 2)
    | ((value.speed & 1) << 1)
    | (value.special & 1);
}

export function statExpBonus(value) {
  const normalized = clampInt(value, 0, GEN2_MAX_STAT_EXP);
  const root = Math.min(255, Math.ceil(Math.sqrt(normalized)));
  return Math.floor(root / 4);
}

function calculateStat(base, dv, statExp, level, minimum) {
  const common = Math.floor((((base + dv) * 2) + statExpBonus(statExp)) * level / 100);
  return Math.min(GEN2_MAX_STAT, common + minimum);
}

export function calculateGen2Stats(speciesOrId, requestedLevel, dvs, statExp) {
  const species = typeof speciesOrId === 'object' ? speciesOrId : GEN2_SPECIES[speciesOrId];
  if (!species?.stats) throw new Error(`Unknown Generation II species: ${speciesOrId}`);
  const level = clampInt(requestedLevel, 1, GEN2_MAX_LEVEL);
  const values = normalizeDvs(dvs);
  const effort = normalizeStatExp(statExp);
  const base = species.stats;
  return {
    hp: calculateStat(base.hp, hpDvFrom(values), effort.hp, level, level + 10),
    attack: calculateStat(base.attack, values.attack, effort.attack, level, 5),
    defense: calculateStat(base.defense, values.defense, effort.defense, level, 5),
    speed: calculateStat(base.speed, values.speed, effort.speed, level, 5),
    specialAttack: calculateStat(base.specialAttack, values.special, effort.special, level, 5),
    specialDefense: calculateStat(base.specialDefense, values.special, effort.special, level, 5),
  };
}

export function addStatExp(current, defeatedSpeciesOrId) {
  const defeated = typeof defeatedSpeciesOrId === 'object'
    ? defeatedSpeciesOrId
    : GEN2_SPECIES[defeatedSpeciesOrId];
  if (!defeated?.stats) throw new Error(`Unknown Generation II species: ${defeatedSpeciesOrId}`);
  const value = normalizeStatExp(current);
  const base = defeated.stats;
  return normalizeStatExp({
    hp: value.hp + base.hp,
    attack: value.attack + base.attack,
    defense: value.defense + base.defense,
    speed: value.speed + base.speed,
    special: value.special + base.specialAttack,
  });
}
