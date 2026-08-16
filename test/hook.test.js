import { describe, it, expect } from 'vitest';
import { buildEvent } from '../hook/pocketmon-hook.js';
import { verify } from '../src/core/integrity.js';

describe('buildEvent', () => {
  it('maps SessionStart to sessionStart event', () => {
    const e = buildEvent({ hook_event_name: 'SessionStart', session_id: 's1' }, 1000, () => 0.5);
    expect(e.kind).toBe('sessionStart');
    expect(e.ts).toBe(1000);
    expect(typeof e.id).toBe('string');
  });
  it('maps PostToolUse to toolUse event', () => {
    const e = buildEvent({ hook_event_name: 'PostToolUse', session_id: 's1' }, 2000, () => 0.5);
    expect(e.kind).toBe('toolUse');
  });
  it('maps activity events (UserPromptSubmit→busyStart, Stop→busyEnd)', () => {
    expect(buildEvent({ hook_event_name: 'UserPromptSubmit', session_id: 's1' }, 3000, () => 0.5).kind).toBe('busyStart');
    expect(buildEvent({ hook_event_name: 'Stop', session_id: 's1' }, 4000, () => 0.5).kind).toBe('busyEnd');
  });
  it('signs the event so the app can verify it (anti-cheat)', () => {
    const e = buildEvent({ hook_event_name: 'PostToolUse', session_id: 's1' }, 2000, () => 0.5);
    expect(typeof e.sig).toBe('string');
    expect(verify({ id: e.id, kind: e.kind, ts: e.ts }, e.sig)).toBe(true);
  });
  it('returns null for irrelevant events', () => {
    expect(buildEvent({ hook_event_name: 'Nope' }, 1, () => 0)).toBeNull();
  });
});
