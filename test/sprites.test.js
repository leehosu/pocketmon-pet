import { describe, it, expect } from 'vitest';
import { PALETTE } from '../src/core/sprites/palette.js';
import { SPRITES, ANIMS, getFrames } from '../src/core/sprites/index.js';
import { ROSTER } from '../src/core/roster.js';

const eachFrame = (cb) => {
  for (const key of Object.keys(SPRITES))
    for (const stage of SPRITES[key])
      for (const anim of ANIMS)
        for (const frame of stage[anim]) cb(frame, key, anim);
};

describe('sprites', () => {
  it('every species has 3 stages, each with all named anims', () => {
    for (const s of ROSTER) {
      const stages = SPRITES[s.key];
      expect(stages).toHaveLength(3);
      for (const stage of stages) {
        for (const anim of ANIMS) expect(Array.isArray(stage[anim])).toBe(true);
        expect(stage.idle.length).toBeGreaterThanOrEqual(2);
        expect(stage.walk.length).toBeGreaterThanOrEqual(2);
        expect(stage.run.length).toBeGreaterThanOrEqual(2);
        expect(stage.skill.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('all frames are square and use valid palette indices', () => {
    eachFrame((frame) => {
      const n = frame.length;
      for (const row of frame) {
        expect(row).toHaveLength(n);
        for (const idx of row) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(PALETTE.length);
        }
      }
    });
  });
  // 실제로 서로 다른 도트인지 강제 (placeholder 동일 스프라이트 금지)
  it('idle base frame differs across all 12 species+stage sprites', () => {
    const seen = new Set();
    for (const key of Object.keys(SPRITES)) {
      for (const stage of SPRITES[key]) {
        const sig = JSON.stringify(stage.idle[0]);
        expect(seen.has(sig)).toBe(false); // 중복 금지
        seen.add(sig);
      }
    }
    expect(seen.size).toBe(12);
  });
  it('getFrames returns frames and falls back to idle for unknown anim', () => {
    expect(getFrames('electric', 0, 'run').length).toBeGreaterThanOrEqual(2);
    expect(getFrames('electric', 0, 'nope')).toEqual(getFrames('electric', 0, 'idle'));
  });
});
