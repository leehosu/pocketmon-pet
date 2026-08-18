// AI-GENERATED: pret/pokegold 기반 기술 데이터와 VM의 회귀 테스트.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GEN2_EFFECTS, GEN2_SKILLS_BY_KEY, gen2SkillsForStage } from '../src/core/gsc-moves.js';
import {
  POKEGOLD_FRAMESETS,
  POKEGOLD_MOVES,
  POKEGOLD_OAM_SETS,
  POKEGOLD_OBJECTS,
  POKEGOLD_SCRIPTS,
  POKEGOLD_SOURCE,
} from '../src/renderer/pokegold-anim-data.js';
import { PokegoldAnimationVM } from '../src/renderer/pokegold-anim-vm.js';
import { pokegoldBattleLayout, pokegoldLayout } from '../src/renderer/pokegold-anim-renderer.js';
import { POKEGOLD_SUPPORTED_CALLBACKS } from '../src/renderer/pokegold-object-engine.js';

describe('Gold/Silver move roster', () => {
  it('defines two distinct moves for all 12 evolution stages', () => {
    const stages = Object.values(GEN2_SKILLS_BY_KEY).flat();
    expect(stages).toHaveLength(12);
    expect(stages.every((moves) => moves.length === 2)).toBe(true);
    expect(GEN2_EFFECTS.size).toBe(24);
    expect(new Set(POKEGOLD_SOURCE.assets).size).toBe(POKEGOLD_SOURCE.assets.length);
  });

  it('changes moves when a Pokemon evolves', () => {
    expect(gen2SkillsForStage('electric', 0)).not.toEqual(gen2SkillsForStage('electric', 1));
    expect(gen2SkillsForStage('electric', 1)).not.toEqual(gen2SkillsForStage('electric', 2));
  });

  it('uses the pinned pret/pokegold source and original generated assets', () => {
    expect(POKEGOLD_SOURCE.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(POKEGOLD_SOURCE.moves).toBe(24);
    expect(Object.keys(POKEGOLD_MOVES)).toEqual([...GEN2_EFFECTS]);
    const generator = readFileSync(new URL('../scripts/generate-pokegold-anim-data.mjs', import.meta.url), 'utf8');
    expect(generator).toContain('pret/pokegold');
    expect(generator).not.toContain('pokecrystal');
    for (const asset of POKEGOLD_SOURCE.assets) {
      expect(existsSync(new URL(`../src/renderer/assets/battle-anims/${asset}.png`, import.meta.url)), asset).toBe(true);
    }
  });

  it('resolves every generated callback, frameset, and OAM reference', () => {
    expect([...POKEGOLD_SOURCE.callbacks].sort()).toEqual([...POKEGOLD_SUPPORTED_CALLBACKS].sort());
    for (const [name, object] of Object.entries(POKEGOLD_OBJECTS)) {
      expect(POKEGOLD_SUPPORTED_CALLBACKS, name).toContain(object.callback);
      const frameset = POKEGOLD_FRAMESETS[object.frameset];
      expect(frameset, `${name}:${object.frameset}`).toBeDefined();
      for (const step of frameset.steps) {
        if (step.oam) expect(POKEGOLD_OAM_SETS[step.oam], `${name}:${step.oam}`).toBeDefined();
      }
    }
  });

  it('preserves representative Gold command streams', () => {
    const commandsFor = (effect) => POKEGOLD_SCRIPTS[POKEGOLD_MOVES[effect].script].commands;
    const objectsFor = (effect, object) => commandsFor(effect).filter(
      (command) => command.op === 'anim_obj' && command.object === object,
    );
    expect(objectsFor('gsc_ember', 'BATTLE_ANIM_OBJ_EMBER').slice(0, 3)).toEqual([
      { op: 'anim_obj', object: 'BATTLE_ANIM_OBJ_EMBER', x: 64, y: 96, param: 18 },
      { op: 'anim_obj', object: 'BATTLE_ANIM_OBJ_EMBER', x: 64, y: 100, param: 20 },
      { op: 'anim_obj', object: 'BATTLE_ANIM_OBJ_EMBER', x: 64, y: 84, param: 19 },
    ]);
    expect(objectsFor('gsc_hydro_pump', 'BATTLE_ANIM_OBJ_HYDRO_PUMP').map(({ x }) => x))
      .toEqual([108, 116, 124, 132, 140, 148, 156]);
    expect(objectsFor('gsc_razor_leaf', 'BATTLE_ANIM_OBJ_RAZOR_LEAF').slice(0, 6).map(({ param }) => param))
      .toEqual([40, 92, 16, 232, 156, 208]);
    expect(commandsFor('gsc_fire_blast')).toContainEqual({
      op: 'anim_loop', count: 10, target: 1,
    });
  });

  it('terminates and renders original OAM for all 24 moves', () => {
    for (const effect of GEN2_EFFECTS) {
      const vm = new PokegoldAnimationVM(effect);
      let renderableFrames = 0;
      let peakObjects = 0;
      while (!vm.done && vm.frame < 300) {
        const state = vm.step();
        peakObjects = Math.max(peakObjects, state.objects.length);
        if (state.objects.some(({ renderStep }) => renderStep?.oam)) renderableFrames += 1;
      }
      expect(vm.done, effect).toBe(true);
      expect(renderableFrames, effect).toBeGreaterThan(0);
      expect(peakObjects, effect).toBeLessThanOrEqual(10);
    }
  });

  it('routes every gsc effect only through the shared Gold renderer', () => {
    const source = readFileSync(new URL('../src/renderer/effect-overlay.js', import.meta.url), 'utf8');
    expect(source).toContain("const isPokegold = effect.startsWith('gsc_')");
    expect(source).toContain('pokegoldRenderer.render(ctx, state');
    expect(source).not.toMatch(/effect === ['"]gsc_/);
    expect(source).not.toMatch(/draw(?:Original)?GscMove|hydroGlyph|impactBurst|thunderBallGlyph/);
  });

  it('uses the approved responsive C layout without scaling up the Pokemon', () => {
    const compact = pokegoldLayout(640, 480);
    expect(compact.target.x - compact.user.x).toBeCloseTo(480 * 0.42);
    expect(compact.target.y - compact.user.y).toBeCloseTo(-28 * compact.coordinateScale);
    expect(compact.effectScale).toBe(2);
    expect(compact.pokemonScale).toBe(2);

    const desktop = pokegoldLayout(1440, 900);
    expect(desktop.target.x - desktop.user.x).toBeCloseTo(900 * 0.42);
    expect(desktop.effectScale).toBe(5);
    expect(desktop.pokemonScale).toBe(3);
  });

  it('anchors compact battle effects to the visible Pokemon centers', () => {
    const layout = pokegoldBattleLayout(600, 460);
    expect(layout.user.x).toBeCloseTo(150.24);
    expect(layout.user.y).toBeCloseTo(197.3);
    expect(layout.target.x).toBeCloseTo(444);
    expect(layout.target.y).toBeCloseTo(94.84);
  });
});
