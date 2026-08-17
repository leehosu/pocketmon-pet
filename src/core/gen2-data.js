// AI-GENERATED: 생성된 2세대 원본 데이터에 안정적인 앱용 조회 API를 제공한다.
import {
  GEN2_HIGH_CRITICAL_MOVE_IDS,
  GEN2_MOVES,
  GEN2_SPECIES,
} from './data/gen2-data.generated.js';

const PLAYER_MOVE_CONSTANTS = Object.freeze({
  'razor-leaf': 'RAZOR_LEAF',
  'body-slam': 'BODY_SLAM',
  'poison-powder': 'POISONPOWDER',
  synthesis: 'SYNTHESIS',
  'solar-beam': 'SOLARBEAM',
  'light-screen': 'LIGHT_SCREEN',
  ember: 'EMBER',
  smokescreen: 'SMOKESCREEN',
  'flame-wheel': 'FLAME_WHEEL',
  swift: 'SWIFT',
  flamethrower: 'FLAMETHROWER',
  'fire-blast': 'FIRE_BLAST',
  'water-gun': 'WATER_GUN',
  bite: 'BITE',
  'ice-punch': 'ICE_PUNCH',
  'scary-face': 'SCARY_FACE',
  'hydro-pump': 'HYDRO_PUMP',
  slash: 'SLASH',
  'thunder-shock': 'THUNDERSHOCK',
  'sweet-kiss': 'SWEET_KISS',
  'thunder-wave': 'THUNDER_WAVE',
  'quick-attack': 'QUICK_ATTACK',
  thunderbolt: 'THUNDERBOLT',
  thunder: 'THUNDER',
});

const MOVES_BY_CONSTANT = new Map(
  Object.values(GEN2_MOVES).map((move) => [move.constant, move]),
);
const HIGH_CRITICAL_IDS = new Set(GEN2_HIGH_CRITICAL_MOVE_IDS);

export function getGen2Species(id) {
  return GEN2_SPECIES[Number(id)] || null;
}

export function getGen2MoveById(id) {
  return GEN2_MOVES[Number(id)] || null;
}

export function getGen2MoveBySlug(slug) {
  const constant = PLAYER_MOVE_CONSTANTS[slug];
  const move = constant ? MOVES_BY_CONSTANT.get(constant) : null;
  return move ? { ...move, slug } : null;
}

export function getGen2MoveByConstant(constant) {
  return MOVES_BY_CONSTANT.get(constant) || null;
}

export function isHighCriticalMove(moveOrId) {
  const id = typeof moveOrId === 'object' ? moveOrId?.id : Number(moveOrId);
  return HIGH_CRITICAL_IDS.has(id);
}

export function resourceId(resource) {
  const match = String(resource?.url || resource || '').match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}
