// AI-GENERATED: visual subset of pret/pokegold's battle animation command VM.
import { POKEGOLD_MOVES, POKEGOLD_SCRIPTS } from './pokegold-anim-data.js';
import {
  advanceAnimationFrameset,
  createAnimationObject,
  updateAnimationObject,
} from './pokegold-object-engine.js';

const MAX_OBJECTS = 10;
const MAX_BG_EFFECTS = 5;
const MAX_COMMANDS_PER_FRAME = 1024;
const u8 = (value) => value & 0xff;

function targetSide(value) {
  if (value === 'BG_EFFECT_USER') return 'user';
  if (value === 'BG_EFFECT_TARGET') return 'target';
  return value ? 'user' : 'target';
}

export class PokegoldAnimationVM {
  constructor(effect, options = {}) {
    const move = POKEGOLD_MOVES[effect];
    if (!move) throw new Error(`Unknown pokegold move effect: ${effect}`);
    this.effect = effect;
    this.move = move;
    this.param = u8(options.param ?? move.param);
    this.reset();
  }

  reset() {
    this.frame = -1;
    this.script = this.move.script;
    this.pc = 0;
    this.delay = 0;
    this.callStack = [];
    this.loopCounters = new Map();
    this.objects = [];
    this.backgrounds = [];
    this.lastObjectIndex = 0;
    this.done = false;
    this.bgp = 0xe4;
    this.pokemonVisible = true;
    this.presentation = this.#blankPresentation();
    return this;
  }

  #blankPresentation() {
    return {
      pokemonVisible: this.pokemonVisible,
      pokemonX: 0,
      pokemonY: 0,
      pokemonBrightness: 1,
      pokemonContrast: 1,
      pokemonSaturate: 1,
      pokemonInvert: 0,
      waterStrength: 0,
      waterPhase: 0,
      objectPalettePhase: 0,
      objectPaletteMode: 'normal',
    };
  }

  #currentScript() {
    const script = POKEGOLD_SCRIPTS[this.script];
    if (!script) throw new Error(`Missing pokegold script: ${this.script}`);
    return script;
  }

  #jump(target) {
    if (typeof target === 'number') {
      this.pc = target;
      return;
    }
    this.script = target;
    this.pc = 0;
  }

  #spawnObject(command) {
    if (this.objects.filter(({ active }) => active).length >= MAX_OBJECTS) return null;
    this.lastObjectIndex = u8(this.lastObjectIndex + 1);
    const object = createAnimationObject(command.object, command.x, command.y, command.param, this.lastObjectIndex);
    this.objects.push(object);
    return object;
  }

  #spawnVirtualBattler(side) {
    if (this.objects.filter(({ active }) => active).length >= MAX_OBJECTS) return null;
    this.lastObjectIndex = u8(this.lastObjectIndex + 1);
    const object = {
      active: true,
      virtual: true,
      index: this.lastObjectIndex,
      name: `BATTLE_ANIM_VIRTUAL_${side.toUpperCase()}`,
      jump: 0,
      renderStep: null,
    };
    this.objects.push(object);
    return object;
  }

  #queueBackground(command) {
    if (this.backgrounds.filter(({ active }) => active).length >= MAX_BG_EFFECTS) return;
    this.backgrounds.push({
      active: true,
      effect: command.effect,
      jump: u8(command.jump),
      turn: command.turn,
      param: u8(command.param),
      age: 0,
      initialized: false,
      flashOn: false,
      offset: 0,
      speed: 0,
    });
  }

  #runCommand(command, commandPc) {
    switch (command.op) {
      case 'anim_obj':
        this.#spawnObject(command);
        return false;
      case 'anim_wait':
        this.delay = command.frames;
        return true;
      case 'anim_incobj': {
        const object = this.objects.find((entry) => entry.active && entry.index === command.index);
        if (object) object.jump = u8(object.jump + 1);
        return false;
      }
      case 'anim_loop': {
        const key = `${this.script}:${commandPc}`;
        if (command.count === 0) {
          this.#jump(command.target);
          return false;
        }
        let remaining = this.loopCounters.get(key);
        if (remaining == null) remaining = command.count - 1;
        if (remaining > 0) {
          this.loopCounters.set(key, remaining - 1);
          this.#jump(command.target);
        } else {
          this.loopCounters.delete(key);
        }
        return false;
      }
      case 'anim_call':
        this.callStack.push({ script: this.script, pc: this.pc });
        this.script = command.target;
        this.pc = 0;
        return false;
      case 'anim_ret': {
        const parent = this.callStack.pop();
        if (parent) {
          this.script = parent.script;
          this.pc = parent.pc;
        } else {
          this.done = true;
        }
        return false;
      }
      case 'anim_if_param_equal':
        if (this.param === command.value) this.#jump(command.target);
        return false;
      case 'anim_bgeffect':
        this.#queueBackground(command);
        return false;
      case 'anim_incbgeffect': {
        const background = this.backgrounds.find((entry) => entry.active && entry.effect === command.effect);
        if (background) background.jump = u8(background.jump + 1);
        return false;
      }
      case 'anim_bgp':
        this.bgp = command.value;
        return false;
      case 'anim_1gfx':
      case 'anim_2gfx':
      case 'anim_3gfx':
      case 'anim_sound':
      case 'anim_battlergfx_1row':
      case 'anim_battlergfx_2row':
        return false;
      default:
        throw new Error(`Unsupported pokegold command at runtime: ${command.op}`);
    }
  }

  #runScriptFrame() {
    if (this.done) return;
    if (this.delay > 0) {
      this.delay -= 1;
      return;
    }
    for (let count = 0; count < MAX_COMMANDS_PER_FRAME; count += 1) {
      const script = this.#currentScript();
      const commandPc = this.pc;
      const command = script.commands[this.pc];
      if (!command) throw new Error(`${this.script} ran beyond its command stream`);
      this.pc += 1;
      const yielded = this.#runCommand(command, commandPc);
      if (yielded || this.done) return;
    }
    throw new Error(`${this.effect} exceeded ${MAX_COMMANDS_PER_FRAME} commands in one frame`);
  }

  #updateFlash(background, mode) {
    if (background.jump !== 0) {
      background.jump = u8(background.jump - 1);
    } else if (background.param === 0) {
      background.active = false;
      background.flashOn = false;
    } else {
      background.jump = typeof background.turn === 'number' ? background.turn : 0;
      background.param = u8(background.param - 1);
      background.flashOn = Boolean(background.param & 1);
    }
    if (!background.flashOn) return;
    if (mode === 'inverted') this.presentation.pokemonInvert = 1;
    else this.presentation.pokemonBrightness = 3;
  }

  #updateBackground(background) {
    const side = targetSide(background.turn);
    switch (background.effect) {
      case 'BATTLE_BG_EFFECT_FLASH_INVERTED':
        this.#updateFlash(background, 'inverted');
        break;
      case 'BATTLE_BG_EFFECT_FLASH_WHITE':
        this.#updateFlash(background, 'white');
        break;
      case 'BATTLE_BG_EFFECT_CYCLE_OBPALS_GRAY_AND_YELLOW':
      case 'BATTLE_BG_EFFECT_CYCLE_MID_OBPALS_GRAY_AND_YELLOW': {
        const period = (typeof background.turn === 'number' ? background.turn : 2) + 1;
        this.presentation.objectPalettePhase = Math.floor(background.age / period) & 1;
        this.presentation.objectPaletteMode = background.effect.includes('CYCLE_MID_') ? 'mid' : 'gray-yellow';
        break;
      }
      case 'BATTLE_BG_EFFECT_ALTERNATE_HUES': {
        const cycle = [1, 0.72, 0.42, 0.72, 1, 1.22, 1.45, 1.22];
        this.presentation.pokemonBrightness *= cycle[Math.floor(background.age / 3) % cycle.length];
        break;
      }
      case 'BATTLE_BG_EFFECT_FADE_MON_TO_LIGHT_REPEATING': {
        const cycle = [1, 1.3, 1.8, 1.3];
        this.presentation.pokemonBrightness *= cycle[Math.floor(background.age / 16) % cycle.length];
        break;
      }
      case 'BATTLE_BG_EFFECT_HIDE_MON':
        if (!background.initialized) this.pokemonVisible = side !== 'user';
        if (background.age >= 4) background.active = false;
        break;
      case 'BATTLE_BG_EFFECT_SHOW_MON':
        this.pokemonVisible = true;
        background.active = false;
        break;
      case 'BATTLE_BG_EFFECT_BATTLEROBJ_1ROW':
      case 'BATTLE_BG_EFFECT_BATTLEROBJ_2ROW':
        if (!background.initialized) {
          this.#spawnVirtualBattler(side);
        }
        if (background.age >= 5) background.active = false;
        break;
      case 'BATTLE_BG_EFFECT_TACKLE':
        if (!background.initialized) {
          background.jump = 1;
          background.speed = 2;
          background.offset = 0;
        }
        if (background.jump === 1) {
          if (background.offset === 8) background.jump = 2;
          background.offset += background.speed;
        } else if (background.jump === 2) {
          if (background.offset === 0) background.jump = 3;
          else background.offset -= background.speed;
        } else {
          background.offset = 0;
          background.active = false;
        }
        this.presentation.pokemonX += background.offset;
        break;
      case 'BATTLE_BG_EFFECT_BOUNCE_DOWN':
        if (!background.initialized) background.jump = 1;
        if (background.jump === 1) {
          this.presentation.pokemonY += Math.round(Math.sin(Math.min(1, background.age / 32) * Math.PI) * 16);
        } else {
          background.active = false;
        }
        break;
      case 'BATTLE_BG_EFFECT_START_WATER':
      case 'BATTLE_BG_EFFECT_END_WATER':
        background.active = false;
        break;
      case 'BATTLE_BG_EFFECT_WATER':
        this.presentation.waterStrength = Math.max(this.presentation.waterStrength, 4);
        this.presentation.waterPhase = background.jump + background.age * 4;
        if (background.age >= 16) background.active = false;
        break;
      default:
        throw new Error(`Unsupported pokegold background effect: ${background.effect}`);
    }
    background.initialized = true;
    background.age += 1;
  }

  #updateFrameState() {
    this.presentation = this.#blankPresentation();
    for (const background of this.backgrounds) {
      if (background.active) this.#updateBackground(background);
    }
    this.presentation.pokemonVisible = this.pokemonVisible;
    for (const object of this.objects) {
      if (!object.active) continue;
      if (object.virtual) {
        if (object.jump !== 0) object.active = false;
        continue;
      }
      updateAnimationObject(object);
      advanceAnimationFrameset(object);
    }
  }

  step() {
    if (this.done) return this.snapshot();
    this.frame += 1;
    this.#runScriptFrame();
    this.#updateFrameState();
    return this.snapshot();
  }

  seek(frame) {
    const target = Math.max(0, Math.floor(frame));
    if (target < this.frame) this.reset();
    while (!this.done && this.frame < target) this.step();
    return this.snapshot();
  }

  snapshot() {
    return {
      effect: this.effect,
      frame: this.frame,
      done: this.done,
      objects: this.objects.filter(({ active, virtual }) => active && !virtual),
      presentation: { ...this.presentation },
    };
  }
}

export function measurePokegoldAnimation(effect, maxFrames = 1200) {
  const vm = new PokegoldAnimationVM(effect);
  while (!vm.done && vm.frame < maxFrames) vm.step();
  if (!vm.done) throw new Error(`${effect} did not finish within ${maxFrames} frames`);
  return vm.frame + 1;
}
