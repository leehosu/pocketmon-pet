import { describe, expect, it } from 'vitest';
import {
  chooseWildEncounter, goldSilverLevelMoveIds,
} from '../src/core/wild-catalog.js';

describe('Gold wild catalog', () => {
  it('chooses a species whose original minimum level fits the player bracket', () => {
    const catalog = [
      { id: 10, minLevel: 2, maxLevel: 5 },
      { id: 20, minLevel: 20, maxLevel: 25 },
    ];
    const encounter = chooseWildEncounter(3, () => 0, catalog);
    expect(encounter).toEqual({ speciesId: 10, level: 2 });
  });

  it('does not raise a wild Pokémon above its original Gold encounter range', () => {
    const catalog = [
      { id: 10, minLevel: 2, maxLevel: 5 },
      { id: 20, minLevel: 20, maxLevel: 25 },
    ];
    expect(chooseWildEncounter(30, () => 0, catalog)).toEqual({ speciesId: 20, level: 25 });
  });

  it('keeps only supported Gold/Silver level-up attacks among the latest four', () => {
    const pokemon = {
      moves: [
        { move: { url: 'https://pokeapi.co/api/v2/move/33/' }, version_group_details: [
          { level_learned_at: 1, move_learn_method: { name: 'level-up' }, version_group: { name: 'gold-silver' } },
        ] },
        { move: { url: 'https://pokeapi.co/api/v2/move/45/' }, version_group_details: [
          { level_learned_at: 1, move_learn_method: { name: 'level-up' }, version_group: { name: 'gold-silver' } },
        ] },
        { move: { url: 'https://pokeapi.co/api/v2/move/98/' }, version_group_details: [
          { level_learned_at: 7, move_learn_method: { name: 'level-up' }, version_group: { name: 'gold-silver' } },
        ] },
        { move: { url: 'https://pokeapi.co/api/v2/move/85/' }, version_group_details: [
          { level_learned_at: 99, move_learn_method: { name: 'level-up' }, version_group: { name: 'gold-silver' } },
        ] },
      ],
    };
    expect(goldSilverLevelMoveIds(pokemon, 10)).toEqual([33, 98]);
  });
});
