import { describe, it, expect } from 'vitest';
import { skillsFor, skillsForState, petAction, nextMovesCache } from '../src/renderer/pet-window.js';
import { getSpeciesByKey } from '../src/core/roster.js';
import { XP_RULES, xpForLevel } from '../src/core/xp-engine.js';
import { GEN2_EFFECTS, gen2EffectForMove } from '../src/core/gsc-moves.js';

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
  ...GEN2_EFFECTS,
]);

describe('skillsFor', () => {
  it('each species has 2 skills', () => {
    for (const key of ['grass', 'fire', 'water', 'electric']) {
      const list = skillsFor(getSpeciesByKey(key));
      expect(list.length).toBe(2);
    }
  });

  it('changes Gold/Silver representative moves by evolution stage', () => {
    expect(skillsForState({ species: 'grass', stage: 0 }).map((s) => s.name)).toEqual(['잎날가르기', '누르기']);
    expect(skillsForState({ species: 'grass', stage: 1 }).map((s) => s.name)).toEqual(['독가루', '광합성']);
    expect(skillsForState({ species: 'grass', stage: 2 }).map((s) => s.name)).toEqual(['솔라빔', '빛의장막']);
    expect(skillsForState({ species: 'fire', stage: 0 }).map((s) => s.name)).toEqual(['불꽃세례', '연막']);
    expect(skillsForState({ species: 'fire', stage: 1 }).map((s) => s.name)).toEqual(['화염바퀴', '스피드스타']);
    expect(skillsForState({ species: 'fire', stage: 2 }).map((s) => s.name)).toEqual(['화염방사', '불대문자']);
    expect(skillsForState({ species: 'water', stage: 0 }).map((s) => s.name)).toEqual(['물대포', '물기']);
    expect(skillsForState({ species: 'water', stage: 1 }).map((s) => s.name)).toEqual(['냉동펀치', '겁나는얼굴']);
    expect(skillsForState({ species: 'water', stage: 2 }).map((s) => s.name)).toEqual(['하이드로펌프', '베어가르기']);
    expect(skillsForState({ species: 'electric', stage: 0 }).map((s) => s.name)).toEqual(['전기쇼크', '천사의키스']);
    expect(skillsForState({ species: 'electric', stage: 1 }).map((s) => s.name)).toEqual(['전기자석파', '전광석화']);
    expect(skillsForState({ species: 'electric', stage: 2 }).map((s) => s.name)).toEqual(['10만볼트', '번개']);
  });

  it('drops stale displayed moves when evolution stage changes without a moves payload', () => {
    const stage0 = { hatched: true, species: 'electric', stage: 0 };
    const stage1 = { hatched: true, species: 'electric', stage: 1 };
    const stage2 = { hatched: true, species: 'electric', stage: 2 };

    const first = nextMovesCache(stage0, null, null, null);
    expect(first.moves.map((s) => s.name)).toEqual(['전기쇼크', '천사의키스']);

    const second = nextMovesCache(stage1, first.moves, first.sig, null);
    expect(second.moves.map((s) => s.name)).toEqual(['전기자석파', '전광석화']);

    const third = nextMovesCache(stage2, second.moves, second.sig, null);
    expect(third.moves.map((s) => s.name)).toEqual(['10만볼트', '번개']);
  });

  it('uses distinct effects for both skills at every evolution stage', () => {
    for (const key of ['grass', 'fire', 'water', 'electric']) {
      for (const stage of [0, 1, 2]) {
        const effects = skillsForState({ species: key, stage }).map((s) => s.effect);
        expect(new Set(effects).size).toBe(2);
      }
    }
  });

  it('uses a unique move and effect for every evolution slot', () => {
    const moves = [];
    for (const key of ['grass', 'fire', 'water', 'electric']) {
      for (const stage of [0, 1, 2]) moves.push(...skillsForState({ species: key, stage }));
    }
    expect(new Set(moves.map((move) => move.name)).size).toBe(24);
    expect(new Set(moves.map((move) => move.effect)).size).toBe(24);
  });

  it('keeps Raichu Thunder distinct from Thunderbolt aliases', () => {
    expect(gen2EffectForMove('electric', 'thunder')).toBe('gsc_thunder');
    expect(gen2EffectForMove('electric', 'thunderbolt')).toBe('gsc_thunderbolt');
  });

  it('each skill has a non-empty name and a valid Gen II styled effect', () => {
    for (const key of ['grass', 'fire', 'water', 'electric']) {
      for (const s of skillsFor(getSpeciesByKey(key))) {
        expect(typeof s.name).toBe('string');
        expect(s.name.length).toBeGreaterThan(0);
        expect(EFFECTS.has(s.effect)).toBe(true);
        expect(s.effect.startsWith('gsc_')).toBe(true);
      }
    }
  });

  it('returns empty array for unknown/undefined species', () => {
    expect(skillsFor(undefined)).toEqual([]);
    expect(skillsFor({ key: 'nope' })).toEqual([]);
  });
});
