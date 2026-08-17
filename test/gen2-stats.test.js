import { describe, expect, it } from 'vitest';
import {
  calculateGen2Stats, hpDvFrom, statExpBonus,
} from '../src/core/gen2-stats.js';

describe('Generation II stat calculation', () => {
  it('derives HP DV from the low bits of the four stored DVs', () => {
    expect(hpDvFrom({ attack: 15, defense: 15, speed: 15, special: 15 })).toBe(15);
    expect(hpDvFrom({ attack: 1, defense: 0, speed: 1, special: 0 })).toBe(10);
  });

  it('uses pokecrystal square-root rounding for stat EXP', () => {
    expect(statExpBonus(0)).toBe(0);
    expect(statExpBonus(1)).toBe(0);
    expect(statExpBonus(16)).toBe(1);
    expect(statExpBonus(65_535)).toBe(63);
  });

  it('calculates Raichu level 50 stats from its Generation II base stats', () => {
    const stats = calculateGen2Stats(26, 50,
      { attack: 15, defense: 15, speed: 15, special: 15 },
      { hp: 0, attack: 0, defense: 0, speed: 0, special: 0 });
    expect(stats).toEqual({
      hp: 135,
      attack: 110,
      defense: 75,
      speed: 120,
      specialAttack: 110,
      specialDefense: 100,
    });
  });

  it('caps battle level and stat EXP at Generation II limits', () => {
    const stats = calculateGen2Stats(26, 999,
      { attack: 15, defense: 15, speed: 15, special: 15 },
      { hp: 99_999, attack: 99_999, defense: 99_999, speed: 99_999, special: 99_999 });
    expect(stats.hp).toBe(323);
    expect(stats.attack).toBe(278);
  });
});
