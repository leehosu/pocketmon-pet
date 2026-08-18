// AI-GENERATED: 포켓몬 골드의 로컬 시계 구간(아침 04시, 낮 10시, 밤 18시)을 사용한다.
export const GOLD_TIME_PERIODS = Object.freeze(['morn', 'day', 'nite']);

export function goldTimePeriod(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const hour = date.getHours();
  if (hour >= 4 && hour < 10) return 'morn';
  if (hour >= 10 && hour < 18) return 'day';
  return 'nite';
}

export function normalizeGoldTimePeriod(value) {
  return GOLD_TIME_PERIODS.includes(value) ? value : null;
}
