import { describe, expect, it } from 'vitest';
import {
  FALKNER_CHALLENGE,
  FALKNER_MAX_APPEAR_DELAY_MS,
  FALKNER_MIN_APPEAR_DELAY_MS,
  awardZephyrBadge,
  canChallengeFalkner,
  falknerAppearanceDelayMs,
  normalizeGymBadges,
  trainerBattleExperience,
} from '../src/core/gym-challenge.js';

describe('Falkner gym challenge', () => {
  it('uses the original Gold team and unlocks at level 7 after three victories', () => {
    expect(FALKNER_CHALLENGE.dvs).toEqual({ attack: 9, defense: 10, speed: 7, special: 7 });
    expect(FALKNER_CHALLENGE.team).toEqual([
      { speciesId: 16, name: '구구', level: 7, moveIds: [33, 189] },
      { speciesId: 17, name: '피죤', level: 9, moveIds: [33, 189, 16] },
    ]);
    expect(canChallengeFalkner({ hatched: true, level: 7, battleProfile: { wins: 2 }, gymBadges: [] })).toBe(false);
    expect(canChallengeFalkner({ hatched: true, level: 6, battleProfile: { wins: 3 }, gymBadges: [] })).toBe(false);
    expect(canChallengeFalkner({ hatched: true, level: 7, battleProfile: { wins: 3 }, gymBadges: [] })).toBe(true);
  });

  it('normalizes and awards the badge once', () => {
    expect(normalizeGymBadges(['zephyr', 'unknown', 'zephyr'])).toEqual(['zephyr']);
    const won = awardZephyrBadge({ gymBadges: [] });
    expect(won.gymBadges).toEqual(['zephyr']);
    expect(canChallengeFalkner({ hatched: true, level: 7, battleProfile: { wins: 10 }, ...won })).toBe(false);
  });

  it('delays the first gym appearance by two to five minutes', () => {
    expect(falknerAppearanceDelayMs(() => 0)).toBe(FALKNER_MIN_APPEAR_DELAY_MS);
    expect(falknerAppearanceDelayMs(() => 0.999999)).toBe(FALKNER_MAX_APPEAR_DELAY_MS);
  });

  it('uses the trainer experience multiplier for both opponents', () => {
    expect(trainerBattleExperience(FALKNER_CHALLENGE.team, (_id, level) => level * 10)).toBe(240);
  });
});
