import { describe, it, expect } from 'vitest';
import { parseSessionLines } from '../src/core/session-parser.js';

const line = (uuid, ts, inTok, outTok) => JSON.stringify({
  type: 'assistant', uuid, timestamp: new Date(ts).toISOString(),
  message: { usage: { input_tokens: inTok, output_tokens: outTok } },
});

describe('parseSessionLines', () => {
  it('extracts token events from assistant usage', () => {
    const evs = parseSessionLines([line('u1', 1000, 100, 50)]);
    expect(evs).toEqual([{ id: 'u1', kind: 'tokens', tokens: 150, ts: 1000 }]);
  });
  it('skips lines without usage and broken lines', () => {
    const evs = parseSessionLines([
      JSON.stringify({ type: 'user', uuid: 'x' }),
      '{broken',
      line('u2', 2000, 10, 10),
    ]);
    expect(evs).toEqual([{ id: 'u2', kind: 'tokens', tokens: 20, ts: 2000 }]);
  });
  it('filters events at or before sinceTs', () => {
    const evs = parseSessionLines([line('u1', 1000, 5, 5), line('u2', 3000, 5, 5)], 1000);
    expect(evs.map((e) => e.id)).toEqual(['u2']);
  });
});
