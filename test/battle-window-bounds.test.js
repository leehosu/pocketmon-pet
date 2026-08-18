import { describe, expect, it } from 'vitest';
import { battleWindowBounds } from '../src/core/battle-window-bounds.js';

describe('battleWindowBounds', () => {
  const workArea = { x: 0, y: 25, width: 1440, height: 875 };
  const size = { width: 600, height: 460 };

  it('centers the battle window on the encounter', () => {
    expect(battleWindowBounds(workArea, { x: 800, y: 300, width: 180, height: 190 }, size))
      .toEqual({ x: 590, y: 165, width: 600, height: 460 });
  });

  it('keeps the battle window inside the work area near an edge', () => {
    expect(battleWindowBounds(workArea, { x: 1360, y: 760, width: 180, height: 190 }, size))
      .toEqual({ x: 840, y: 440, width: 600, height: 460 });
  });

  it('shrinks to fit a smaller display', () => {
    expect(battleWindowBounds(
      { x: -800, y: 0, width: 500, height: 400 },
      { x: -600, y: 120, width: 180, height: 190 },
      size,
    )).toEqual({ x: -800, y: 0, width: 500, height: 400 });
  });
});
