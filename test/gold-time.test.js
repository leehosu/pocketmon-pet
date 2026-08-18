import { describe, expect, it } from 'vitest';
import { goldTimePeriod } from '../src/core/gold-time.js';

describe('Gold local time periods', () => {
  it.each([
    [3, 'nite'], [4, 'morn'], [9, 'morn'], [10, 'day'], [17, 'day'], [18, 'nite'],
  ])('maps local hour %i to %s', (hour, expected) => {
    const date = new Date(2026, 7, 18, hour, 0, 0);
    expect(goldTimePeriod(date)).toBe(expected);
  });
});
