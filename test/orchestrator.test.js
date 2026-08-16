import { describe, it, expect } from 'vitest';
import { tick, ensureStarter } from '../src/main/orchestrator.js';
import { defaultState } from '../src/core/store.js';

describe('ensureStarter', () => {
  it('rolls a starter when unlocked', () => {
    const s = ensureStarter(defaultState(), () => 0);
    expect(s.locked).toBe(true);
    expect(s.species).toBe('grass');
  });
  it('keeps existing starter when locked', () => {
    const locked = { ...defaultState(), species: 'fire', locked: true };
    expect(ensureStarter(locked, () => 0).species).toBe('fire');
  });
});

describe('tick', () => {
  it('merges hook and session events and applies xp', () => {
    const state = { ...defaultState(), species: 'electric', locked: true, dailyDate: '2026-08-16' };
    const { state: next, changes } = tick({
      state,
      readEvents: () => [{ id: 'h1', kind: 'toolUse', ts: 1 }],
      readSessionEvents: () => [{ id: 's1', kind: 'tokens', tokens: 2000, ts: 2 }],
      today: '2026-08-16',
    });
    expect(next.xp).toBe(2 + 2); // toolUse 2 + 2000/1000
    expect(changes.reactions).toBe(1);
  });

  it('advances lastSessionTs only from session events, not hook ts', () => {
    const state = { ...defaultState(), species: 'electric', locked: true, dailyDate: '2026-08-16' };
    // hook ts(=현재 ms류)가 매우 크더라도 session 이벤트가 없으면 커서는 오르지 않아야 한다.
    const r = tick({
      state,
      readEvents: () => [{ id: 'h1', kind: 'toolUse', ts: 9999999 }],
      readSessionEvents: () => [],
      today: '2026-08-16',
    });
    expect(r.state.lastSessionTs).toBe(0);
  });

  it('advances lastSessionTs to the max session event ts', () => {
    const state = { ...defaultState(), species: 'electric', locked: true, dailyDate: '2026-08-16' };
    const r = tick({
      state,
      readEvents: () => [{ id: 'h1', kind: 'toolUse', ts: 500 }],
      readSessionEvents: () => [
        { id: 's1', kind: 'tokens', tokens: 1000, ts: 30 },
        { id: 's2', kind: 'tokens', tokens: 1000, ts: 42 },
      ],
      today: '2026-08-16',
    });
    expect(r.state.lastSessionTs).toBe(42);
  });

  it('derives busy activity from busyStart/busyEnd and skillPulse from toolUse', () => {
    const base = { ...defaultState(), species: 'electric', locked: true, dailyDate: '2026-08-16' };
    // busyStart → busy true, toolUse → skillPulse true
    const r1 = tick({
      state: base,
      readEvents: () => [{ id: 'b1', kind: 'busyStart', ts: 1 }, { id: 't1', kind: 'toolUse', ts: 2 }],
      readSessionEvents: () => [],
      today: '2026-08-16',
    });
    expect(r1.activity.busy).toBe(true);
    expect(r1.activity.skillPulse).toBe(true);
    expect(r1.state.busy).toBe(true);
    // next tick: busyEnd → busy false, no toolUse → skillPulse false
    const r2 = tick({
      state: r1.state,
      readEvents: () => [{ id: 'b2', kind: 'busyEnd', ts: 3 }],
      readSessionEvents: () => [],
      today: '2026-08-16',
    });
    expect(r2.activity.busy).toBe(false);
    expect(r2.activity.skillPulse).toBe(false);
  });
});
