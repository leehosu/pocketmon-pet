// PokéAPI 연동(순수 부분). 포켓몬 종 데이터/스프라이트는 앱에 번들하지 않고
// 공개 PokéAPI에서 런타임에 받아 사용자 기기에 캐시한다(PokeTokenBar와 동일 방식).
// 아래 도감번호는 사실 데이터일 뿐 저작물이 아니며, 실제 스프라이트 이미지는
// 이 URL이 가리키는 공개 저장소에서 런타임에 내려받는다.

export const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-ii/gold';
// 울음소리도 앱에 번들하지 않고 공개 PokéAPI cries 저장소에서 런타임에 받는다.
export const CRY_BASE =
  'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';

// 로스터 종 키 → 진화 3단계 국가도감 번호.
const DEX = {
  grass: [152, 153, 154],   // 치코리타 → 베이리프 → 메가니움
  fire: [155, 156, 157],    // 브케인 → 마그케인 → 블레이범
  water: [158, 159, 160],   // 리아코 → 엘리게이 → 장크로다일
  electric: [172, 25, 26],  // 피츄 → 피카츄 → 라이츄
};

export function dexLine(key) {
  return DEX[key] ? DEX[key].slice() : [];
}

export function spriteUrl(dexId) {
  return `${SPRITE_BASE}/${dexId}.png`;
}

export function cryUrl(dexId) {
  return `${CRY_BASE}/${dexId}.ogg`;
}

// 기술(무브) 데이터도 앱에 넣지 않고 공개 PokéAPI에서 런타임에 조회한다.
export const API_BASE = 'https://pokeapi.co/api/v2';
export const GOLD_SILVER_VERSION_GROUP_ID = 3;
export function pokemonUrl(dexId) { return `${API_BASE}/pokemon/${dexId}`; }
export function pokemonSpeciesUrl(dexId) { return `${API_BASE}/pokemon-species/${dexId}`; }
export function pokemonEncountersUrl(dexId) { return `${API_BASE}/pokemon/${dexId}/encounters`; }
export function typeUrl(typeName) { return `${API_BASE}/type/${typeName}`; }
export function moveUrl(name) { return `${API_BASE}/move/${name}`; }

function resourceId(resource) {
  const match = String(resource?.url || '').match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

// AI-GENERATED: PokéAPI past_values는 해당 버전부터 바뀐 값의 이전 값을 담는다.
export function moveValueForVersion(move, field, versionGroupId = GOLD_SILVER_VERSION_GROUP_ID) {
  const futureChange = (move?.past_values || [])
    .filter((entry) => resourceId(entry.version_group) > versionGroupId && entry[field] != null)
    .sort((a, b) => resourceId(a.version_group) - resourceId(b.version_group))[0];
  return futureChange ? futureChange[field] : move?.[field] ?? null;
}
