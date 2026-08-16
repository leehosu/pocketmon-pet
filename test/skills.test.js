import { describe, it, expect } from 'vitest';
import { skillsFor, petAction } from '../src/renderer/pet-window.js';
import { getSpeciesByKey } from '../src/core/roster.js';
import { XP_RULES, xpForLevel } from '../src/core/xp-engine.js';

describe('petAction (부화/진화 "!" 판정)', () => {
  it('egg is not hatchable until it reaches hatch XP', () => {
    expect(petAction({ hatched: false, xp: 0 })).toEqual({ kind: 'hatch', can: false });
    expect(petAction({ hatched: false, xp: XP_RULES.hatchXp })).toEqual({ kind: 'hatch', can: true });
  });
  it('hatched pet can evolve only at the evolution level', () => {
    const below = { hatched: true, species: 'electric', level: 9, stage: 0, xp: xpForLevel(9) };
    const at = { hatched: true, species: 'electric', level: 10, stage: 0, xp: xpForLevel(10) };
    expect(petAction(below)).toEqual({ kind: 'evolve', can: false });
    expect(petAction(at)).toEqual({ kind: 'evolve', can: true });
  });
  it('null state → no action', () => {
    expect(petAction(null)).toEqual({ kind: null, can: false });
  });
});

const EFFECTS = new Set([
  'leaf', 'leaf_swirl',
  'fire', 'fire_breath',
  'water', 'water_bubbles',
  'electric', 'electric_bolts',
]);

// 각 종의 기술 이펙트는 자기 타입 계열(family) 접두어로 시작해야 한다.
const FAMILY = { grass: 'leaf', fire: 'fire', water: 'water', electric: 'electric' };

describe('skillsFor', () => {
  it('each species has 2 skills with DISTINCT effects (안 똑같음)', () => {
    for (const key of ['grass', 'fire', 'water', 'electric']) {
      const list = skillsFor(getSpeciesByKey(key));
      expect(list.length).toBe(2);
      const effects = list.map((s) => s.effect);
      expect(new Set(effects).size).toBe(2); // 두 이펙트가 서로 달라야 함
    }
  });

  it('each skill has a non-empty name and a valid effect in its type family', () => {
    for (const key of ['grass', 'fire', 'water', 'electric']) {
      for (const s of skillsFor(getSpeciesByKey(key))) {
        expect(typeof s.name).toBe('string');
        expect(s.name.length).toBeGreaterThan(0);
        expect(EFFECTS.has(s.effect)).toBe(true);
        expect(s.effect.split('_')[0]).toBe(FAMILY[key]);
      }
    }
  });

  it('returns empty array for unknown/undefined species', () => {
    expect(skillsFor(undefined)).toEqual([]);
    expect(skillsFor({ key: 'nope' })).toEqual([]);
  });
});
