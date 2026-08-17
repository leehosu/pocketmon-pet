import { describe, expect, it } from 'vitest';
import { battleResultView } from '../src/renderer/battle-result.js';

describe('battle result view', () => {
  it('shows exact reward, total XP, and level-up state on victory', () => {
    expect(battleResultView({
      battle: { winner: 'player' }, reward: 321, totalXp: 13_321, level: 26,
      resultChanges: { leveledUp: true },
    })).toEqual({
      won: true,
      title: '승리',
      xpText: '+321 XP',
      detail: '레벨 업 · Lv.26 · 총 13321 XP',
    });
  });

  it('shows zero XP and recovery on defeat', () => {
    expect(battleResultView({ battle: { winner: 'enemy' }, reward: 999, level: 25, totalXp: 13_000 }))
      .toMatchObject({ won: false, title: '패배', xpText: '+0 XP', detail: '획득 XP 0 · 포켓몬은 회복했습니다' });
  });

  it('returns no view while the battle is active', () => {
    expect(battleResultView({ battle: { winner: null } })).toBe(null);
  });
});
