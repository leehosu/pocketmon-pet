// AI-GENERATED: 메인 프로세스의 기술 이펙트와 렌더러의 대사·피격 타이밍을 같은 축에 맞춘다.
export const BATTLE_ACTION_MS = 1700;
export const BATTLE_IMPACT_MS = 700;
export const BATTLE_DETAIL_MS = 350;

const ACTION_KINDS = new Set(['move', 'unable']);

export function battleEventSchedule(events = []) {
  let actionIndex = -1;
  let detailIndex = 0;

  return events.map((event) => {
    if (ACTION_KINDS.has(event?.kind)) {
      actionIndex += 1;
      detailIndex = 0;
      return { event, at: actionIndex * BATTLE_ACTION_MS };
    }

    const actionStart = Math.max(0, actionIndex) * BATTLE_ACTION_MS;
    const at = actionStart + (actionIndex < 0 ? 0 : BATTLE_IMPACT_MS)
      + detailIndex * BATTLE_DETAIL_MS;
    detailIndex += 1;
    return { event, at };
  });
}

export function battleTimelineDuration(events = []) {
  const schedule = battleEventSchedule(events);
  if (!schedule.length) return 0;
  return Math.max(...schedule.map(({ at }) => at)) + BATTLE_DETAIL_MS;
}
