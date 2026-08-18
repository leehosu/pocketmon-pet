export const GEN2_SKILLS_BY_KEY = Object.freeze({
  grass: Object.freeze([
    Object.freeze([{ slug: 'razor-leaf', name: '잎날가르기', effect: 'gsc_razor_leaf' }, { slug: 'body-slam', name: '누르기', effect: 'gsc_body_slam' }]),
    Object.freeze([{ slug: 'poison-powder', name: '독가루', effect: 'gsc_poisonpowder' }, { slug: 'synthesis', name: '광합성', effect: 'gsc_synthesis' }]),
    Object.freeze([{ slug: 'solar-beam', name: '솔라빔', effect: 'gsc_solarbeam' }, { slug: 'light-screen', name: '빛의장막', effect: 'gsc_light_screen' }]),
  ]),
  fire: Object.freeze([
    Object.freeze([{ slug: 'ember', name: '불꽃세례', effect: 'gsc_ember' }, { slug: 'smokescreen', name: '연막', effect: 'gsc_smokescreen' }]),
    Object.freeze([{ slug: 'flame-wheel', name: '화염바퀴', effect: 'gsc_flame_wheel' }, { slug: 'swift', name: '스피드스타', effect: 'gsc_swift' }]),
    Object.freeze([{ slug: 'flamethrower', name: '화염방사', effect: 'gsc_flamethrower' }, { slug: 'fire-blast', name: '불대문자', effect: 'gsc_fire_blast' }]),
  ]),
  water: Object.freeze([
    Object.freeze([{ slug: 'water-gun', name: '물대포', effect: 'gsc_water_gun' }, { slug: 'bite', name: '물기', effect: 'gsc_bite' }]),
    Object.freeze([{ slug: 'ice-punch', name: '냉동펀치', effect: 'gsc_ice_punch' }, { slug: 'scary-face', name: '겁나는얼굴', effect: 'gsc_scary_face' }]),
    Object.freeze([{ slug: 'hydro-pump', name: '하이드로펌프', effect: 'gsc_hydro_pump' }, { slug: 'slash', name: '베어가르기', effect: 'gsc_slash' }]),
  ]),
  electric: Object.freeze([
    Object.freeze([{ slug: 'thunder-shock', name: '전기쇼크', effect: 'gsc_thundershock' }, { slug: 'sweet-kiss', name: '천사의키스', effect: 'gsc_sweet_kiss' }]),
    Object.freeze([{ slug: 'thunder-wave', name: '전기자석파', effect: 'gsc_thunder_wave' }, { slug: 'quick-attack', name: '전광석화', effect: 'gsc_quick_attack' }]),
    Object.freeze([{ slug: 'thunderbolt', name: '10만볼트', effect: 'gsc_thunderbolt' }, { slug: 'thunder', name: '번개', effect: 'gsc_thunder' }]),
  ]),
});

export const GEN2_EFFECTS = new Set(
  Object.values(GEN2_SKILLS_BY_KEY).flat(2).map(({ effect }) => effect),
);

export function gen2SkillsForStage(key, stage = 0) {
  const line = GEN2_SKILLS_BY_KEY[key];
  if (!line) return [];
  return line[Math.max(0, Math.min(2, stage || 0))].map((move) => ({ ...move }));
}

export function gen2EffectForMove(key, slug) {
  return GEN2_SKILLS_BY_KEY[key]?.flat().find((move) => move.slug === slug)?.effect || null;
}

const FALLBACK_EFFECT_BY_TYPE = Object.freeze({
  grass: 'gsc_razor_leaf',
  fire: 'gsc_ember',
  water: 'gsc_water_gun',
  electric: 'gsc_thundershock',
  ice: 'gsc_ice_punch',
  dark: 'gsc_bite',
  normal: 'gsc_quick_attack',
});

// AI-GENERATED: 야생 포켓몬 기술도 기존 Gold 타일 이펙트로 표현한다.
export function gen2BattleEffectForMove(move) {
  if (!move) return null;
  const exact = Object.values(GEN2_SKILLS_BY_KEY).flat(2)
    .find((entry) => entry.slug === move.slug)?.effect;
  return exact || FALLBACK_EFFECT_BY_TYPE[move.type] || 'gsc_quick_attack';
}
