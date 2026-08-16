import { getSpeciesByKey, stageForLevel } from './roster.js';

export const XP_RULES = {
  perToolUse: 2, perSessionStart: 5,
  perTokens: 1, tokensUnit: 1000, dailyCap: 500,
  hatchXp: 30, // 알이 부화 가능(느낌표) 상태가 되는 최소 누적 XP
};

export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function levelForXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

function xpForEvent(e) {
  if (e.kind === 'toolUse') return XP_RULES.perToolUse;
  if (e.kind === 'sessionStart') return XP_RULES.perSessionStart;
  if (e.kind === 'tokens') return Math.floor((e.tokens || 0) / XP_RULES.tokensUnit) * XP_RULES.perTokens;
  return 0;
}

export function applyEvents(state, events, opts) {
  const today = opts.today;
  let s = { ...state, seenIds: [...state.seenIds] };
  if (s.dailyDate !== today) { s.dailyDate = today; s.dailyXp = 0; }
  const seen = new Set(s.seenIds);
  const startLevel = s.level;
  const startStage = s.stage;
  let reactions = 0;

  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    s.seenIds.push(e.id);
    let gain = xpForEvent(e);
    const room = Math.max(0, XP_RULES.dailyCap - s.dailyXp);
    gain = Math.min(gain, room);
    if (gain <= 0 && e.kind !== 'toolUse' && e.kind !== 'sessionStart') continue;
    s.xp += gain;
    s.dailyXp += gain;
    if (e.kind === 'toolUse' || e.kind === 'sessionStart') reactions++;
  }

  s.level = levelForXp(s.xp);
  // 진화는 자동이 아니라 사용자 클릭("!")으로만 일어난다. 여기서는 stage를 올리지 않고
  // 레벨이 허용하는 최대 단계로만 clamp(치팅으로 과도하게 올린 값 방어). 저장된 stage는 유지.
  const maxStage = stageForLevel(getSpeciesByKey(s.species), s.level);
  s.stage = Math.min(s.stage || 0, maxStage);
  const xpGained = s.xp - state.xp;

  return {
    state: s,
    changes: {
      leveledUp: s.level > startLevel,
      evolved: s.stage > startStage, // applyEvents는 진화를 트리거하지 않음(항상 false 사실상)
      xpGained,
      reactions,
    },
  };
}
