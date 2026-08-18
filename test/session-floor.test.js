import { describe, it, expect } from 'vitest';
import { sessionScanFloor, parseSessionLines } from '../src/core/session-parser.js';
import { applyEvents, XP_RULES } from '../src/core/xp-engine.js';

describe('sessionScanFloor', () => {
  it('uses the saved cursor once there is one', () => {
    expect(sessionScanFloor(1700, 999)).toBe(1700);
  });

  it('falls back to the first-run floor when the cursor is unset', () => {
    expect(sessionScanFloor(0, 999)).toBe(999);
  });

  // 소급 창을 0으로 두고 floor를 매 tick Date.now()로 다시 계산하면, 로그의 ts는 항상
  // 과거이므로 아무 이벤트도 잡히지 않고 lastSessionTs가 0에 머물러 토큰 XP가 영영
  // 들어오지 않는다. 앱 시작 시각으로 고정한 floor는 이후 활동을 정상적으로 잡아야 한다.
  it('still catches activity that happens after app start (no deadlock)', () => {
    const appStart = Date.parse('2026-08-18T10:00:00.000Z');
    const line = (iso, tokens) => JSON.stringify({
      uuid: `u-${iso}`,
      timestamp: iso,
      message: { usage: { input_tokens: tokens, output_tokens: 0 } },
    });

    const lines = [
      line('2026-08-18T09:00:00.000Z', 50_000), // 앱 켜기 전 — 소급 안 됨
      line('2026-08-18T10:05:00.000Z', 3_000),  // 앱 켠 뒤 — 반영돼야 함
    ];

    const floor = sessionScanFloor(0, appStart);
    const events = parseSessionLines(lines, floor);
    expect(events).toHaveLength(1);
    expect(events[0].tokens).toBe(3_000);
  });

  it('drops pre-install history so the hatch gate is not skipped', () => {
    const appStart = Date.parse('2026-08-18T10:00:00.000Z');
    const past = JSON.stringify({
      uuid: 'old',
      timestamp: '2026-08-17T23:00:00.000Z', // 설치 전날
      message: { usage: { input_tokens: 5_000_000, output_tokens: 0 } },
    });
    const events = parseSessionLines([past], sessionScanFloor(0, appStart));
    expect(events).toEqual([]);
  });
});

describe('hatch gate is meaningful under the new tuning', () => {
  const fresh = () => ({
    species: null, level: 1, xp: 0, stage: 0,
    dailyXp: 0, dailyDate: '2026-08-18', seenIds: [],
  });

  it('caps a single day, so the gate needs a full maxed day at minimum', () => {
    // 하루에 아무리 많이 써도 dailyCap을 넘지 못한다. hatchXp == dailyCap이므로
    // "상한을 완전히 꽉 채운 하루"가 부화의 이론상 최단 경로다.
    const { state } = applyEvents(fresh(),
      [{ id: 'huge', kind: 'tokens', tokens: 999_000_000, ts: 1 }], { today: '2026-08-18' });
    expect(state.dailyXp).toBe(XP_RULES.dailyCap);
    expect(state.xp).toBe(XP_RULES.dailyCap);
  });

  it('is not cleared by a realistic heavy day', () => {
    // 실측 최대 활동일은 1,790 XP(= 약 1,790,000 토큰)로 문턱에 못 미친다 → 최소 이틀.
    const { state } = applyEvents(fresh(),
      [{ id: 'heavy', kind: 'tokens', tokens: 1_790_000, ts: 1 }], { today: '2026-08-18' });
    expect(state.xp).toBe(1790);
    expect(state.xp).toBeLessThan(XP_RULES.hatchXp);
  });

  it('is reachable across two capped days', () => {
    let s = fresh();
    ({ state: s } = applyEvents(s,
      [{ id: 'd1', kind: 'tokens', tokens: 999_000_000, ts: 1 }], { today: '2026-08-18' }));
    ({ state: s } = applyEvents(s,
      [{ id: 'd2', kind: 'tokens', tokens: 999_000_000, ts: 2 }], { today: '2026-08-19' }));
    expect(s.xp).toBeGreaterThanOrEqual(XP_RULES.hatchXp);
  });
});
