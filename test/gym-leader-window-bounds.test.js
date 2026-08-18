import { describe, expect, it } from 'vitest';
import { gymLeaderWindowBounds } from '../src/core/gym-leader-window-bounds.js';

describe('gymLeaderWindowBounds', () => {
  const workArea = { x: 0, y: 0, width: 1_440, height: 900 };
  const size = { width: 290, height: 170 };

  it('places the leader beside the pet', () => {
    expect(gymLeaderWindowBounds(workArea, { x: 500, y: 300, width: 96, height: 124 }, size))
      .toEqual({ x: 604, y: 277, width: 290, height: 170 });
  });

  it('flips to the left and clamps near screen edges', () => {
    expect(gymLeaderWindowBounds(workArea, { x: 1_380, y: 850, width: 60, height: 60 }, size))
      .toEqual({ x: 1_082, y: 730, width: 290, height: 170 });
  });
});
