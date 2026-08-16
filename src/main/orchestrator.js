import { applyEvents } from '../core/xp-engine.js';
import { rollStarter } from '../core/store.js';

export function ensureStarter(state, rng = Math.random) {
  return state.locked ? state : rollStarter(state, rng);
}

export function tick(deps) {
  // hook 이벤트와 session 이벤트를 분리 유지한다.
  // applyEvents엔 합쳐서 넘기되, lastSessionTs 커서는 오직 session 이벤트 ts에서만 도출한다.
  // (hook ts는 Date.now() ms, session ts는 Date.parse() ms — 섞어서 max를 잡으면
  //  hook ts가 앞설 때 아직 안 읽은 session 라인이 영구히 sinceTs 이하로 밀려 XP 유실.)
  const hookEvents = deps.readEvents();
  const sessionEvents = deps.readSessionEvents(deps.state.lastSessionTs || 0);
  const events = [...hookEvents, ...sessionEvents];

  const lastSessionTs = sessionEvents.reduce(
    (m, e) => Math.max(m, e.ts || 0),
    deps.state.lastSessionTs || 0,
  );
  const { state, changes } = applyEvents(deps.state, events, { today: deps.today });

  // 활동 상태: busy는 busyStart/busyEnd로 전이(직전 busy 이어받음), skill은 이번 tick의 toolUse.
  let busy = Boolean(deps.state.busy);
  let skillPulse = false;
  for (const e of events) {
    if (e.kind === 'busyStart') busy = true;
    else if (e.kind === 'busyEnd') busy = false;
    else if (e.kind === 'toolUse') skillPulse = true;
  }

  return {
    state: { ...state, lastSessionTs, lastActiveAt: Date.now(), busy },
    changes,
    activity: { busy, skillPulse },
  };
}
