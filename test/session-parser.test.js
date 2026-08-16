import { describe, it, expect } from 'vitest';
import { parseSessionLines, parseCodexLines } from '../src/core/session-parser.js';

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

const codexLine = (ts, inTok, outTok, total) => JSON.stringify({
  timestamp: new Date(ts).toISOString(), type: 'event_msg',
  payload: {
    type: 'token_count',
    info: {
      last_token_usage: { input_tokens: inTok, output_tokens: outTok, total_tokens: inTok + outTok },
      total_token_usage: { total_tokens: total },
    },
  },
});

describe('parseCodexLines', () => {
  it('extracts token events from token_count last_token_usage', () => {
    const evs = parseCodexLines([codexLine(1000, 100, 50, 150)]);
    expect(evs).toEqual([{ id: 'codex:1000:150', kind: 'tokens', tokens: 150, ts: 1000 }]);
  });
  it('skips non-token_count events and broken lines', () => {
    const evs = parseCodexLines([
      JSON.stringify({ timestamp: new Date(500).toISOString(), type: 'event_msg', payload: { type: 'agent_message' } }),
      '{broken',
      codexLine(2000, 10, 10, 900),
    ]);
    expect(evs).toEqual([{ id: 'codex:2000:900', kind: 'tokens', tokens: 20, ts: 2000 }]);
  });
  it('filters events at or before sinceTs', () => {
    const evs = parseCodexLines([codexLine(1000, 5, 5, 10), codexLine(3000, 5, 5, 20)], 1000);
    expect(evs.map((e) => e.ts)).toEqual([3000]);
  });
});
