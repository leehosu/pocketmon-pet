import { describe, it, expect } from 'vitest';
import { skillsFor } from '../src/renderer/pet-window.js';
import { getSpeciesByKey } from '../src/core/roster.js';

const EFFECTS = new Set(['leaf', 'fire', 'water', 'electric']);

describe('skillsFor', () => {
  it('returns skills for each species keyed to its type effect', () => {
    expect(skillsFor(getSpeciesByKey('grass')).every((s) => s.effect === 'leaf')).toBe(true);
    expect(skillsFor(getSpeciesByKey('fire')).every((s) => s.effect === 'fire')).toBe(true);
    expect(skillsFor(getSpeciesByKey('water')).every((s) => s.effect === 'water')).toBe(true);
    expect(skillsFor(getSpeciesByKey('electric')).every((s) => s.effect === 'electric')).toBe(true);
  });

  it('each skill has a non-empty name and a valid effect', () => {
    for (const key of ['grass', 'fire', 'water', 'electric']) {
      const list = skillsFor(getSpeciesByKey(key));
      expect(list.length).toBeGreaterThanOrEqual(1);
      for (const s of list) {
        expect(typeof s.name).toBe('string');
        expect(s.name.length).toBeGreaterThan(0);
        expect(EFFECTS.has(s.effect)).toBe(true);
      }
    }
  });

  it('returns empty array for unknown/undefined species', () => {
    expect(skillsFor(undefined)).toEqual([]);
    expect(skillsFor({ key: 'nope' })).toEqual([]);
  });
});
