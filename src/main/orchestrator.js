import { applyEvents } from '../core/xp-engine.js';
import { rollStarter } from '../core/store.js';

export function ensureStarter(state, rng = Math.random) {
  return state.locked ? state : rollStarter(state, rng);
}

export function tick(deps) {
  const events = [
    ...deps.readEvents(),
    ...deps.readSessionEvents(deps.state.lastSessionTs || 0),
  ];
  const maxTs = events.reduce((m, e) => Math.max(m, e.ts || 0), deps.state.lastSessionTs || 0);
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
    state: { ...state, lastSessionTs: maxTs, lastActiveAt: Date.now(), busy },
    changes,
    activity: { busy, skillPulse },
  };
}
