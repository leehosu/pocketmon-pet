import { describe, it, expect } from 'vitest';
import { sign, verify, canonical } from '../src/core/integrity.js';

describe('integrity', () => {
  it('canonical is key-order stable', () => {
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
  });
  it('sign/verify round-trips', () => {
    const obj = { xp: 100, species: 'fire' };
    const sig = sign(obj);
    expect(verify(obj, sig)).toBe(true);
  });
  it('rejects a tampered object', () => {
    const sig = sign({ xp: 100 });
    expect(verify({ xp: 999 }, sig)).toBe(false);
  });
  it('rejects a bad signature', () => {
    expect(verify({ xp: 100 }, 'deadbeef')).toBe(false);
  });
});
