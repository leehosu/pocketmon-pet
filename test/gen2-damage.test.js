import { describe, expect, it } from 'vitest';
import {
  calculateGen2Damage, criticalThreshold, doesMoveHit, typeEffectiveness,
} from '../src/core/gen2-damage.js';

describe('Generation II damage calculation', () => {
  it('uses the Generation II type chart including immunity and dual types', () => {
    expect(typeEffectiveness('electric', ['ground'])).toBe(0);
    expect(typeEffectiveness('water', ['fire'])).toBe(2);
    expect(typeEffectiveness('grass', ['water', 'ground'])).toBe(4);
  });

  it('keeps pokecrystal integer operation order for Hydro Pump', () => {
    const result = calculateGen2Damage({
      level: 50,
      power: 120,
      attack: 94,
      defense: 78,
      moveType: 'water',
      attackerTypes: ['water'],
      defenderTypes: ['fire'],
      randomByte: 217,
      critical: false,
    });
    expect(result).toEqual({ damage: 165, effectiveness: 2, stab: true, critical: false });
  });

  it('adds the minimum 2 damage after the critical multiplier', () => {
    const normal = calculateGen2Damage({
      level: 50, power: 40, attack: 80, defense: 80,
      moveType: 'normal', attackerTypes: ['normal'], defenderTypes: ['normal'],
      randomByte: 255, critical: false,
    });
    const critical = calculateGen2Damage({
      level: 50, power: 40, attack: 80, defense: 80,
      moveType: 'normal', attackerTypes: ['normal'], defenderTypes: ['normal'],
      randomByte: 255, critical: true,
    });
    expect(normal.damage).toBe(28);
    expect(critical.damage).toBe(54);
  });

  it('preserves the 1/256 miss on 100 percent accuracy moves', () => {
    expect(doesMoveHit({ accuracyByte: 255, randomByte: 254 })).toBe(true);
    expect(doesMoveHit({ accuracyByte: 255, randomByte: 255 })).toBe(false);
    expect(doesMoveHit({ alwaysHits: true, accuracyByte: 0, randomByte: 255 })).toBe(true);
  });

  it('uses pokecrystal critical thresholds', () => {
    expect(criticalThreshold(0)).toBe(17);
    expect(criticalThreshold(2)).toBe(64);
    expect(criticalThreshold(6)).toBe(128);
  });
});
