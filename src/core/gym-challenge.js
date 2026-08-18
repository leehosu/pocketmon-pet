// AI-GENERATED: 성도 체육관 도전의 해금 조건·파티·배지 상태를 순수 데이터로 관리한다.
export const ZEPHYR_BADGE = 'zephyr';
export const HIVE_BADGE = 'hive';
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
  role: '도라지시티 체육관 관장',
  line: '새처럼 우아한 비행포켓몬의 힘, 받아낼 수 있겠어?',
  action: '비상에게 도전한다',
  badgeKey: ZEPHYR_BADGE,
  badgeName: '윙배지',
  dvs: Object.freeze({ attack: 9, defense: 10, speed: 7, special: 7 }),
  team: Object.freeze([
    Object.freeze({ speciesId: 16, name: '구구', level: 7, moveIds: Object.freeze([33, 189]) }),
    Object.freeze({ speciesId: 17, name: '피죤', level: 9, moveIds: Object.freeze([33, 189, 16]) }),
  ]),
});

export const BUGSY_CHALLENGE = Object.freeze({
  id: 'bugsy',
  name: '호일',
  role: '고동마을 체육관 관장',
  line: '벌레포켓몬에 관한 지식이라면 누구에게도 지지 않아!',
  action: '호일에게 도전한다',
  badgeKey: HIVE_BADGE,
  badgeName: '인섹트배지',
  dvs: Object.freeze({ attack: 9, defense: 10, speed: 7, special: 7 }),
  team: Object.freeze([
    Object.freeze({ speciesId: 11, name: '단데기', level: 14, moveIds: Object.freeze([33, 81, 106]) }),
    Object.freeze({ speciesId: 14, name: '딱충이', level: 14, moveIds: Object.freeze([40, 81, 106]) }),
    Object.freeze({ speciesId: 123, name: '스라크', level: 16, moveIds: Object.freeze([98, 43, 210]) }),
  ]),
});

const KNOWN_BADGES = new Set([ZEPHYR_BADGE, HIVE_BADGE]);

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

export function awardHiveBadge(state) {
  const badges = normalizeGymBadges(state?.gymBadges);
  if (badges.includes(HIVE_BADGE)) return { ...state, gymBadges: badges };
  return { ...state, gymBadges: [...badges, HIVE_BADGE] };
}

export function trainerBattleExperience(team, experienceForSpecies) {
  if (!Array.isArray(team) || typeof experienceForSpecies !== 'function') return 0;
  return team
    .reduce((total, member) => total + Math.floor(experienceForSpecies(member.speciesId, member.level) * 1.5), 0);
}
