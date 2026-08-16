export const ROSTER = [
  { key: 'grass', type: '풀', evolveLevels: [16, 32],
    stages: [{ name: '치코리타' }, { name: '베이리프' }, { name: '메가니움' }] },
  { key: 'fire', type: '불', evolveLevels: [16, 36],
    stages: [{ name: '브케인' }, { name: '마그케인' }, { name: '블레이범' }] },
  { key: 'water', type: '물', evolveLevels: [18, 30],
    stages: [{ name: '리아코' }, { name: '엘리게이' }, { name: '장크로다일' }] },
  { key: 'electric', type: '전기', evolveLevels: [10, 25],
    stages: [{ name: '피츄' }, { name: '피카츄' }, { name: '라이츄' }] },
];

export function getSpeciesByKey(key) {
  return ROSTER.find((s) => s.key === key);
}

export function stageForLevel(species, level) {
  if (!species) return 0;
  const [e1, e2] = species.evolveLevels;
  if (level >= e2) return 2;
  if (level >= e1) return 1;
  return 0;
}
