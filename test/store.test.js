import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultState, loadState, saveState, rollStarter } from '../src/core/store.js';
import { xpForLevel } from '../src/core/xp-engine.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pkmn-')); });

describe('store', () => {
  it('returns default state when no save file', () => {
    const s = loadState(dir);
    expect(s.locked).toBe(false);
    expect(s.level).toBe(1);
  });

  it('round-trips save/load (signed)', () => {
    const s = { ...defaultState(), species: 'fire', xp: xpForLevel(5), locked: true };
    saveState(dir, s);
    const loaded = loadState(dir);
    expect(loaded.xp).toBe(xpForLevel(5));
    expect(loaded.level).toBe(5); // derived from xp
  });

  it('recovers (resets) from corrupt save file', () => {
    writeFileSync(join(dir, 'save.json'), '{not json');
    const s = loadState(dir);
    expect(s.level).toBe(1);
    expect(existsSync(join(dir, 'save.json.bak'))).toBe(true);
  });

  it('rejects a hand-tampered save and resets (anti-cheat)', () => {
    const s = { ...defaultState(), species: 'electric', xp: 100, locked: true };
    saveState(dir, s);
    // attacker edits xp to 999999 in the data block, keeping old sig
    const raw = JSON.parse(readFileSync(join(dir, 'save.json'), 'utf8'));
    raw.data.xp = 999999;
    writeFileSync(join(dir, 'save.json'), JSON.stringify(raw));
    const loaded = loadState(dir);
    expect(loaded.xp).toBe(0);      // reset, cheat rejected
    expect(loaded.locked).toBe(false);
  });

  it('recomputes level/stage from xp even if stored values are forged', () => {
    // valid signature but we saved via saveState which recomputes anyway;
    // simulate by saving a state whose level field is wrong before signing
    const s = { ...defaultState(), species: 'electric', xp: xpForLevel(10), level: 1, stage: 0, locked: true };
    saveState(dir, s);
    const loaded = loadState(dir);
    expect(loaded.level).toBe(10);
    expect(loaded.stage).toBe(1); // 피카츄 (전기 진화 10)
  });

  it('resets when save file is a legacy/unwrapped shape (no data/sig) — anti-cheat', () => {
    // 공격자/구버전이 서명 래퍼 없이 raw 상태를 써넣음
    writeFileSync(join(dir, 'save.json'), JSON.stringify({ xp: 999999, species: 'fire', locked: true }));
    const loaded = loadState(dir);
    expect(loaded.xp).toBe(0);        // 무시하고 초기화
    expect(loaded.locked).toBe(false);
    expect(loaded.species).toBe(null);
    expect(existsSync(join(dir, 'save.json.bak'))).toBe(true); // 손상본 백업
  });

  it('rolls a starter once and locks it', () => {
    const s1 = rollStarter(defaultState(), () => 0);
    expect(s1.locked).toBe(true);
    expect(s1.species).toBe('grass');
    const s2 = rollStarter(s1, () => 0.99);
    expect(s2.species).toBe('grass'); // re-roll does nothing
  });
});
