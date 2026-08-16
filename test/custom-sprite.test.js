import { describe, it, expect } from 'vitest';
import { pickCustomKey } from '../src/renderer/pet-window.js';

describe('pickCustomKey', () => {
  it('returns null when nothing available', () => {
    expect(pickCustomKey(new Set(), 'electric', 1, 'run')).toBeNull();
  });
  it('prefers anim-specific key', () => {
    const set = new Set(['electric_1', 'electric_1_run']);
    expect(pickCustomKey(set, 'electric', 1, 'run')).toBe('electric_1_run');
  });
  it('falls back to stage-generic key', () => {
    const set = new Set(['electric_1']);
    expect(pickCustomKey(set, 'electric', 1, 'run')).toBe('electric_1');
  });
  it('accepts an array too', () => {
    expect(pickCustomKey(['fire_0'], 'fire', 0, 'idle')).toBe('fire_0');
  });
});
