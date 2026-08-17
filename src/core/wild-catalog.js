// AI-GENERATED: PokéAPI Gold 출현 기록과 레벨업 기술에서 야생전 입력을 만든다.
import { GOLD_WILD_CATALOG } from './data/gold-wild.generated.js';
import { isSupportedWildMove } from './gen2-battle.js';
import { resourceId } from './gen2-data.js';

function unitRandom(rng) {
  const value = Number(rng());
  return Math.max(0, Math.min(0.999999999, Number.isFinite(value) ? value : 0));
}

export function eligibleWildSpecies(playerLevel, catalog = GOLD_WILD_CATALOG) {
  const level = Math.max(1, Math.min(100, Math.floor(Number(playerLevel) || 1)));
  const upper = Math.min(100, level + 2);
  return catalog.filter((entry) => entry.minLevel <= upper);
}

export function chooseWildEncounter(playerLevel, rng = Math.random, catalog = GOLD_WILD_CATALOG) {
  const level = Math.max(1, Math.min(100, Math.floor(Number(playerLevel) || 1)));
  const candidates = eligibleWildSpecies(level, catalog);
  if (!candidates.length) return null;
  const row = candidates[Math.floor(unitRandom(rng) * candidates.length)];
  const lower = Math.max(1, level - 2, row.minLevel);
  const upper = Math.min(100, level + 2);
  const wildLevel = lower + Math.floor(unitRandom(rng) * (upper - lower + 1));
  return { speciesId: row.id, level: wildLevel };
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

export { GOLD_WILD_CATALOG };
