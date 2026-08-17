import { describe, expect, it } from 'vitest';
import {
  createBattleProfile, ensureBattleProfile, recordBattleLoss, recordBattleVictory,
} from '../src/core/gen2-profile.js';

describe('Generation II battle profile', () => {
  it('creates permanent four-stat DVs from injected randomness', () => {
    const values = [0, 0.25, 0.5, 0.999];
    const profile = createBattleProfile(() => values.shift());
    expect(profile.dvs).toEqual({ attack: 0, defense: 4, speed: 8, special: 15 });
    expect(profile.statExp).toEqual({ hp: 0, attack: 0, defense: 0, speed: 0, special: 0 });
  });

  it('does not replace an existing profile', () => {
    const existing = createBattleProfile(() => 0.5);
    const state = { hatched: true, battleProfile: existing };
    expect(ensureBattleProfile(state, () => 0)).toBe(state);
  });

  it('awards defeated base stats and records results', () => {
    const profile = createBattleProfile(() => 0);
    const won = recordBattleVictory(profile, 152);
    expect(won.wins).toBe(1);
    expect(won.statExp).toEqual({ hp: 45, attack: 49, defense: 65, speed: 45, special: 49 });
    const lost = recordBattleLoss(won, 1_000);
    expect(lost.losses).toBe(1);
    expect(lost.encounterCooldownUntil).toBe(601_000);
  });
});
