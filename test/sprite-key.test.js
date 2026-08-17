import { describe, it, expect } from 'vitest';
import { pickSpriteKey } from '../src/renderer/pet-window.js';

describe('pickSpriteKey', () => {
  it('returns null when nothing available', () => {
    expect(pickSpriteKey(new Set(), 'electric', 1)).toBeNull();
  });
  it('returns the <species>_<stage> key when available', () => {
    expect(pickSpriteKey(new Set(['electric_1']), 'electric', 1)).toBe('electric_1');
  });
  it('accepts an array too', () => {
    expect(pickSpriteKey(['fire_0'], 'fire', 0)).toBe('fire_0');
  });
  it('returns null when the key is absent', () => {
    expect(pickSpriteKey(new Set(['fire_0']), 'electric', 1)).toBeNull();
  });
});
