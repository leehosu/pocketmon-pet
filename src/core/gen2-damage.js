// AI-GENERATED: pokecrystal의 명중, 급소, 타입 및 데미지 정수 연산을 재현한다.
import { GEN2_TYPE_CHART } from './data/gen2-data.generated.js';

export const GEN2_PHYSICAL_TYPES = new Set([
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
]);

const STAT_STAGE_RATIOS = [
  [25, 100], [28, 100], [33, 100], [40, 100], [50, 100], [66, 100], [1, 1],
  [15, 10], [2, 1], [25, 10], [3, 1], [35, 10], [4, 1],
];

const ACCURACY_STAGE_RATIOS = [
  [33, 100], [36, 100], [43, 100], [50, 100], [60, 100], [75, 100], [1, 1],
  [133, 100], [166, 100], [2, 1], [233, 100], [133, 50], [3, 1],
];

const CRITICAL_THRESHOLDS = [17, 32, 64, 85, 128, 128, 128];

function clampInt(value, min, max) {
  const number = Number.isFinite(Number(value)) ? Math.floor(Number(value)) : min;
  return Math.max(min, Math.min(max, number));
}

export function isPhysicalType(type) {
  return GEN2_PHYSICAL_TYPES.has(type);
}

export function typeEffectiveness(moveType, defenderTypes = []) {
  return defenderTypes.reduce((factor, type) => (
    factor * (GEN2_TYPE_CHART[`${moveType}:${type}`] ?? 1)
  ), 1);
}

export function applyStatStage(stat, stage = 0) {
  const [numerator, denominator] = STAT_STAGE_RATIOS[clampInt(stage, -6, 6) + 6];
  return Math.max(1, Math.floor(clampInt(stat, 1, 9999) * numerator / denominator));
}

export function modifiedAccuracy(accuracyByte, accuracyStage = 0, evasionStage = 0) {
  const combined = clampInt(accuracyStage, -6, 6) - clampInt(evasionStage, -6, 6);
  const [numerator, denominator] = ACCURACY_STAGE_RATIOS[clampInt(combined, -6, 6) + 6];
  return Math.min(255, Math.floor(clampInt(accuracyByte, 0, 255) * numerator / denominator));
}

export function doesMoveHit({
  accuracyByte, randomByte, accuracyStage = 0, evasionStage = 0, alwaysHits = false,
}) {
  if (alwaysHits) return true;
  const threshold = modifiedAccuracy(accuracyByte, accuracyStage, evasionStage);
  return clampInt(randomByte, 0, 255) < threshold;
}

export function criticalThreshold(level = 0) {
  return CRITICAL_THRESHOLDS[clampInt(level, 0, CRITICAL_THRESHOLDS.length - 1)];
}

export function isCriticalHit(level, randomByte) {
  return clampInt(randomByte, 0, 255) < criticalThreshold(level);
}

export function truncateBattleStats(attackValue, defenseValue) {
  let attack = Math.max(1, Math.floor(attackValue));
  let defense = Math.max(1, Math.floor(defenseValue));
  while (attack > 255 || defense > 255) {
    attack = Math.max(1, Math.floor(attack / 4));
    defense = Math.max(1, Math.floor(defense / 4));
  }
  return { attack, defense };
}

function applyTypeDamage(damage, moveType, defenderTypes) {
  let value = damage;
  for (const defenderType of defenderTypes) {
    const factor = GEN2_TYPE_CHART[`${moveType}:${defenderType}`] ?? 1;
    value = Math.floor(value * factor);
  }
  return value;
}

export function calculateGen2Damage({
  level,
  power,
  attack,
  defense,
  moveType,
  attackerTypes = [],
  defenderTypes = [],
  randomByte,
  critical = false,
}) {
  const effectiveness = typeEffectiveness(moveType, defenderTypes);
  const stab = attackerTypes.includes(moveType);
  if (power <= 0 || effectiveness === 0) {
    return { damage: 0, effectiveness, stab, critical: Boolean(critical) };
  }
  const values = truncateBattleStats(attack, defense);
  const levelFactor = Math.floor((2 * clampInt(level, 1, 100)) / 5) + 2;
  let core = Math.floor((levelFactor * clampInt(power, 1, 255) * values.attack) / values.defense);
  core = Math.floor(core / 50);
  let damage = Math.min(999, (core * (critical ? 2 : 1)) + 2);
  if (stab) damage += Math.floor(damage / 2);
  damage = applyTypeDamage(damage, moveType, defenderTypes);
  if (damage > 1) damage = Math.floor(damage * clampInt(randomByte, 217, 255) / 255);
  return {
    damage: effectiveness > 0 ? Math.max(1, damage) : 0,
    effectiveness,
    stab,
    critical: Boolean(critical),
  };
}
