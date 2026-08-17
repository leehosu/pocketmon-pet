import { describe, expect, it } from 'vitest';
import { clearConnectedNearWhite } from '../src/renderer/sprite-alpha.js';

function rgbaGrid(values) {
  return new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255]));
}

describe('clearConnectedNearWhite', () => {
  it('preserves white details fully enclosed by sprite pixels', () => {
    const pixels = rgbaGrid([
      255, 255, 255, 255, 255,
      255, 20, 20, 20, 255,
      255, 20, 255, 20, 255,
      255, 20, 20, 20, 255,
      255, 255, 255, 255, 255,
    ]);
    clearConnectedNearWhite(pixels, 5, 5);
    expect(pixels[(0 * 5 + 0) * 4 + 3]).toBe(0);
    expect(pixels[(2 * 5 + 2) * 4 + 3]).toBe(255);
  });

  it('removes background connected diagonally between body and tail', () => {
    const pixels = rgbaGrid([
      20, 20, 255,
      20, 255, 20,
      255, 20, 20,
    ]);
    clearConnectedNearWhite(pixels, 3, 3);
    expect(pixels[(1 * 3 + 1) * 4 + 3]).toBe(0);
  });

  it('removes a large white hole enclosed mostly by a dark outline', () => {
    const values = Array.from({ length: 10 }, (_, y) => (
      Array.from({ length: 10 }, (_, x) => (x === 0 || x === 9 || y === 0 || y === 9 ? 20 : 255))
    )).flat();
    const pixels = rgbaGrid(values);
    clearConnectedNearWhite(pixels, 10, 10);
    expect(pixels[(5 * 10 + 5) * 4 + 3]).toBe(0);
  });
});
