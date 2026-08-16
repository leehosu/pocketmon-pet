import { describe, it, expect } from 'vitest';
import { statusDetail } from '../src/renderer/pet-window.js';
import { getSpeciesByKey } from '../src/core/roster.js';
import { xpForLevel, XP_RULES } from '../src/core/xp-engine.js';

describe('statusDetail', () => {
  const grass = getSpeciesByKey('grass'); // evolveLevels [16,32], 치코리타/베이리프/메가니움, 풀

  it('computes level / xp / evolution detail for a stage-0 pet', () => {
    const state = {
      species: 'grass', level: 2, stage: 0,
      xp: xpForLevel(2) + 50, dailyXp: 120,
    };
    const d = statusDetail(state, grass, xpForLevel, XP_RULES.dailyCap);
    expect(d.name).toBe('치코리타');
    expect(d.type).toBe('풀');
    expect(d.stageLabel).toBe('1/3단계');
    expect(d.level).toBe(2);
    expect(d.xpInLevel).toBe(50);
    expect(d.xpNeededThisLevel).toBe(xpForLevel(3) - xpForLevel(2));
    expect(d.xpToNext).toBe(xpForLevel(3) - (xpForLevel(2) + 50));
    expect(d.totalXp).toBe(xpForLevel(2) + 50);
    expect(d.evolveText).toBe('베이리프까지 Lv.16 (14 남음)');
    expect(d.dailyXp).toBe(120);
    expect(d.dailyCap).toBe(XP_RULES.dailyCap);
  });

  it('shows next evolution from stage 1 (to stage 2)', () => {
    const state = { species: 'grass', level: 20, stage: 1, xp: xpForLevel(20), dailyXp: 0 };
    const d = statusDetail(state, grass, xpForLevel, XP_RULES.dailyCap);
    expect(d.stageLabel).toBe('2/3단계');
    expect(d.evolveText).toBe('메가니움까지 Lv.32 (12 남음)'); // e2=32
  });

  it('marks final stage as fully evolved', () => {
    const state = { species: 'grass', level: 40, stage: 2, xp: xpForLevel(40), dailyXp: 0 };
    const d = statusDetail(state, grass, xpForLevel, XP_RULES.dailyCap);
    expect(d.stageLabel).toBe('3/3단계');
    expect(d.evolveText).toBe('최종 진화 완료');
  });

  it('handles unknown species gracefully', () => {
    const d = statusDetail({ species: 'x', level: 1, stage: 0, xp: 0, dailyXp: 0 }, undefined, xpForLevel, XP_RULES.dailyCap);
    expect(d.name).toBe('???');
    expect(d.evolveText).toBe('—');
  });
});
