import { describe, expect, it } from 'vitest';
import { wildBattleExperience } from '../src/core/gen2-profile.js';
import { applyBattleExperience, XP_RULES } from '../src/core/xp-engine.js';

describe('wild battle rewards', () => {
  it('uses the Generation II wild experience formula', () => {
    expect(wildBattleExperience(152, 10)).toBe(Math.floor(64 * 10 / 7));
    expect(wildBattleExperience(26, 50)).toBe(Math.floor(122 * 50 / 7));
  });

  it('adds battle XP without consuming the agent activity daily cap', () => {
    const state = {
      species: 'electric', stage: 0, level: 1, xp: 0,
      dailyXp: XP_RULES.dailyCap, dailyDate: '2026-08-17', seenIds: [],
    };
    const result = applyBattleExperience(state, 90);
    expect(result.state.xp).toBe(90);
    expect(result.state.dailyXp).toBe(XP_RULES.dailyCap);
    expect(result.changes.xpGained).toBe(90);
  });
});
