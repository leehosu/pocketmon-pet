import { describe, expect, it } from 'vitest';
import { GEN2_SKILLS_BY_KEY } from '../src/core/gsc-moves.js';
import {
  createGen2Battle, resolveGen2Turn,
} from '../src/core/gen2-battle.js';

const dvs = { attack: 8, defense: 8, speed: 8, special: 8 };
const statExp = { hp: 0, attack: 0, defense: 0, speed: 0, special: 0 };
const steadyRng = () => 0.5;

function battle({
  playerId = 172,
  playerLevel = 20,
  playerMoves = ['thunder-shock', 'sweet-kiss'],
  enemyId = 158,
  enemyLevel = 20,
  enemyMoves = [33],
} = {}) {
  return createGen2Battle({
    player: { speciesId: playerId, name: 'PLAYER', level: playerLevel, dvs, statExp, moves: playerMoves },
    enemy: { speciesId: enemyId, name: 'WILD', level: enemyLevel, dvs, statExp, moves: enemyMoves },
  });
}

describe('Generation II battle state machine', () => {
  it('executes Falkner\'s Mud-Slap and lowers accuracy', () => {
    const start = battle({
      playerId: 152, playerLevel: 7, playerMoves: ['razor-leaf'],
      enemyId: 16, enemyLevel: 7, enemyMoves: [189],
    });
    const result = resolveGen2Turn(start, 'razor-leaf', () => 0.99);
    expect(result.state.player.stages.accuracy).toBe(-1);
    expect(result.events).toContainEqual(expect.objectContaining({ kind: 'stat', stat: 'accuracy', change: -1 }));
  });

  it('applies real damage and super effectiveness', () => {
    const start = battle();
    const result = resolveGen2Turn(start, 'thunder-shock', steadyRng);
    const hit = result.events.find((event) => event.kind === 'damage' && event.target === 'enemy');
    expect(hit.amount).toBeGreaterThan(1);
    expect(hit.effectiveness).toBe(2);
    expect(result.state.enemy.hp).toBe(start.enemy.hp - hit.amount);
  });

  it('applies status and stat-changing moves', () => {
    const poison = resolveGen2Turn(battle({
      playerId: 152, playerMoves: ['poison-powder'], enemyId: 155,
    }), 'poison-powder', steadyRng);
    expect(poison.state.enemy.status).toBe('poison');

    const smoke = resolveGen2Turn(battle({
      playerId: 155, playerMoves: ['smokescreen'], enemyId: 158,
    }), 'smokescreen', steadyRng);
    expect(smoke.state.enemy.stages.accuracy).toBe(-1);
  });

  it('heals with Synthesis and keeps HP within the real maximum', () => {
    const start = battle({ playerId: 153, playerMoves: ['synthesis'] });
    start.player.hp = 1;
    const result = resolveGen2Turn(start, 'synthesis', steadyRng);
    const heal = result.events.find((event) => event.kind === 'heal');
    expect(heal.amount).toBe(Math.floor(start.player.maxHp / 2));
    expect(result.state.player.hp).toBeLessThanOrEqual(start.player.maxHp);
  });

  it('charges SolarBeam for one turn before dealing damage', () => {
    const start = battle({ playerId: 154, playerMoves: ['solar-beam', 'light-screen'] });
    const first = resolveGen2Turn(start, 'solar-beam', steadyRng);
    expect(first.state.enemy.hp).toBe(start.enemy.hp);
    expect(first.state.player.chargingMove).toBe('solar-beam');
    expect(first.events.some((event) => event.kind === 'charge')).toBe(true);

    const second = resolveGen2Turn(first.state, 'light-screen', steadyRng);
    expect(second.state.enemy.hp).toBeLessThan(first.state.enemy.hp);
    expect(second.state.player.chargingMove).toBe(null);
  });

  it('lets Quick Attack move before a faster enemy', () => {
    const start = battle({
      playerId: 172, playerLevel: 10, playerMoves: ['quick-attack'],
      enemyId: 101, enemyLevel: 50, enemyMoves: [33],
    });
    const result = resolveGen2Turn(start, 'quick-attack', steadyRng);
    const firstMove = result.events.find((event) => event.kind === 'move');
    expect(firstMove.actor).toBe('player');
  });

  it('executes all 24 displayed moves through the battle engine', () => {
    const moves = Object.values(GEN2_SKILLS_BY_KEY).flat(2);
    for (const move of moves) {
      const start = battle({ playerMoves: [move.slug] });
      expect(() => resolveGen2Turn(start, move.slug, steadyRng), move.slug).not.toThrow();
    }
  });

  it('ends immediately when one side faints', () => {
    const start = battle({ playerId: 160, playerLevel: 50, playerMoves: ['hydro-pump'], enemyId: 155, enemyLevel: 2 });
    start.enemy.hp = 1;
    const result = resolveGen2Turn(start, 'hydro-pump', steadyRng);
    expect(result.state.winner).toBe('player');
    expect(result.events.some((event) => event.kind === 'faint' && event.target === 'enemy')).toBe(true);
    expect(result.events.filter((event) => event.kind === 'move')).toHaveLength(1);
  });
});
