// 배틀 화면(GSC 배틀 UI)의 순수 표시 로직. DOM을 만지지 않으므로 그대로 테스트한다.

// 한글 받침 유무로 조사를 고른다. 원작 배틀 메시지가 "피카츄는 / 리아코는" 처럼
// 조사를 붙여 읽히므로 "은(는)" 병기 대신 실제 조사를 쓴다.
// pair는 [받침 있을 때, 받침 없을 때] 순서다. 예: ['은','는'], ['이','가'], ['을','를'].
export function withParticle(word, [withFinal, withoutFinal]) {
  const text = String(word ?? '').trim();
  if (!text) return '';
  const code = text.charCodeAt(text.length - 1);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangulSyllable) return `${text}${withFinal}(${withoutFinal})`; // 한글이 아니면 병기
  const hasFinal = (code - 0xac00) % 28 !== 0;
  return `${text}${hasFinal ? withFinal : withoutFinal}`;
}

export function introMessage(enemyName) {
  return `앗! 야생 ${withParticle(enemyName, ['이', '가'])} 나타났다!`;
}

export function promptMessage(playerName) {
  return `${withParticle(playerName, ['은', '는'])} 무엇을 할까?`;
}

// GSC의 HP 게이지는 48픽셀짜리 막대라 칸 단위로만 움직인다.
// 비율을 그대로 쓰지 않고 48등분으로 스냅해 원작의 뚝뚝 끊기는 느낌을 낸다.
export const HP_BAR_CELLS = 48;

export function hpBarPercent(hp, maxHp) {
  const max = Math.max(1, Number(maxHp) || 1);
  const current = Math.max(0, Math.min(max, Number(hp) || 0));
  const cells = Math.round((current / max) * HP_BAR_CELLS);
  // 살아 있는데 0칸으로 보이면 안 된다(원작도 1칸은 남긴다).
  const shown = current > 0 ? Math.max(1, cells) : 0;
  return (shown / HP_BAR_CELLS) * 100;
}

// 원작 색 전환 기준: 절반 이하 노랑, 20% 이하 빨강.
export function hpTone(hp, maxHp) {
  const max = Math.max(1, Number(maxHp) || 1);
  const ratio = Math.max(0, Math.min(1, (Number(hp) || 0) / max));
  if (ratio <= 0.2) return 'low';
  if (ratio <= 0.5) return 'mid';
  return 'high';
}

const TYPE_LABEL = Object.freeze({
  normal: '노말', fire: '불꽃', water: '물', electric: '전기', grass: '풀',
  ice: '얼음', fighting: '격투', poison: '독', ground: '땅', flying: '비행',
  psychic: '에스퍼', bug: '벌레', rock: '바위', ghost: '고스트', dragon: '드래곤',
  dark: '악', steel: '강철',
});

export function typeLabel(type) {
  return TYPE_LABEL[type] || String(type || '???').toUpperCase();
}

// 렌더러가 받는 두 소스를 slug로 합친다.
// playerMoves = {slug,name,effect} (한글 기술명), engineMoves = 전투 엔진의 2세대 원본(타입/PP/위력).
export function moveMenuModel(playerMoves = [], engineMoves = []) {
  const bySlug = new Map((engineMoves || []).filter(Boolean).map((move) => [move.slug, move]));
  return (playerMoves || []).map((move) => {
    const engine = bySlug.get(move.slug) || {};
    return {
      slug: move.slug,
      name: move.name,
      effect: move.effect,
      type: engine.type || null,
      pp: Number.isFinite(engine.pp) ? engine.pp : null,
      power: Number.isFinite(engine.power) && engine.power > 0 ? engine.power : null,
    };
  });
}
