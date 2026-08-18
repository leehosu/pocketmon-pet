// AI-GENERATED: 성도 체육관 도전의 해금 조건·파티·배지 상태를 순수 데이터로 관리한다.
export const ZEPHYR_BADGE = 'zephyr';
export const FALKNER_REQUIRED_WINS = 3;
export const FALKNER_REQUIRED_LEVEL = 7;
export const FALKNER_MIN_APPEAR_DELAY_MS = 2 * 60 * 1000;
export const FALKNER_MAX_APPEAR_DELAY_MS = 5 * 60 * 1000;
export const FALKNER_APPEARANCE_MS = 60 * 1000;
export const FALKNER_RETRY_MS = 30 * 60 * 1000;
export const FALKNER_LOSS_RETRY_MS = 15 * 60 * 1000;

export const FALKNER_CHALLENGE = Object.freeze({
  id: 'falkner',
  name: '비상',
  badgeKey: ZEPHYR_BADGE,
  badgeName: '윙배지',
  dvs: Object.freeze({ attack: 9, defense: 10, speed: 7, special: 7 }),
  team: Object.freeze([
    Object.freeze({ speciesId: 16, name: '구구', level: 7, moveIds: Object.freeze([33, 189]) }),
    Object.freeze({ speciesId: 17, name: '피죤', level: 9, moveIds: Object.freeze([33, 189, 16]) }),
  ]),
});

const KNOWN_BADGES = new Set([ZEPHYR_BADGE]);

export function normalizeGymBadges(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((badge) => KNOWN_BADGES.has(badge)))];
}

export function canChallengeFalkner(state) {
  if (!state?.hatched) return false;
  const badges = normalizeGymBadges(state.gymBadges);
  const wins = Math.max(0, Math.floor(Number(state.battleProfile?.wins) || 0));
  const level = Math.max(1, Math.floor(Number(state.level) || 1));
  return level >= FALKNER_REQUIRED_LEVEL
    && wins >= FALKNER_REQUIRED_WINS
    && !badges.includes(ZEPHYR_BADGE);
}

export function falknerAppearanceDelayMs(rng = Math.random) {
  const value = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
  const span = FALKNER_MAX_APPEAR_DELAY_MS - FALKNER_MIN_APPEAR_DELAY_MS;
  return FALKNER_MIN_APPEAR_DELAY_MS + Math.floor(value * (span + 1));
}

export function awardZephyrBadge(state) {
  const badges = normalizeGymBadges(state?.gymBadges);
  if (badges.includes(ZEPHYR_BADGE)) return { ...state, gymBadges: badges };
  return { ...state, gymBadges: [...badges, ZEPHYR_BADGE] };
}

export function trainerBattleExperience(team, experienceForSpecies) {
  if (!Array.isArray(team) || typeof experienceForSpecies !== 'function') return 0;
  return team
    .reduce((total, member) => total + Math.floor(experienceForSpecies(member.speciesId, member.level) * 1.5), 0);
}
