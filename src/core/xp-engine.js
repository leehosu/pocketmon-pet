import { getSpeciesByKey, stageForLevel } from './roster.js';

export const XP_RULES = {
  perToolUse: 2, perSessionStart: 5,
  perTokens: 1, tokensUnit: 1000, dailyCap: 500,
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
  s.stage = stageForLevel(getSpeciesByKey(s.species), s.level);
  const xpGained = s.xp - state.xp;

  return {
    state: s,
    changes: {
      leveledUp: s.level > startLevel,
      evolved: s.stage > startStage,
      xpGained,
      reactions,
    },
  };
}
