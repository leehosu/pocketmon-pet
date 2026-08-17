// AI-GENERATED: 실행 중에만 진행되는 잘린 기하분포 야생 조우 스케줄.
export const ENCOUNTER_MIN_DELAY_MS = 10 * 60 * 1000;
export const ENCOUNTER_MAX_DELAY_MS = 120 * 60 * 1000;
export const ENCOUNTER_MIN_VISIBLE_MS = 15 * 1000;
export const ENCOUNTER_MAX_VISIBLE_MS = 45 * 1000;
export const ENCOUNTER_CHANCE_PER_MINUTE = 1 / 30;

function unitRandom(rng) {
  const value = Number(rng());
  return Math.max(0, Math.min(0.999999999, Number.isFinite(value) ? value : 0));
}

export function nextEncounterDelayMs(rng = Math.random) {
  const minute = 60 * 1000;
  const minMinutes = ENCOUNTER_MIN_DELAY_MS / minute;
  const maxMinutes = ENCOUNTER_MAX_DELAY_MS / minute;
  for (let minuteOffset = 0; minMinutes + minuteOffset < maxMinutes; minuteOffset += 1) {
    if (unitRandom(rng) < ENCOUNTER_CHANCE_PER_MINUTE) {
      return (minMinutes + minuteOffset) * minute;
    }
  }
  return ENCOUNTER_MAX_DELAY_MS;
}

export function wildAppearanceDurationMs(rng = Math.random) {
  const span = ENCOUNTER_MAX_VISIBLE_MS - ENCOUNTER_MIN_VISIBLE_MS;
  return ENCOUNTER_MIN_VISIBLE_MS + Math.floor(unitRandom(rng) * (span + 1));
}

export function canScheduleEncounter({ hatched, battling = false, encounterActive = false, cooldownUntil = 0 }, now = Date.now()) {
  return Boolean(hatched && !battling && !encounterActive && Number(cooldownUntil || 0) <= now);
}
