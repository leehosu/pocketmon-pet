// AI-GENERATED: 골드의 야돈의 우물 사건을 별도 스토리 화면 없이 순차 트레이너 이벤트로 구성한다.
import { HIVE_BADGE, ZEPHYR_BADGE, normalizeGymBadges } from './gym-challenge.js';

export const SLOWPOKE_WELL_REQUIRED_LEVEL = 14;

export const ROCKET_GRUNTS = Object.freeze([
  Object.freeze({
    id: 'rocket-grunt-1', name: '로켓단 조무래기', role: '야돈의 우물 · 로켓단', gender: 'm',
    line: '이 우물은 로켓단이 접수했다! 방해하면 혼내주지!', action: '로켓단을 막는다',
    team: Object.freeze([
      Object.freeze({ speciesId: 19, name: '꼬렛', level: 9 }),
      Object.freeze({ speciesId: 19, name: '꼬렛', level: 9 }),
    ]),
  }),
  Object.freeze({
    id: 'rocket-grunt-2', name: '로켓단 조무래기', role: '야돈의 우물 · 로켓단', gender: 'm',
    line: '야돈의 꼬리는 비싸게 팔린다고! 애송이는 빠져!', action: '계속 전진한다',
    team: Object.freeze([
      Object.freeze({ speciesId: 19, name: '꼬렛', level: 7 }),
      Object.freeze({ speciesId: 41, name: '주뱃', level: 9 }),
      Object.freeze({ speciesId: 41, name: '주뱃', level: 9 }),
    ]),
  }),
  Object.freeze({
    id: 'rocket-grunt-3', name: '로켓단 조무래기', role: '야돈의 우물 · 로켓단', gender: 'f',
    line: '우릴 여기까지 몰아붙이다니… 그래도 여기서 끝이야!', action: '야돈들을 구한다',
    team: Object.freeze([
      Object.freeze({ speciesId: 41, name: '주뱃', level: 9 }),
      Object.freeze({ speciesId: 23, name: '아보', level: 11 }),
    ]),
  }),
  Object.freeze({
    id: 'rocket-grunt-4', name: '로켓단 조무래기', role: '야돈의 우물 · 로켓단', gender: 'm',
    line: '로켓단의 무서움을 똑똑히 보여주마!', action: '마지막 단원을 막는다',
    team: Object.freeze([
      Object.freeze({ speciesId: 109, name: '또가스', level: 14 }),
    ]),
  }),
]);

export function normalizeStoryProgress(value) {
  const grunts = Math.max(0, Math.min(ROCKET_GRUNTS.length, Math.floor(Number(value?.slowpokeWellGrunts) || 0)));
  return { slowpokeWellGrunts: grunts, slowpokeWellCleared: grunts >= ROCKET_GRUNTS.length };
}

export function canStartSlowpokeWell(state) {
  const badges = normalizeGymBadges(state?.gymBadges);
  const progress = normalizeStoryProgress(state?.storyProgress);
  return Boolean(state?.hatched)
    && Math.max(1, Math.floor(Number(state?.level) || 1)) >= SLOWPOKE_WELL_REQUIRED_LEVEL
    && badges.includes(ZEPHYR_BADGE)
    && !badges.includes(HIVE_BADGE)
    && !progress.slowpokeWellCleared;
}

export function currentRocketGrunt(state) {
  if (!canStartSlowpokeWell(state)) return null;
  return ROCKET_GRUNTS[normalizeStoryProgress(state.storyProgress).slowpokeWellGrunts] || null;
}

export function recordRocketGruntVictory(state, trainerId) {
  const progress = normalizeStoryProgress(state?.storyProgress);
  const expected = ROCKET_GRUNTS[progress.slowpokeWellGrunts];
  if (!expected || expected.id !== trainerId) return { ...state, storyProgress: progress };
  return {
    ...state,
    storyProgress: normalizeStoryProgress({ slowpokeWellGrunts: progress.slowpokeWellGrunts + 1 }),
  };
}

export function canChallengeBugsy(state) {
  const badges = normalizeGymBadges(state?.gymBadges);
  return Boolean(state?.hatched)
    && badges.includes(ZEPHYR_BADGE)
    && !badges.includes(HIVE_BADGE)
    && normalizeStoryProgress(state?.storyProgress).slowpokeWellCleared;
}
