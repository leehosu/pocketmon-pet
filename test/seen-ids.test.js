import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyEvents, trimSeenIds, localDateKey, SEEN_ID_LIMIT } from '../src/core/xp-engine.js';
import { defaultState, loadState, saveState } from '../src/core/store.js';

const base = () => ({
  species: 'electric', level: 1, xp: 0, stage: 0,
  dailyXp: 0, dailyDate: '2026-08-16', seenIds: [],
});

describe('trimSeenIds', () => {
  it('leaves short lists untouched', () => {
    const ids = ['a', 'b', 'c'];
    expect(trimSeenIds(ids)).toBe(ids);
  });

  it('keeps only the most recent ids past the limit', () => {
    const ids = Array.from({ length: SEEN_ID_LIMIT + 50 }, (_, i) => `e${i}`);
    const out = trimSeenIds(ids);
    expect(out).toHaveLength(SEEN_ID_LIMIT);
    expect(out[out.length - 1]).toBe(`e${SEEN_ID_LIMIT + 49}`); // 최신 것이 남는다
    expect(out[0]).toBe('e50');
  });

  it('tolerates a missing/corrupt array', () => {
    expect(trimSeenIds(undefined)).toEqual([]);
    expect(trimSeenIds('nope')).toEqual([]);
  });
});

describe('applyEvents bounds seenIds', () => {
  it('does not let seenIds grow without limit', () => {
    let s = base();
    for (let batch = 0; batch < 3; batch++) {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        id: `b${batch}-${i}`, kind: 'toolUse', ts: 1,
      }));
      ({ state: s } = applyEvents(s, events, { today: '2026-08-16' }));
    }
    expect(s.seenIds.length).toBeLessThanOrEqual(SEEN_ID_LIMIT);
  });

  it('still dedups ids that are inside the retained window', () => {
    let s = base();
    ({ state: s } = applyEvents(s, [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' }));
    const xpAfterFirst = s.xp;
    ({ state: s } = applyEvents(s, [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' }));
    expect(s.xp).toBe(xpAfterFirst);
  });
});

describe('store heals an already-bloated save', () => {
  it('trims seenIds on save/load round-trip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pkmn-seen-'));
    const bloated = {
      ...defaultState(),
      seenIds: Array.from({ length: SEEN_ID_LIMIT + 500 }, (_, i) => `old${i}`),
    };
    saveState(dir, bloated);
    expect(loadState(dir).seenIds).toHaveLength(SEEN_ID_LIMIT);
  });
});

describe('localDateKey', () => {
  it('uses the local calendar day, not UTC', () => {
    // KST(+9) 기준 2026-08-18 00:30 → UTC로는 아직 2026-08-17.
    const local = new Date(2026, 7, 18, 0, 30, 0);
    expect(localDateKey(local)).toBe('2026-08-18');
  });

  it('zero-pads month and day', () => {
    expect(localDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
