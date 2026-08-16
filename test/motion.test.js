import { describe, it, expect } from 'vitest';
import { spriteMotion } from '../src/renderer/pet-window.js';

describe('spriteMotion', () => {
  it('returns numeric transform fields for every anim', () => {
    for (const anim of ['idle', 'walk', 'run', 'skill']) {
      const m = spriteMotion(anim, 3);
      for (const k of ['dx', 'dy', 'rot', 'sx', 'sy']) {
        expect(typeof m[k]).toBe('number');
        expect(Number.isFinite(m[k])).toBe(true);
      }
    }
  });

  it('idle bobs gently (no scale, no rotation)', () => {
    const m = spriteMotion('idle', 0);
    expect(m.dy).toBe(0); // sin(0) === 0
    expect(m.sx).toBe(1);
    expect(m.rot).toBe(0);
  });

  it('run hops upward only (dy never positive)', () => {
    for (let t = 0; t < 20; t++) expect(spriteMotion('run', t).dy).toBeLessThanOrEqual(0);
  });

  it('skill pops bigger (scale > 1)', () => {
    expect(spriteMotion('skill', 1).sx).toBeGreaterThan(1);
  });

  it('walk adds a slight waddle rotation', () => {
    // 회전이 0이 아닌 tick이 존재해야 함
    let anyRot = false;
    for (let t = 1; t < 10; t++) if (Math.abs(spriteMotion('walk', t).rot) > 0.001) anyRot = true;
    expect(anyRot).toBe(true);
  });
});
