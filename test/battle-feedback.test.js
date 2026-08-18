// AI-GENERATED: 양쪽 공격 타임라인과 4개 스타터 타입의 전투 피드백 회귀 테스트.
import { describe, expect, it } from 'vitest';
import {
  BATTLE_ACTION_MS,
  BATTLE_IMPACT_MS,
  battleEventSchedule,
  battleTimelineDuration,
} from '../src/core/battle-timeline.js';
import { createGen2Battle, resolveGen2Turn } from '../src/core/gen2-battle.js';
import { gen2BattleEffectForMove } from '../src/core/gsc-moves.js';

const dvs = { attack: 8, defense: 8, speed: 8, special: 8 };
const statExp = { hp: 0, attack: 0, defense: 0, speed: 0, special: 0 };
const steadyRng = () => 0.5;

describe('battle feedback timeline', () => {
  it('places each impact after its move and the counterattack afterward', () => {
    const events = [
      { kind: 'move', actor: 'player' },
      { kind: 'damage', target: 'enemy', hp: 8 },
      { kind: 'move', actor: 'enemy' },
      { kind: 'damage', target: 'player', hp: 9 },
    ];
    const schedule = battleEventSchedule(events);
    expect(schedule.map(({ at }) => at)).toEqual([
      0,
      BATTLE_IMPACT_MS,
      BATTLE_ACTION_MS,
      BATTLE_ACTION_MS + BATTLE_IMPACT_MS,
    ]);
    expect(battleTimelineDuration(events)).toBeGreaterThan(schedule.at(-1).at);
  });
});

describe('starter type battle feedback', () => {
  const cases = [
    { type: 'grass', playerId: 152, move: 'razor-leaf', enemyId: 158 },
    { type: 'fire', playerId: 155, move: 'ember', enemyId: 152 },
    { type: 'water', playerId: 158, move: 'water-gun', enemyId: 155 },
    { type: 'electric', playerId: 172, move: 'thunder-shock', enemyId: 158 },
  ];

  for (const entry of cases) {
    it(`resolves ${entry.type} damage with a Gold effect`, () => {
      const battle = createGen2Battle({
        player: {
          speciesId: entry.playerId, name: 'PLAYER', level: 20, dvs, statExp, moves: [entry.move],
        },
        enemy: {
          speciesId: entry.enemyId, name: 'ENEMY', level: 20, dvs, statExp, moves: [33],
        },
      });
      const result = resolveGen2Turn(battle, entry.move, steadyRng);
      const move = result.state.player.moves.find(({ slug }) => slug === entry.move);
      expect(result.events.some(({ kind, target }) => kind === 'damage' && target === 'enemy')).toBe(true);
      expect(gen2BattleEffectForMove(move)).toMatch(/^gsc_/);
    });
  }
});
