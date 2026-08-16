import { describe, it, expect } from 'vitest';
import { ROSTER, getSpeciesByKey, stageForLevel } from '../src/core/roster.js';

describe('roster', () => {
  it('has 4 species with 3 stages each', () => {
    expect(ROSTER).toHaveLength(4);
    for (const s of ROSTER) expect(s.stages).toHaveLength(3);
  });

  it('looks up species by key', () => {
    expect(getSpeciesByKey('electric').stages[0].name).toBe('피츄');
    expect(getSpeciesByKey('nope')).toBeUndefined();
  });

  it('maps level to evolution stage (electric evolves at 10/25)', () => {
    const s = getSpeciesByKey('electric');
    expect(stageForLevel(s, 1)).toBe(0);   // 피츄
    expect(stageForLevel(s, 10)).toBe(1);  // 피카츄
    expect(stageForLevel(s, 25)).toBe(2);  // 라이츄
    expect(stageForLevel(s, 99)).toBe(2);
  });

  it('returns stage 0 for an unknown/undefined species', () => {
    expect(stageForLevel(undefined, 50)).toBe(0);
  });
});
