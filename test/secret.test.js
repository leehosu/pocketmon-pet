import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getSecret } from '../src/core/secret.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pkmn-sec-')); });

describe('getSecret (로컬 서명키)', () => {
  it('creates a secret.key file on first call and returns a non-trivial key', () => {
    const k = getSecret(dir);
    expect(typeof k).toBe('string');
    expect(k.length).toBeGreaterThanOrEqual(32);
    expect(existsSync(join(dir, 'secret.key'))).toBe(true);
    expect(readFileSync(join(dir, 'secret.key'), 'utf8').trim()).toBe(k);
  });

  it('returns the same key on repeated calls (persisted/cached)', () => {
    const a = getSecret(dir);
    expect(getSecret(dir)).toBe(a);
  });

  it('different data dirs get different keys', () => {
    const dir2 = mkdtempSync(join(tmpdir(), 'pkmn-sec2-'));
    expect(getSecret(dir)).not.toBe(getSecret(dir2));
  });
});
