// AI-GENERATED: PokéAPI Gold 출현 기록과 레벨업 기술에서 야생전 입력을 만든다.
import { GOLD_WILD_CATALOG } from './data/gold-wild.generated.js';
import { GOLD_STORY_WILD_ZONES } from './data/gold-story-wild.generated.js';
import { goldTimePeriod, normalizeGoldTimePeriod } from './gold-time.js';
import { ZEPHYR_BADGE, normalizeGymBadges } from './gym-challenge.js';
import { isSupportedWildMove } from './gen2-battle.js';
import { resourceId } from './gen2-data.js';

function unitRandom(rng) {
  const value = Number(rng());
  return Math.max(0, Math.min(0.999999999, Number.isFinite(value) ? value : 0));
}

export function eligibleWildSpecies(playerLevel, catalog = GOLD_WILD_CATALOG) {
  const level = Math.max(1, Math.min(100, Math.floor(Number(playerLevel) || 1)));
  const lower = Math.max(1, level - 2);
  const upper = Math.min(100, level + 2);
  const overlapping = catalog.filter((entry) => entry.minLevel <= upper && entry.maxLevel >= lower);
  if (overlapping.length) return overlapping;
  // 원작 출현 레벨이 플레이어보다 모두 낮아지는 후반에는 가장 강한 야생군만 남긴다.
  const available = catalog.filter((entry) => entry.minLevel <= upper);
  const strongest = Math.max(0, ...available.map((entry) => entry.maxLevel));
  return available.filter((entry) => entry.maxLevel === strongest);
}

export function chooseWildEncounter(playerLevel, rng = Math.random, catalog = GOLD_WILD_CATALOG) {
  const level = Math.max(1, Math.min(100, Math.floor(Number(playerLevel) || 1)));
  const candidates = eligibleWildSpecies(level, catalog);
  if (!candidates.length) return null;
  const row = candidates[Math.floor(unitRandom(rng) * candidates.length)];
  const lower = Math.max(1, level - 2, row.minLevel);
  const upper = Math.min(100, level + 2, row.maxLevel);
  const wildLevel = upper < lower
    ? row.maxLevel
    : lower + Math.floor(unitRandom(rng) * (upper - lower + 1));
  return { speciesId: row.id, level: wildLevel };
}

function weightedPick(rows, weightOf, rng) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, weightOf(row)), 0);
  if (total <= 0) return null;
  let cursor = unitRandom(rng) * total;
  for (const row of rows) {
    cursor -= Math.max(0, weightOf(row));
    if (cursor < 0) return row;
  }
  return rows.at(-1) || null;
}

export function goldWildZoneForState(state) {
  return normalizeGymBadges(state?.gymBadges).includes(ZEPHYR_BADGE) ? 'azalea' : 'violet';
}

export function chooseGoldStoryEncounter(state, options = {}) {
  const rng = options.rng || Math.random;
  const period = normalizeGoldTimePeriod(options.period) || goldTimePeriod(options.now);
  const zone = goldWildZoneForState(state);
  const maps = GOLD_STORY_WILD_ZONES[zone] || [];
  const selectedMap = weightedPick(maps, (entry) => entry.rate, rng);
  const slot = selectedMap && weightedPick(selectedMap.periods[period] || [], (entry) => entry.weight, rng);
  if (!slot) return null;
  return {
    speciesId: slot.speciesId,
    level: slot.level,
    mapId: selectedMap.id,
    period,
    zone,
  };
}

export function goldSilverLevelMoveIds(pokemon, level) {
  const learned = [];
  for (const [order, entry] of (pokemon?.moves || []).entries()) {
    const moveId = resourceId(entry.move);
    if (!moveId) continue;
    for (const detail of entry.version_group_details || []) {
      if (detail.version_group?.name !== 'gold-silver') continue;
      if (detail.move_learn_method?.name !== 'level-up') continue;
      if (Number(detail.level_learned_at) > level) continue;
      learned.push({ id: moveId, level: Number(detail.level_learned_at) || 0, order });
    }
  }
  learned.sort((a, b) => a.level - b.level || a.order - b.order);
  const latest = learned.slice(-4);
  return [...new Set(latest.map((entry) => entry.id))].filter((id) => isSupportedWildMove(id));
}

export { GOLD_WILD_CATALOG, GOLD_STORY_WILD_ZONES };
