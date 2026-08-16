import { describe, it, expect } from 'vitest';
import { pickAnim, nextFrameIndex, hudVisible } from '../src/renderer/pet-window.js';

describe('pickAnim', () => {
  it('idle when nothing happening', () => {
    expect(pickAnim({ reacting: false, skillActive: false, busy: false, walking: false })).toBe('idle');
  });
  it('walk when wandering', () => {
    expect(pickAnim({ reacting: false, skillActive: false, busy: false, walking: true })).toBe('walk');
  });
  it('run when busy (prompt in progress)', () => {
    expect(pickAnim({ reacting: false, skillActive: false, busy: true, walking: true })).toBe('run');
  });
  it('skill when a tool was used', () => {
    expect(pickAnim({ reacting: false, skillActive: true, busy: true, walking: false })).toBe('skill');
  });
  it('react (level up/evolve) overrides all, shown via skill frames', () => {
    expect(pickAnim({ reacting: true, skillActive: false, busy: true, walking: true })).toBe('skill');
  });
});

describe('nextFrameIndex', () => {
  it('cycles frames within the current anim', () => {
    expect(nextFrameIndex({ tickCount: 0, frameCount: 2 })).toBe(0);
    expect(nextFrameIndex({ tickCount: 1, frameCount: 2 })).toBe(1);
    expect(nextFrameIndex({ tickCount: 2, frameCount: 2 })).toBe(0);
  });
});

describe('hudVisible', () => {
  it('hidden by default (sprite only)', () => {
    expect(hudVisible({ hovering: false, pinned: false })).toBe(false);
  });
  it('shown on hover', () => {
    expect(hudVisible({ hovering: true, pinned: false })).toBe(true);
  });
  it('shown when pinned by click even without hover', () => {
    expect(hudVisible({ hovering: false, pinned: true })).toBe(true);
  });
});
