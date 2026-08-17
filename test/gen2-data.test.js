import { describe, expect, it } from 'vitest';
import { GEN2_SKILLS_BY_KEY } from '../src/core/gsc-moves.js';
import {
  getGen2MoveById, getGen2MoveBySlug, getGen2Species,
} from '../src/core/gen2-data.js';

describe('Generation II battle data', () => {
  it('contains all original species and moves', () => {
    expect(getGen2Species(26).stats.speed).toBe(100);
    expect(getGen2Species(160).baseExp).toBe(210);
    expect(getGen2MoveById(56)).toMatchObject({ constant: 'HYDRO_PUMP', power: 120, accuracyByte: 204 });
  });

  it('maps every displayed player move to its original move record', () => {
    const displayed = Object.values(GEN2_SKILLS_BY_KEY).flat(2);
    expect(displayed).toHaveLength(24);
    for (const move of displayed) {
      expect(getGen2MoveBySlug(move.slug), move.slug).toMatchObject({ id: expect.any(Number) });
    }
  });
});
