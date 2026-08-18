import { getSpeciesByKey, stageForLevel } from './roster.js';

export const XP_RULES = {
  perToolUse: 2, perSessionStart: 5,
  perTokens: 1, tokensUnit: 1000, dailyCap: 500,
  hatchXp: 30, // 알이 부화 가능(느낌표) 상태가 되는 최소 누적 XP
};

// seenIds는 "이미 XP로 반영한 이벤트" 중복 방지용이다. 중복 차단은 이미 두 겹으로
// 걸려 있고(hook은 ~/.pocketmon/offset, session 로그는 lastSessionTs 커서), seenIds는
// 그 커서가 저장에 실패한 tick을 막는 마지막 그물이다. 즉 "최근 몇 tick" 범위만 필요한데
// 무제한 누적하면 save.json이 영구히 커지고(토큰 이벤트는 어시스턴트 메시지마다 1건)
// 매 tick 전체를 pretty-print로 다시 쓰게 된다. 최근 N개로 자른다.
export const SEEN_ID_LIMIT = 2000;

export function trimSeenIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.length > SEEN_ID_LIMIT ? ids.slice(-SEEN_ID_LIMIT) : ids;
}

// 일일 상한(dailyCap)의 "하루"는 사용자가 체감하는 로컬 자정 기준이어야 한다.
// toISOString()은 UTC라 KST(+9)에선 매일 오전 9시에 상한이 리셋된다.
export function localDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

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

  s.seenIds = trimSeenIds(s.seenIds);
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

// AI-GENERATED: 야생전 보상은 에이전트 활동 일일 상한과 분리해 총 XP에 직접 반영한다.
export function applyBattleExperience(state, amount) {
  const gain = Math.max(0, Math.floor(Number(amount) || 0));
  const startLevel = state.level || levelForXp(state.xp || 0);
  const startStage = state.stage || 0;
  const next = { ...state, xp: (state.xp || 0) + gain };
  next.level = levelForXp(next.xp);
  const maxStage = stageForLevel(getSpeciesByKey(next.species), next.level);
  next.stage = Math.min(next.stage || 0, maxStage);
  return {
    state: next,
    changes: {
      leveledUp: next.level > startLevel,
      evolved: next.stage > startStage,
      xpGained: gain,
      reactions: gain > 0 ? 1 : 0,
      battleReward: true,
    },
  };
}
