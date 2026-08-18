import { describe, expect, it } from 'vitest';
import {
  ENCOUNTER_MAX_DELAY_MS,
  ENCOUNTER_MIN_DELAY_MS,
  canScheduleEncounter,
  nextEncounterDelayMs,
  wildAppearanceDurationMs,
} from '../src/core/encounter-scheduler.js';

describe('wild encounter scheduler', () => {
  it('uses a minimum delay and a hard maximum', () => {
    expect(nextEncounterDelayMs(() => 0)).toBe(ENCOUNTER_MIN_DELAY_MS);
    expect(nextEncounterDelayMs(() => 0.999)).toBe(ENCOUNTER_MAX_DELAY_MS);
  });

  it('keeps wild appearances between 30 and 50 seconds', () => {
    expect(wildAppearanceDurationMs(() => 0)).toBe(30_000);
    expect(wildAppearanceDurationMs(() => 0.999999)).toBe(50_000);
  });

  it('does not schedule before hatch, during battle, or during loss cooldown', () => {
    expect(canScheduleEncounter({ hatched: false }, 100)).toBe(false);
    expect(canScheduleEncounter({ hatched: true, battling: true }, 100)).toBe(false);
    expect(canScheduleEncounter({ hatched: true, cooldownUntil: 101 }, 100)).toBe(false);
    expect(canScheduleEncounter({ hatched: true, cooldownUntil: 100 }, 100)).toBe(true);
  });
});
