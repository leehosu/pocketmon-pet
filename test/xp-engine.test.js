import { describe, it, expect } from 'vitest';
import { xpForLevel, levelForXp, applyEvents, XP_RULES } from '../src/core/xp-engine.js';

const base = () => ({ species: 'electric', level: 1, xp: 0, stage: 0,
  dailyXp: 0, dailyDate: '2026-08-16', seenIds: [] });

describe('xp curve', () => {
  it('xpForLevel grows super-linearly', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(4)).toBe(800);
    expect(xpForLevel(9)).toBe(2700);
  });
  it('levelForXp inverts the curve', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(800)).toBe(4);
    expect(levelForXp(2699)).toBe(8);
  });
});

describe('applyEvents', () => {
  it('adds tool-use xp and reacts', () => {
    const { state, changes } = applyEvents(base(),
      [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' });
    expect(state.xp).toBe(XP_RULES.perToolUse);
    expect(changes.reactions).toBe(1);
  });
  it('dedups seen ids', () => {
    let s = base();
    ({ state: s } = applyEvents(s, [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' }));
    const { state } = applyEvents(s, [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' });
    expect(state.xp).toBe(XP_RULES.perToolUse); // unchanged
  });
  it('converts tokens to xp with unit', () => {
    const { state } = applyEvents(base(),
      [{ id: 't', kind: 'tokens', tokens: 3000, ts: 1 }], { today: '2026-08-16' });
    expect(state.xp).toBe(3); // 3000/1000 * 1
  });
  it('enforces daily cap', () => {
    const { state } = applyEvents(base(),
      [{ id: 't', kind: 'tokens', tokens: 9_000_000, ts: 1 }], { today: '2026-08-16' });
    expect(state.dailyXp).toBe(XP_RULES.dailyCap);
  });
  it('resets daily cap on new day', () => {
    const s = { ...base(), dailyXp: XP_RULES.dailyCap, dailyDate: '2026-08-15' };
    const { state } = applyEvents(s,
      [{ id: 'x', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' });
    expect(state.dailyXp).toBe(XP_RULES.perToolUse);
  });
  it('levels up but does NOT auto-evolve (evolution is manual via "!")', () => {
    const s = { ...base(), xp: xpForLevel(9) }; // stage 0
    const { state, changes } = applyEvents(s,
      [{ id: 'big', kind: 'tokens', tokens: 462000, ts: 1 }], { today: '2026-08-16' });
    expect(state.level).toBe(10);        // 전기 진화 가능 레벨 도달
    expect(changes.leveledUp).toBe(true);
    expect(state.stage).toBe(0);         // 그러나 stage는 자동으로 오르지 않음(수동 진화)
    expect(changes.evolved).toBe(false);
  });
  it('clamps a forged too-high stage down to what the level allows', () => {
    const s = { ...base(), xp: 0, stage: 2 }; // level 1인데 stage 2로 조작
    const { state } = applyEvents(s, [], { today: '2026-08-16' });
    expect(state.stage).toBe(0);         // 레벨1 전기는 stage 0까지만 허용 → clamp
  });
});
