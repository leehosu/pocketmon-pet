import { describe, expect, it } from 'vitest';
import {
  ROCKET_GRUNTS, canChallengeBugsy, currentRocketGrunt, normalizeStoryProgress,
  recordRocketGruntVictory,
} from '../src/core/azalea-story.js';
import { BUGSY_CHALLENGE } from '../src/core/gym-challenge.js';

describe('Azalea story', () => {
  const ready = { hatched: true, level: 14, gymBadges: ['zephyr'], storyProgress: {} };

  it('uses the four original Slowpoke Well grunt parties in order', () => {
    expect(ROCKET_GRUNTS.map((grunt) => grunt.team.map((member) => [member.speciesId, member.level]))).toEqual([
      [[19, 9], [19, 9]],
      [[19, 7], [41, 9], [41, 9]],
      [[41, 9], [23, 11]],
      [[109, 14]],
    ]);
    expect(currentRocketGrunt(ready)?.id).toBe('rocket-grunt-1');
  });

  it('persists only the expected sequential victory and unlocks Bugsy after four', () => {
    let state = ready;
    state = recordRocketGruntVictory(state, 'rocket-grunt-2');
    expect(state.storyProgress.slowpokeWellGrunts).toBe(0);
    for (const grunt of ROCKET_GRUNTS) state = recordRocketGruntVictory(state, grunt.id);
    expect(normalizeStoryProgress(state.storyProgress)).toEqual({ slowpokeWellGrunts: 4, slowpokeWellCleared: true });
    expect(canChallengeBugsy(state)).toBe(true);
  });

  it('uses Bugsy’s original Gold team and moves', () => {
    expect(BUGSY_CHALLENGE.team).toEqual([
      { speciesId: 11, name: '단데기', level: 14, moveIds: [33, 81, 106] },
      { speciesId: 14, name: '딱충이', level: 14, moveIds: [40, 81, 106] },
      { speciesId: 123, name: '스라크', level: 16, moveIds: [98, 43, 210] },
    ]);
  });
});
