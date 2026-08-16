import { describe, it, expect } from 'vitest';
import { customCandidates, parseSpriteFileName, SPRITE_DIR } from '../src/core/sprite-files.js';

describe('sprite-files', () => {
  it('SPRITE_DIR is "sprites"', () => {
    expect(SPRITE_DIR).toBe('sprites');
  });
  it('customCandidates prefers anim-specific then stage-generic', () => {
    expect(customCandidates('electric', 1, 'run')).toEqual(['electric_1_run', 'electric_1']);
  });
  it('parses stage-generic filename', () => {
    expect(parseSpriteFileName('electric_1.png')).toEqual({ key: 'electric_1', species: 'electric', stage: 1, anim: null });
  });
  it('parses anim-specific filename', () => {
    expect(parseSpriteFileName('fire_2_skill.png')).toEqual({ key: 'fire_2_skill', species: 'fire', stage: 2, anim: 'skill' });
  });
  it('rejects invalid names', () => {
    expect(parseSpriteFileName('electric.png')).toBeNull();
    expect(parseSpriteFileName('electric_9.png')).toBeNull();     // stage out of range
    expect(parseSpriteFileName('electric_1_fly.png')).toBeNull(); // bad anim
    expect(parseSpriteFileName('electric_1.jpg')).toBeNull();     // not png
    expect(parseSpriteFileName('readme.txt')).toBeNull();
  });
});
