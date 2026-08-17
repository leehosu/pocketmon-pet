import { describe, expect, it } from 'vitest';
import { battleStepAt, midiToFrequency } from '../src/renderer/battle-audio.js';

describe('battle chiptune sequence', () => {
  it('converts MIDI A4 to 440 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 8);
  });

  it('loops the original battle sequence deterministically', () => {
    expect(battleStepAt(0)).toEqual({ lead: 76, bass: 40, kick: true, hat: false });
    expect(battleStepAt(32)).toEqual(battleStepAt(0));
    expect(battleStepAt(1).hat).toBe(true);
  });
});
