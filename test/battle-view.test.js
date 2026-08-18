import { describe, it, expect } from 'vitest';
import {
  withParticle, introMessage, promptMessage,
  hpBarPercent, hpTone, HP_BAR_CELLS, typeLabel, moveMenuModel,
} from '../src/renderer/battle-view.js';

describe('withParticle', () => {
  it('picks the particle by trailing consonant', () => {
    expect(withParticle('피카츄', ['은', '는'])).toBe('피카츄는'); // 받침 없음
    expect(withParticle('리아코', ['은', '는'])).toBe('리아코는');
    expect(withParticle('브케인', ['은', '는'])).toBe('브케인은'); // 받침 있음
    expect(withParticle('꼬렛', ['이', '가'])).toBe('꼬렛이');
    expect(withParticle('나옹', ['이', '가'])).toBe('나옹이');
  });

  it('falls back to both forms for non-Hangul names', () => {
    expect(withParticle('No.25', ['이', '가'])).toBe('No.25이(가)');
  });

  it('returns empty string for empty input', () => {
    expect(withParticle('', ['은', '는'])).toBe('');
    expect(withParticle(null, ['은', '는'])).toBe('');
  });
});

describe('battle messages', () => {
  it('reads like the original encounter line', () => {
    expect(introMessage('피카츄')).toBe('앗! 야생 피카츄가 나타났다!');
    expect(introMessage('꼬렛')).toBe('앗! 야생 꼬렛이 나타났다!');
  });

  it('asks what to do using the right particle', () => {
    expect(promptMessage('브케인')).toBe('브케인은 무엇을 할까?');
    expect(promptMessage('리아코')).toBe('리아코는 무엇을 할까?');
  });
});

describe('hpBarPercent', () => {
  it('is full at full hp and empty at zero', () => {
    expect(hpBarPercent(30, 30)).toBe(100);
    expect(hpBarPercent(0, 30)).toBe(0);
  });

  it('snaps to the 48-cell gauge like the original', () => {
    // 48칸 게이지이므로 표시 가능한 값은 n/48 배수뿐이다.
    for (const hp of [1, 7, 13, 19, 25, 29]) {
      const pct = hpBarPercent(hp, 30);
      const cells = (pct / 100) * HP_BAR_CELLS;
      expect(Number.isInteger(Math.round(cells * 1e6) / 1e6)).toBe(true);
    }
  });

  it('never shows an empty bar while still alive', () => {
    expect(hpBarPercent(1, 999)).toBeGreaterThan(0);
  });

  it('clamps out-of-range values', () => {
    expect(hpBarPercent(-5, 30)).toBe(0);
    expect(hpBarPercent(50, 30)).toBe(100);
    expect(hpBarPercent(10, 0)).toBe(100); // maxHp 0 방어
  });
});

describe('hpTone', () => {
  it('switches colour at the original thresholds', () => {
    expect(hpTone(30, 30)).toBe('high');
    expect(hpTone(16, 30)).toBe('high');
    expect(hpTone(15, 30)).toBe('mid');   // 정확히 50%
    expect(hpTone(7, 30)).toBe('mid');
    expect(hpTone(6, 30)).toBe('low');    // 20%
    expect(hpTone(0, 30)).toBe('low');
  });
});

describe('typeLabel', () => {
  it('maps Generation II types to Korean', () => {
    expect(typeLabel('fire')).toBe('불꽃');
    expect(typeLabel('electric')).toBe('전기');
    expect(typeLabel('normal')).toBe('노말');
  });
  it('falls back for unknown types', () => {
    expect(typeLabel('fairy')).toBe('FAIRY');
    expect(typeLabel(null)).toBe('???');
  });
});

describe('moveMenuModel', () => {
  const playerMoves = [
    { slug: 'ember', name: '불꽃세례', effect: 'gsc_ember' },
    { slug: 'smokescreen', name: '연막', effect: 'gsc_smokescreen' },
  ];
  const engineMoves = [
    { slug: 'ember', type: 'fire', pp: 25, power: 40 },
    { slug: 'smokescreen', type: 'normal', pp: 20, power: 0 },
  ];

  it('joins the Korean name with the engine type/pp/power', () => {
    const model = moveMenuModel(playerMoves, engineMoves);
    expect(model[0]).toEqual({
      slug: 'ember', name: '불꽃세례', effect: 'gsc_ember',
      type: 'fire', pp: 25, power: 40,
    });
  });

  it('reports status moves as having no power', () => {
    expect(moveMenuModel(playerMoves, engineMoves)[1].power).toBe(null);
  });

  it('keeps the move listed even when engine data is missing', () => {
    const model = moveMenuModel(playerMoves, []);
    expect(model).toHaveLength(2);
    expect(model[0].name).toBe('불꽃세례');
    expect(model[0].type).toBe(null);
    expect(model[0].pp).toBe(null);
  });

  it('tolerates empty/garbage input', () => {
    expect(moveMenuModel()).toEqual([]);
    expect(moveMenuModel([], [null, undefined])).toEqual([]);
  });
});
