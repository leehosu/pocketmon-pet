import { ROSTER } from '../roster.js';

const N = 16;
export const ANIMS = ['idle', 'walk', 'run', 'skill'];
const blank = () => Array.from({ length: N }, () => Array(N).fill(0));
const clone = (f) => f.map((r) => r.slice());

// --- 애니 파생 transform (베이스 idle 프레임 1장에서 프레임들을 만든다) ---
const bob = (f) => { const g = clone(f); g.pop(); g.unshift(Array(N).fill(0)); return g; }; // 1px 위
const shiftLegs = (f) => {                       // 아랫줄만 좌우로 살짝 → 걷는 느낌
  const g = clone(f);
  const row = g[N - 1];
  g[N - 1] = [0, ...row.slice(0, N - 1)];
  return g;
};
const lean = (f) => {                             // 한 칸 앞으로 기울여 달리는 느낌
  const g = clone(f);
  for (let y = 0; y < N; y++) g[y] = [...g[y].slice(1), 0];
  return g;
};
const flash = (f, spark) => {                      // 기술: 몸 반짝 + 스파크 픽셀
  const g = clone(f);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === 1 ? false : g[y][x]) { /* keep */ }
  // 오른쪽 위에 스파크(spark 색) 몇 점
  g[3][13] = spark; g[4][14] = spark; g[2][14] = spark;
  return g;
};

const SPARK = { grass: 6, fire: 5, water: 8, electric: 3 };

// idle 베이스 → 명명 애니 세트
function buildStage(base, sparkColor) {
  return {
    idle: [base, bob(base)],
    walk: [base, shiftLegs(base)],
    run: [lean(base), lean(bob(base))],
    skill: [flash(base, sparkColor)],
  };
}

// ============================================================
// ▼ 구현자가 채우는 부분: 12개(4종×3단계) 서로 구분되는 16×16 idle 베이스 ▼
//
// 손으로 도트를 배치하되, 타이핑 오류(행 길이 어긋남)를 막기 위해
// 작은 픽셀아트 헬퍼 3개만 사용한다(모두 항상 정확히 16칸짜리 행을 반환):
//   row(width, fillColor, {eyes, belly}) — 중심 정렬된 대칭 몸통 한 줄
//     (좌우 끝은 윤곽선(1), 내부는 fillColor, eyes/belly로 일부 픽셀 덮어씀)
//   mrow(...[start, end, color])         — 임의 구간을 칠한 빈 줄(잎/불꽃/귀 등 비대칭 장식)
//   paint(row, [[col, color], ...])      — 만들어진 줄 위에 몇 픽셀만 덧칠(볼/꼬리 등)
// 팔레트: 0 투명, 1 윤곽(검), 2 흰, 3 노랑, 4 주황, 5 빨강, 6 초록, 7 파랑, 8 하늘,
//         9 갈색, 10 분홍(피부), 11 회색.
// ============================================================

const row = (width, fill, opts = {}) => {
  const r = Array(N).fill(0);
  if (width <= 0) return r;
  const left = 8 - Math.floor(width / 2);
  const right = left + width - 1;
  for (let c = left; c <= right; c++) r[c] = fill;
  r[left] = 1;
  r[right] = 1;
  if (opts.belly) {
    const [bs, be, color] = opts.belly;
    for (let c = bs; c <= be; c++) if (c > left && c < right) r[c] = color;
  }
  if (opts.eyes) for (const [c, color] of opts.eyes) r[c] = color;
  return r;
};
const mrow = (...segs) => {
  const r = Array(N).fill(0);
  for (const [s, e, v] of segs) for (let c = s; c <= e; c++) r[c] = v;
  return r;
};
const paint = (r, edits) => {
  const g = r.slice();
  for (const [c, v] of edits) g[c] = v;
  return g;
};

// ---------- 풀(grass) 초록6/흰2 — 작은 새싹 잎(1단계) → 옆잎(2단계) → 꽃깃(3단계) ----------
const GRASS_0 = [
  mrow(),
  row(2, 6),
  row(4, 6),
  row(4, 6),
  mrow([7, 8, 6]),
  row(4, 6),
  row(6, 6),
  row(8, 6),
  row(10, 6, { eyes: [[5, 1], [10, 1]] }),
  row(10, 6),
  row(10, 6, { belly: [6, 9, 2] }),
  row(10, 6, { belly: [6, 9, 2] }),
  row(8, 6),
  row(6, 6),
  mrow([4, 4, 1], [5, 5, 6], [6, 6, 1], [9, 9, 1], [10, 10, 6], [11, 11, 1]),
  mrow(),
];
const GRASS_1 = [
  mrow(),
  row(2, 6),
  row(4, 6),
  row(4, 6),
  mrow([6, 9, 6]),
  row(6, 6),
  row(8, 6),
  paint(row(10, 6), [[0, 1], [1, 6], [14, 6], [15, 1]]),
  row(12, 6, { eyes: [[4, 1], [11, 1]] }),
  row(12, 6),
  row(12, 6, { belly: [5, 10, 2] }),
  row(12, 6, { belly: [5, 10, 2] }),
  row(10, 6),
  row(8, 6),
  mrow([4, 4, 1], [5, 6, 6], [7, 7, 1], [8, 8, 1], [9, 10, 6], [11, 11, 1]),
  mrow(),
];
const GRASS_2 = [
  row(4, 6),
  row(6, 6),
  row(8, 6),
  row(8, 6),
  mrow([5, 10, 6]),
  row(8, 6),
  row(10, 6),
  paint(row(14, 6), [[0, 2], [15, 2]]),
  row(14, 6, { eyes: [[4, 1], [11, 1]] }),
  row(14, 6, { belly: [6, 9, 2] }),
  row(14, 6, { belly: [6, 9, 2] }),
  row(12, 6),
  row(10, 6),
  row(8, 6),
  mrow([3, 3, 1], [4, 5, 6], [6, 6, 1], [9, 9, 1], [10, 11, 6], [12, 12, 1]),
  mrow(),
];

// ---------- 불(fire) 주황4/빨강5 — 작은 불꽃(1단계) → 큰 불꽃(2단계) → 볏+꼬리불(3단계) ----------
const FIRE_0 = [
  mrow(),
  mrow([9, 9, 1]),
  mrow([8, 9, 5], [10, 10, 1]),
  mrow([7, 7, 1], [8, 9, 4], [10, 10, 5], [11, 11, 1]),
  row(4, 4),
  row(6, 4),
  row(8, 4),
  row(10, 4, { eyes: [[5, 1], [10, 1]] }),
  row(10, 4),
  row(10, 4, { belly: [6, 9, 5] }),
  row(10, 4, { belly: [6, 9, 5] }),
  row(8, 4),
  row(6, 4),
  mrow([5, 5, 1], [6, 6, 4], [7, 7, 1], [8, 8, 1], [9, 9, 4], [10, 10, 1]),
  mrow(),
  mrow(),
];
const FIRE_1 = [
  mrow([8, 9, 1]),
  mrow([7, 9, 5], [10, 10, 1]),
  mrow([6, 6, 1], [7, 9, 4], [10, 10, 5], [11, 11, 1]),
  mrow([6, 6, 1], [7, 10, 4], [11, 11, 1]),
  row(6, 4),
  row(8, 4),
  row(10, 4),
  row(12, 4, { eyes: [[4, 1], [11, 1]] }),
  row(12, 4),
  row(12, 4, { belly: [5, 10, 5] }),
  row(12, 4, { belly: [5, 10, 5] }),
  row(10, 4),
  row(8, 4),
  mrow([4, 4, 1], [5, 6, 4], [7, 7, 1], [8, 8, 1], [9, 10, 4], [11, 11, 1]),
  mrow(),
  mrow(),
];
const FIRE_2 = [
  mrow([7, 8, 1]),
  mrow([5, 5, 1], [6, 9, 5], [10, 10, 1]),
  mrow([5, 5, 1], [6, 9, 4], [10, 10, 5], [11, 11, 1]),
  mrow([5, 5, 1], [6, 11, 4], [12, 12, 1]),
  row(8, 4),
  row(10, 4),
  row(12, 4),
  row(14, 4, { eyes: [[4, 1], [11, 1]] }),
  row(14, 4),
  row(14, 4, { belly: [6, 9, 5] }),
  row(14, 4, { belly: [6, 9, 5] }),
  paint(row(12, 4), [[14, 5], [15, 1]]),
  row(10, 4),
  mrow([4, 4, 1], [5, 6, 4], [7, 7, 1], [8, 8, 1], [9, 10, 4], [11, 11, 1]),
  mrow(),
  mrow(),
];

// ---------- 물(water) 파랑7/하늘8 — 작은 등지느러미(1단계) → 꼬리지느러미(2단계) → 큰 볏+꼬리(3단계) ----------
const WATER_0 = [
  mrow(),
  mrow(),
  mrow([9, 10, 1]),
  mrow([8, 8, 1], [9, 10, 8], [11, 11, 1]),
  row(4, 7),
  row(6, 7),
  row(8, 7),
  row(10, 7, { eyes: [[5, 1], [10, 1]] }),
  row(10, 7),
  row(10, 7, { belly: [6, 9, 8] }),
  row(10, 7, { belly: [6, 9, 8] }),
  row(8, 7),
  row(6, 7),
  mrow([5, 5, 1], [6, 6, 7], [7, 7, 1], [8, 8, 1], [9, 9, 7], [10, 10, 1]),
  mrow(),
  mrow(),
];
const WATER_1 = [
  mrow(),
  mrow([9, 10, 1]),
  mrow([8, 8, 1], [9, 10, 8], [11, 11, 1]),
  mrow([7, 7, 1], [8, 11, 8], [12, 12, 1]),
  row(6, 7),
  row(8, 7),
  row(10, 7),
  row(12, 7, { eyes: [[4, 1], [11, 1]] }),
  row(12, 7),
  row(12, 7, { belly: [5, 10, 8] }),
  row(12, 7, { belly: [5, 10, 8] }),
  paint(row(10, 7), [[13, 8], [14, 1]]),
  row(8, 7),
  mrow([4, 4, 1], [5, 6, 7], [7, 7, 1], [8, 8, 1], [9, 10, 7], [11, 11, 1]),
  mrow(),
  mrow(),
];
const WATER_2 = [
  mrow([8, 9, 1]),
  mrow([7, 7, 1], [8, 10, 8], [11, 11, 1]),
  mrow([6, 6, 1], [7, 11, 8], [12, 12, 1]),
  mrow([6, 6, 1], [7, 12, 8], [13, 13, 1]),
  row(8, 7),
  row(10, 7),
  row(12, 7),
  row(14, 7, { eyes: [[4, 1], [11, 1]] }),
  row(14, 7),
  row(14, 7, { belly: [6, 9, 8] }),
  row(14, 7, { belly: [6, 9, 8] }),
  paint(row(12, 7), [[14, 8], [15, 1]]),
  row(10, 7),
  mrow([4, 4, 1], [5, 6, 7], [7, 7, 1], [8, 8, 1], [9, 10, 7], [11, 11, 1]),
  mrow(),
  mrow(),
];

// ---------- 전기(electric) 노랑3/피부(분홍)10 — 뾰족귀(1단계) → 큰귀+꼬리싹(2단계) → 번개꼬리(3단계) ----------
const ELECTRIC_0 = [
  mrow(),
  mrow([5, 5, 1], [10, 10, 1]),
  mrow([4, 5, 3], [6, 6, 1], [9, 9, 1], [10, 11, 3]),
  row(6, 3),
  row(8, 3),
  row(10, 3, { eyes: [[5, 1], [10, 1]] }),
  row(10, 3),
  paint(row(10, 3), [[4, 10], [11, 10]]),
  row(10, 3),
  row(8, 3),
  row(6, 3),
  mrow([5, 5, 1], [6, 6, 3], [7, 7, 1], [8, 8, 1], [9, 9, 3], [10, 10, 1]),
  mrow(),
  mrow(),
  mrow(),
  mrow(),
];
const ELECTRIC_1 = [
  mrow([5, 5, 1], [10, 10, 1]),
  mrow([4, 5, 3], [6, 6, 1], [9, 9, 1], [10, 11, 3]),
  mrow([4, 4, 1], [5, 6, 3], [9, 10, 3], [11, 11, 1]),
  row(8, 3),
  row(10, 3),
  row(12, 3, { eyes: [[4, 1], [11, 1]] }),
  row(12, 3),
  paint(row(12, 3), [[3, 10], [12, 10]]),
  row(12, 3),
  row(10, 3),
  row(8, 3),
  paint(row(6, 3), [[13, 3], [14, 1]]),
  mrow([5, 5, 1], [6, 7, 3], [8, 8, 1], [9, 9, 1], [10, 11, 3], [12, 12, 1]),
  mrow(),
  mrow(),
  mrow(),
];
const ELECTRIC_2 = [
  mrow([4, 4, 1], [11, 11, 1]),
  mrow([3, 4, 3], [5, 5, 1], [10, 10, 1], [11, 12, 3]),
  mrow([3, 3, 1], [4, 5, 3], [10, 11, 3], [12, 12, 1]),
  mrow([3, 3, 1], [4, 11, 3], [12, 12, 1]),
  row(10, 3),
  row(12, 3),
  row(14, 3, { eyes: [[4, 1], [11, 1]] }),
  paint(row(14, 3), [[4, 10], [11, 10]]),
  row(14, 3),
  row(12, 3),
  row(10, 3),
  paint(row(8, 3), [[14, 3], [15, 1]]),
  mrow([12, 12, 1], [13, 13, 3], [14, 14, 1]),
  mrow([5, 5, 1], [6, 7, 3], [8, 8, 1], [9, 9, 1], [10, 11, 3], [12, 12, 1]),
  mrow(),
  mrow(),
];

const IDLE_BASE = {
  grass: [GRASS_0, GRASS_1, GRASS_2],
  fire: [FIRE_0, FIRE_1, FIRE_2],
  water: [WATER_0, WATER_1, WATER_2],
  electric: [ELECTRIC_0, ELECTRIC_1, ELECTRIC_2],
};
// ▲▲▲ 12칸 모두 채움(빈 칸 없음) ▲▲▲

// 부화 전 "알" — 어떤 포켓몬인지 알 수 없는 상태. 크림색 오리지널 도트(갈색 점).
const EGG_BASE = [
  mrow(), mrow(), mrow(),
  row(4, 2),
  row(6, 2),
  paint(row(6, 2), [[6, 9]]),
  row(8, 2),
  paint(row(8, 2), [[5, 9], [10, 9]]),
  row(10, 2),
  paint(row(10, 2), [[6, 9]]),
  row(10, 2),
  paint(row(10, 2), [[9, 9]]),
  row(8, 2),
  row(6, 2),
  mrow(), mrow(),
];

export const SPRITES = Object.fromEntries(
  ROSTER.map((s) => [s.key,
    IDLE_BASE[s.key].map((base) => buildStage(base, SPARK[s.key])),
  ]),
);
// 알은 1단계짜리 특수 스프라이트(로스터 밖).
SPRITES.egg = [buildStage(EGG_BASE, 2)];

export function getFrames(species, stage, anim) {
  const set = SPRITES[species] && SPRITES[species][stage];
  if (!set) return SPRITES.egg[0].idle; // 알 수 없는 종 → 알 프레임으로 폴백
  return set[anim] || set.idle;
}
