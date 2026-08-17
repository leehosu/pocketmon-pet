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
    expect(s.battleProfile).toBe(null);
  });

  it('round-trips save/load (plain JSON)', () => {
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

  it('recomputes level from xp; does NOT auto-advance stage (manual evolution)', () => {
    const s = { ...defaultState(), species: 'electric', xp: xpForLevel(10), level: 1, stage: 0, locked: true, hatched: true };
    saveState(dir, s);
    const loaded = loadState(dir);
    expect(loaded.level).toBe(10);
    expect(loaded.stage).toBe(0); // 진화 가능하지만 자동으로 오르지 않음("!" 클릭 필요)
  });

  it('clamps a forged too-high stage down to level max (anti-cheat)', () => {
    const s = { ...defaultState(), species: 'electric', xp: 0, level: 1, stage: 2, locked: true, hatched: true };
    saveState(dir, s);
    const loaded = loadState(dir);
    expect(loaded.stage).toBe(0); // level 1은 stage 0까지만 허용 → clamp
  });


  it('rolls a starter once and locks it', () => {
    const s1 = rollStarter(defaultState(), () => 0);
    expect(s1.locked).toBe(true);
    expect(s1.species).toBe('grass');
    const s2 = rollStarter(s1, () => 0.99);
    expect(s2.species).toBe('grass'); // re-roll does nothing
  });
});
