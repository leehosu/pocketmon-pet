// AI-GENERATED: 앱의 24개 기술과 야생 반격을 처리하는 2세대 전투 상태 머신.
import {
  getGen2MoveById,
  getGen2MoveBySlug,
  getGen2Species,
  isHighCriticalMove,
} from './gen2-data.js';
import {
  applyStatStage,
  calculateGen2Damage,
  doesMoveHit,
  isCriticalHit,
  isPhysicalType,
  typeEffectiveness,
} from './gen2-damage.js';
import { calculateGen2Stats } from './gen2-stats.js';

const STRUGGLE = Object.freeze({
  id: 165,
  slug: 'struggle',
  constant: 'STRUGGLE',
  effect: 'EFFECT_RECOIL_HIT',
  power: 50,
  type: 'normal',
  accuracyByte: 255,
  effectChanceByte: 0,
  typeless: true,
});

const STAGE_TEMPLATE = Object.freeze({
  attack: 0,
  defense: 0,
  speed: 0,
  specialAttack: 0,
  specialDefense: 0,
  accuracy: 0,
  evasion: 0,
});

const SUPPORTED_WILD_DAMAGE_EFFECTS = new Set([
  'EFFECT_NORMAL_HIT',
  'EFFECT_PRIORITY_HIT',
  'EFFECT_ALWAYS_HIT',
  'EFFECT_PARALYZE_HIT',
  'EFFECT_BURN_HIT',
  'EFFECT_FREEZE_HIT',
  'EFFECT_FLINCH_HIT',
  'EFFECT_FLAME_WHEEL',
  'EFFECT_THUNDER',
  'EFFECT_STOMP',
  'EFFECT_RECOIL_HIT',
  'EFFECT_LEECH_HIT',
  'EFFECT_ATTACK_DOWN_HIT',
  'EFFECT_DEFENSE_DOWN_HIT',
  'EFFECT_SPEED_DOWN_HIT',
  'EFFECT_SP_DEF_DOWN_HIT',
]);

function randomByte(rng) {
  const value = Number(rng());
  return Math.max(0, Math.min(255, Math.floor((Number.isFinite(value) ? value : 0) * 256)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function moveFrom(value) {
  if (value && typeof value === 'object') {
    const base = value.slug ? getGen2MoveBySlug(value.slug) : getGen2MoveById(value.id);
    return base ? { ...base, ...value } : null;
  }
  return typeof value === 'number' ? getGen2MoveById(value) : getGen2MoveBySlug(value);
}

function createCombatant(input) {
  const species = getGen2Species(input.speciesId);
  if (!species) throw new Error(`Unknown Generation II species: ${input.speciesId}`);
  const level = Math.max(1, Math.min(100, Math.floor(Number(input.level) || 1)));
  const stats = calculateGen2Stats(species, level, input.dvs, input.statExp);
  const moves = (input.moves || []).map(moveFrom).filter(Boolean);
  return {
    speciesId: species.id,
    name: input.name || species.constant,
    level,
    types: species.types.slice(),
    stats,
    maxHp: stats.hp,
    hp: stats.hp,
    moves: moves.length ? moves : [{ ...STRUGGLE }],
    status: null,
    confusionTurns: 0,
    flinched: false,
    chargingMove: null,
    lightScreenTurns: 0,
    stages: { ...STAGE_TEMPLATE },
  };
}

export function createGen2Battle({ player, enemy }) {
  return {
    turn: 1,
    winner: null,
    player: createCombatant(player),
    enemy: createCombatant(enemy),
  };
}

export function isSupportedWildMove(moveOrId) {
  const move = moveFrom(moveOrId);
  return Boolean(move && move.power > 0 && SUPPORTED_WILD_DAMAGE_EFFECTS.has(move.effect));
}

function movePriority(move) {
  return move.effect === 'EFFECT_PRIORITY_HIT' ? 1 : 0;
}

function effectiveSpeed(combatant) {
  let speed = applyStatStage(combatant.stats.speed, combatant.stages.speed);
  if (combatant.status === 'paralysis') speed = Math.max(1, Math.floor(speed / 4));
  return speed;
}

function orderActions(state, playerMove, enemyMove, rng) {
  const playerAction = { actor: 'player', target: 'enemy', move: playerMove };
  const enemyAction = { actor: 'enemy', target: 'player', move: enemyMove };
  const priorityDiff = movePriority(playerMove) - movePriority(enemyMove);
  if (priorityDiff !== 0) return priorityDiff > 0 ? [playerAction, enemyAction] : [enemyAction, playerAction];
  const speedDiff = effectiveSpeed(state.player) - effectiveSpeed(state.enemy);
  if (speedDiff !== 0) return speedDiff > 0 ? [playerAction, enemyAction] : [enemyAction, playerAction];
  return randomByte(rng) < 128 ? [playerAction, enemyAction] : [enemyAction, playerAction];
}

function pushMoveEvent(events, actor, move) {
  events.push({
    kind: 'move',
    actor,
    moveId: move.id,
    moveSlug: move.slug || null,
    move: move.constant,
  });
}

function checkFaint(state, key, events) {
  const combatant = state[key];
  if (combatant.hp > 0) return false;
  combatant.hp = 0;
  if (!events.some((event) => event.kind === 'faint' && event.target === key)) {
    events.push({ kind: 'faint', target: key });
  }
  state.winner = key === 'enemy' ? 'player' : 'enemy';
  return true;
}

function selfConfusionDamage(combatant, rng) {
  const attack = applyStatStage(combatant.stats.attack, combatant.stages.attack);
  const defense = applyStatStage(combatant.stats.defense, combatant.stages.defense);
  return calculateGen2Damage({
    level: combatant.level,
    power: 40,
    attack,
    defense,
    moveType: 'typeless',
    attackerTypes: [],
    defenderTypes: [],
    randomByte: Math.max(217, randomByte(rng)),
    critical: false,
  }).damage;
}

function canAct(state, actorKey, move, rng, events) {
  const actor = state[actorKey];
  if (actor.flinched) {
    events.push({ kind: 'unable', actor: actorKey, reason: 'flinch' });
    return false;
  }
  if (actor.status === 'freeze') {
    if (move.effect === 'EFFECT_FLAME_WHEEL') {
      actor.status = null;
      events.push({ kind: 'status-cleared', target: actorKey, status: 'freeze' });
    } else {
      events.push({ kind: 'unable', actor: actorKey, reason: 'freeze' });
      return false;
    }
  }
  if (actor.status === 'paralysis' && randomByte(rng) < 63) {
    events.push({ kind: 'unable', actor: actorKey, reason: 'paralysis' });
    return false;
  }
  if (actor.confusionTurns > 0) {
    actor.confusionTurns -= 1;
    if (actor.confusionTurns === 0) {
      events.push({ kind: 'status-cleared', target: actorKey, status: 'confusion' });
    } else if (randomByte(rng) < 128) {
      const amount = Math.min(actor.hp, selfConfusionDamage(actor, rng));
      actor.hp -= amount;
      events.push({ kind: 'damage', target: actorKey, amount, hp: actor.hp, cause: 'confusion', effectiveness: 1, critical: false });
      checkFaint(state, actorKey, events);
      return false;
    }
  }
  return true;
}

function changeStage(target, key, amount, events, targetKey) {
  const before = target.stages[key];
  target.stages[key] = Math.max(-6, Math.min(6, before + amount));
  const actual = target.stages[key] - before;
  events.push({ kind: 'stat', target: targetKey, stat: key, change: actual });
  return actual !== 0;
}

function statusImmune(target, status) {
  if (status === 'poison') return target.types.includes('poison') || target.types.includes('steel');
  if (status === 'burn') return target.types.includes('fire');
  if (status === 'freeze') return target.types.includes('ice');
  return false;
}

function applyMajorStatus(target, targetKey, status, events) {
  if (target.status || statusImmune(target, status)) {
    events.push({ kind: 'failed', target: targetKey, reason: 'status' });
    return false;
  }
  target.status = status;
  events.push({ kind: 'status', target: targetKey, status });
  return true;
}

function applyConfusion(target, targetKey, rng, events) {
  if (target.confusionTurns > 0) {
    events.push({ kind: 'failed', target: targetKey, reason: 'confusion' });
    return false;
  }
  target.confusionTurns = (randomByte(rng) & 3) + 2;
  events.push({ kind: 'status', target: targetKey, status: 'confusion', turns: target.confusionTurns });
  return true;
}

function offensiveAndDefensiveStats(actor, target, move, critical) {
  const physical = isPhysicalType(move.type);
  const attackKey = physical ? 'attack' : 'specialAttack';
  const defenseKey = physical ? 'defense' : 'specialDefense';
  const attackStage = actor.stages[attackKey];
  const defenseStage = target.stages[defenseKey];
  const ignoreStages = critical && attackStage <= defenseStage;
  let attack = ignoreStages ? actor.stats[attackKey] : applyStatStage(actor.stats[attackKey], attackStage);
  let defense = ignoreStages ? target.stats[defenseKey] : applyStatStage(target.stats[defenseKey], defenseStage);
  if (physical && actor.status === 'burn') attack = Math.max(1, Math.floor(attack / 2));
  if (!physical && target.lightScreenTurns > 0) defense *= 2;
  return { attack, defense };
}

function damageMove(state, actorKey, targetKey, move, rng, events) {
  const actor = state[actorKey];
  const target = state[targetKey];
  const criticalLevel = isHighCriticalMove(move) ? 2 : 0;
  const critical = isCriticalHit(criticalLevel, randomByte(rng));
  const values = offensiveAndDefensiveStats(actor, target, move, critical);
  const result = calculateGen2Damage({
    level: actor.level,
    power: move.power,
    attack: values.attack,
    defense: values.defense,
    moveType: move.typeless ? 'typeless' : move.type,
    attackerTypes: move.typeless ? [] : actor.types,
    defenderTypes: move.typeless ? [] : target.types,
    randomByte: Math.max(217, randomByte(rng)),
    critical,
  });
  if (result.damage <= 0) {
    events.push({ kind: 'no-effect', actor: actorKey, target: targetKey, effectiveness: result.effectiveness });
    return { ...result, amount: 0 };
  }
  const amount = Math.min(target.hp, result.damage);
  target.hp -= amount;
  events.push({ kind: 'damage', target: targetKey, amount, hp: target.hp, ...result });
  if (move.type === 'fire' && target.status === 'freeze') {
    target.status = null;
    events.push({ kind: 'status-cleared', target: targetKey, status: 'freeze' });
  }
  return { ...result, amount };
}

function effectRoll(move, rng) {
  return move.effectChanceByte > 0 && randomByte(rng) < move.effectChanceByte;
}

function applyDamageSecondary(state, actorKey, targetKey, move, damage, targetMoved, rng, events) {
  if (damage.amount <= 0 || state[targetKey].hp <= 0) return;
  const target = state[targetKey];
  const chance = effectRoll(move, rng);
  if (chance && ['EFFECT_PARALYZE_HIT', 'EFFECT_THUNDER'].includes(move.effect)) {
    applyMajorStatus(target, targetKey, 'paralysis', events);
  } else if (chance && ['EFFECT_BURN_HIT', 'EFFECT_FLAME_WHEEL'].includes(move.effect)) {
    applyMajorStatus(target, targetKey, 'burn', events);
  } else if (chance && move.effect === 'EFFECT_FREEZE_HIT') {
    applyMajorStatus(target, targetKey, 'freeze', events);
  } else if (chance && ['EFFECT_FLINCH_HIT', 'EFFECT_STOMP'].includes(move.effect) && !targetMoved) {
    target.flinched = true;
    events.push({ kind: 'volatile', target: targetKey, status: 'flinch' });
  } else if (chance && move.effect === 'EFFECT_ATTACK_DOWN_HIT') {
    changeStage(target, 'attack', -1, events, targetKey);
  } else if (chance && move.effect === 'EFFECT_DEFENSE_DOWN_HIT') {
    changeStage(target, 'defense', -1, events, targetKey);
  } else if (chance && move.effect === 'EFFECT_SPEED_DOWN_HIT') {
    changeStage(target, 'speed', -1, events, targetKey);
  } else if (chance && move.effect === 'EFFECT_SP_DEF_DOWN_HIT') {
    changeStage(target, 'specialDefense', -1, events, targetKey);
  }

  if (move.effect === 'EFFECT_RECOIL_HIT') {
    const recoil = Math.max(1, Math.floor(damage.amount / 4));
    const actor = state[actorKey];
    const amount = Math.min(actor.hp, recoil);
    actor.hp -= amount;
    events.push({ kind: 'damage', target: actorKey, amount, hp: actor.hp, cause: 'recoil', effectiveness: 1, critical: false });
  } else if (move.effect === 'EFFECT_LEECH_HIT') {
    const actor = state[actorKey];
    const amount = Math.min(actor.maxHp - actor.hp, Math.max(1, Math.floor(damage.amount / 2)));
    actor.hp += amount;
    events.push({ kind: 'heal', target: actorKey, amount, hp: actor.hp, cause: 'drain' });
  }
}

function targetMoveHasEffect(move, target) {
  if (move.effect === 'EFFECT_SYNTHESIS' || move.effect === 'EFFECT_LIGHT_SCREEN') return true;
  return typeEffectiveness(move.type, target.types) !== 0;
}

function statusMove(state, actorKey, targetKey, move, rng, events) {
  const actor = state[actorKey];
  const target = state[targetKey];
  if (!targetMoveHasEffect(move, target)) {
    events.push({ kind: 'no-effect', actor: actorKey, target: targetKey, effectiveness: 0 });
    return;
  }
  switch (move.effect) {
    case 'EFFECT_POISON':
      applyMajorStatus(target, targetKey, 'poison', events);
      break;
    case 'EFFECT_SYNTHESIS': { // 날씨 없음: 최대 HP의 1/2
      const amount = Math.min(actor.maxHp - actor.hp, Math.max(1, Math.floor(actor.maxHp / 2)));
      actor.hp += amount;
      events.push({ kind: 'heal', target: actorKey, amount, hp: actor.hp, cause: 'synthesis' });
      break;
    }
    case 'EFFECT_LIGHT_SCREEN':
      if (actor.lightScreenTurns > 0) events.push({ kind: 'failed', target: actorKey, reason: 'screen' });
      else {
        actor.lightScreenTurns = 5;
        events.push({ kind: 'screen', target: actorKey, screen: 'light', turns: 5 });
      }
      break;
    case 'EFFECT_ACCURACY_DOWN':
      changeStage(target, 'accuracy', -1, events, targetKey);
      break;
    case 'EFFECT_SPEED_DOWN_2':
      changeStage(target, 'speed', -2, events, targetKey);
      break;
    case 'EFFECT_CONFUSE':
      applyConfusion(target, targetKey, rng, events);
      break;
    case 'EFFECT_PARALYZE':
      applyMajorStatus(target, targetKey, 'paralysis', events);
      break;
    default:
      events.push({ kind: 'failed', target: targetKey, reason: 'unsupported' });
  }
}

function executeAction(state, action, moved, rng, events) {
  const actor = state[action.actor];
  const target = state[action.target];
  const move = action.move;
  if (!canAct(state, action.actor, move, rng, events) || state.winner) return;
  pushMoveEvent(events, action.actor, move);

  if (move.effect === 'EFFECT_SOLARBEAM' && actor.chargingMove !== (move.slug || move.id)) {
    actor.chargingMove = move.slug || move.id;
    events.push({ kind: 'charge', actor: action.actor, moveSlug: move.slug || null, moveId: move.id });
    return;
  }
  if (move.effect === 'EFFECT_SOLARBEAM') actor.chargingMove = null;

  const hit = doesMoveHit({
    accuracyByte: move.accuracyByte,
    randomByte: randomByte(rng),
    accuracyStage: actor.stages.accuracy,
    evasionStage: target.stages.evasion,
    alwaysHits: move.effect === 'EFFECT_ALWAYS_HIT',
  });
  if (!hit) {
    events.push({ kind: 'miss', actor: action.actor, target: action.target });
    return;
  }

  if (move.power > 0) {
    const damage = damageMove(state, action.actor, action.target, move, rng, events);
    applyDamageSecondary(state, action.actor, action.target, move, damage, moved.has(action.target), rng, events);
    checkFaint(state, action.target, events);
    if (!state.winner) checkFaint(state, action.actor, events);
  } else {
    statusMove(state, action.actor, action.target, move, rng, events);
  }
}

function applyResidual(state, key, events) {
  const target = state[key];
  if (target.hp <= 0 || !['poison', 'burn'].includes(target.status)) return;
  const amount = Math.min(target.hp, Math.max(1, Math.floor(target.maxHp / 8)));
  target.hp -= amount;
  events.push({ kind: 'damage', target: key, amount, hp: target.hp, cause: target.status, effectiveness: 1, critical: false });
  checkFaint(state, key, events);
}

function tickEndOfTurn(state, events) {
  applyResidual(state, 'player', events);
  if (!state.winner) applyResidual(state, 'enemy', events);
  for (const key of ['player', 'enemy']) {
    const combatant = state[key];
    combatant.flinched = false;
    if (combatant.lightScreenTurns > 0) {
      combatant.lightScreenTurns -= 1;
      if (combatant.lightScreenTurns === 0) events.push({ kind: 'screen-cleared', target: key, screen: 'light' });
    }
  }
}

function selectedPlayerMove(state, selected) {
  const charging = state.player.chargingMove;
  if (charging != null) {
    return state.player.moves.find((move) => (move.slug || move.id) === charging) || null;
  }
  return state.player.moves.find((move) => move.slug === selected || move.id === Number(selected)) || null;
}

function selectEnemyMove(state, rng) {
  const usable = state.enemy.moves.filter((move) => isSupportedWildMove(move));
  const pool = usable.length ? usable : [{ ...STRUGGLE }];
  return pool[Math.min(pool.length - 1, Math.floor((Number(rng()) || 0) * pool.length))];
}

export function resolveGen2Turn(inputState, selectedMove, rng = Math.random) {
  if (inputState?.winner) return { state: clone(inputState), events: [] };
  const state = clone(inputState);
  const playerMove = selectedPlayerMove(state, selectedMove);
  if (!playerMove) throw new Error(`Move is not available: ${selectedMove}`);
  const enemyMove = selectEnemyMove(state, rng);
  const actions = orderActions(state, playerMove, enemyMove, rng);
  const events = [];
  const moved = new Set();
  for (const action of actions) {
    if (state.winner) break;
    executeAction(state, action, moved, rng, events);
    moved.add(action.actor);
  }
  if (!state.winner) tickEndOfTurn(state, events);
  if (!state.winner) state.turn += 1;
  return { state, events };
}
