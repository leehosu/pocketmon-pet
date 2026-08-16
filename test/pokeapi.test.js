import { describe, it, expect } from 'vitest';
import { dexLine, spriteUrl, cryUrl, SPRITE_BASE, CRY_BASE } from '../src/core/pokeapi.js';

describe('pokeapi', () => {
  it('maps each species key to its 3-stage national dex line', () => {
    expect(dexLine('grass')).toEqual([152, 153, 154]);   // 치코리타/베이리프/메가니움
    expect(dexLine('fire')).toEqual([155, 156, 157]);    // 브케인/마그케인/블레이범
    expect(dexLine('water')).toEqual([158, 159, 160]);   // 리아코/엘리게이/장크로다일
    expect(dexLine('electric')).toEqual([172, 25, 26]);  // 피츄/피카츄/라이츄
  });

  it('returns empty array for unknown species', () => {
    expect(dexLine('nope')).toEqual([]);
    expect(dexLine(undefined)).toEqual([]);
  });

  it('builds a PokeAPI sprites URL for a dex id', () => {
    expect(spriteUrl(25)).toBe(`${SPRITE_BASE}/25.png`);
    expect(SPRITE_BASE.startsWith('https://')).toBe(true);
  });

  it('builds a PokeAPI cries URL for a dex id', () => {
    expect(cryUrl(25)).toBe(`${CRY_BASE}/25.ogg`);
    expect(CRY_BASE.startsWith('https://')).toBe(true);
  });
});
