import { describe, it, expect } from 'vitest';
import { spriteKey, parseSpriteFileName, SPRITE_DIR } from '../src/core/sprite-files.js';

describe('sprite-files', () => {
  it('SPRITE_DIR is the app-owned "dex" cache folder', () => {
    expect(SPRITE_DIR).toBe('dex');
  });
  it('spriteKey builds <species>_<stage>', () => {
    expect(spriteKey('electric', 1)).toBe('electric_1');
  });
  it('parses <species>_<stage>.png', () => {
    expect(parseSpriteFileName('electric_1.png')).toEqual({ key: 'electric_1', species: 'electric', stage: 1 });
  });
  it('rejects invalid names (anim suffix no longer supported)', () => {
    expect(parseSpriteFileName('electric.png')).toBeNull();
    expect(parseSpriteFileName('electric_9.png')).toBeNull();      // stage out of range
    expect(parseSpriteFileName('fire_2_skill.png')).toBeNull();    // anim suffix no longer parsed
    expect(parseSpriteFileName('electric_1_fly.png')).toBeNull();  // not a valid pattern
    expect(parseSpriteFileName('electric_1.jpg')).toBeNull();      // not png
    expect(parseSpriteFileName('readme.txt')).toBeNull();
  });
});
