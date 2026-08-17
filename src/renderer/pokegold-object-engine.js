// AI-GENERATED: integer state transitions ported from pret/pokegold functions.asm.
import { POKEGOLD_FRAMESETS, POKEGOLD_OBJECTS } from './pokegold-anim-data.js';

const u8 = (value) => value & 0xff;
export const signed8 = (value) => (u8(value) & 0x80 ? u8(value) - 0x100 : u8(value));

function sine(angle, amplitude) {
  const phase = u8(angle) & 0x3f;
  const negative = phase >= 0x20;
  const sample = negative ? phase & 0x1f : phase;
  const magnitude = Math.floor(amplitude * Math.sin(sample * Math.PI / 32) + 1e-9);
  return negative ? -magnitude : magnitude;
}

function cosine(angle, amplitude) {
  return sine(u8(angle + 0x10), amplitude);
}

function setOffset(object, key, value) {
  object[key] = u8(value);
}

function reinitFrameset(object, frameset, frame = -1) {
  if (!POKEGOLD_FRAMESETS[frameset]) throw new Error(`Unknown pokegold frameset: ${frameset}`);
  object.frameset = frameset;
  object.frame = frame;
  object.frameDuration = 0;
  object.renderStep = null;
}

function deactivate(object) {
  object.active = false;
  object.renderStep = null;
}

function stepToTarget(object, rawSpeed) {
  const speed = rawSpeed & 0x0f;
  object.x = u8(object.x + speed);
  object.y = u8(object.y - (speed >> 1));
}

function moveInCircle(object) {
  if (object.jump === 0) {
    object.jump = 1;
    object.var1 = object.param & 0x80 ? 0x20 : 0;
    object.param &= 0x7f;
  }
  setOffset(object, 'yOffset', sine(object.var1, object.param));
  setOffset(object, 'xOffset', cosine(object.var1, object.param));
  object.var1 = u8(object.var1 + 1);
}

function shake(object) {
  if (object.jump === 0) {
    object.jump = 1;
    object.var1 = 0;
    object.xOffset = object.param & 0x0f;
  }
  if (object.jump === 1) {
    if (object.var1 !== 0) {
      object.var1 = u8(object.var1 - 1);
      return;
    }
    object.var1 = (object.param >> 4) & 0x0f;
    object.xOffset = u8(-signed8(object.xOffset));
    return;
  }
  deactivate(object);
}

function ember(object) {
  if (object.jump === 0) {
    object.jump = (object.param >> 4) & 0x0f;
    return;
  }
  if (object.jump === 1) {
    if (object.x < 0x88) stepToTarget(object, object.param);
    return;
  }
  if (object.jump === 2) {
    deactivate(object);
    return;
  }
  if (object.jump === 3) {
    object.jump = 4;
    reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_FLAMETHROWER');
  }
}

function fireBlast(object) {
  if (object.jump === 0) {
    object.jump = object.param;
    if (object.param !== 7) {
      reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_BURNED');
      return;
    }
  }
  if (object.jump === 7) {
    if (object.x < 0x88) {
      object.x = u8(object.x + 2);
      object.y = u8(object.y - 1);
      return;
    }
    object.jump = 8;
    reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_EMBER');
  }
  if (object.jump === 8) {
    setOffset(object, 'yOffset', sine(object.var1, 0x10));
    setOffset(object, 'xOffset', cosine(object.var1, 0x10));
    object.var1 = u8(object.var1 + 1);
    return;
  }
  if (object.jump === 9) {
    deactivate(object);
    return;
  }
  if (object.jump === 1) setOffset(object, 'yOffset', signed8(object.yOffset) - 1);
  if (object.jump === 2 || object.jump === 4) setOffset(object, 'xOffset', signed8(object.xOffset) - 1);
  if (object.jump === 3 || object.jump === 5) setOffset(object, 'xOffset', signed8(object.xOffset) + 1);
  if (object.jump === 4 || object.jump === 5) setOffset(object, 'yOffset', signed8(object.yOffset) + 1);
}

function scatterDelta(param) {
  const radius = param & 0x3f;
  const amount = radius < 0x18 ? 0x200 : (radius < 0x20 ? 0x180 : 0x100);
  return param & 0x80 ? -amount : amount;
}

function razorLeaf(object) {
  if (object.jump === 0) {
    object.jump = 1;
    object.var1 = 0x40;
  }
  if (object.jump === 1) {
    if (object.var1 >= 0x30) {
      const angle = object.var1;
      object.var1 = u8(object.var1 - 1);
      setOffset(object, 'yOffset', sine(angle, object.param & 0x3f));
      const fixedX = ((object.x << 8) | object.var2) + scatterDelta(object.param);
      object.x = u8(fixedX >> 8);
      object.var2 = u8(fixedX);
      return;
    }
    object.jump = 2;
    object.var1 = 0;
    object.var2 = 0;
    reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_RAZOR_LEAF_2', object.param & 0x40 ? 5 : -1);
    return;
  }
  if (object.jump === 2) {
    if (object.yOffset === 0x20) {
      deactivate(object);
      return;
    }
    setOffset(object, 'xOffset', sine(object.var1, 0x10));
    object.var1 = u8(object.var1 + (object.param & 0x40 ? -1 : 1));
    const fixedY = ((object.yOffset << 8) | object.var2) + 0x80;
    object.yOffset = u8(fixedY >> 8);
    object.var2 = u8(fixedY);
    return;
  }
  if (object.jump === 3) {
    reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_RAZOR_LEAF_1');
    object.jump = 4;
    return;
  }
  if (object.jump >= 4 && object.jump <= 7) {
    object.jump += 1;
    return;
  }
  if (object.jump === 8 && object.x < 0xc0) stepToTarget(object, 8);
}

function waterGun(object) {
  if (object.jump === 0) object.jump = 1;
  if (object.jump === 1) {
    if (object.y >= 0x30) {
      stepToTarget(object, 2);
      const angle = object.var1;
      object.var1 = u8(object.var1 - 1);
      setOffset(object, 'yOffset', sine(angle, 8));
      return;
    }
    object.jump = 2;
    reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_WATER_GUN_2');
    object.yOffset = 0;
    object.y = 0x30;
    return;
  }
  if (object.jump === 2) {
    if (object.yOffset < 0x18) {
      object.yOffset += 1;
      return;
    }
    object.jump = 3;
    reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_WATER_GUN_3');
  }
}

function powder(object) {
  if (object.yOffset >= 0x38) {
    deactivate(object);
    return;
  }
  const fixedY = ((object.yOffset << 8) | object.var1) + 0x80;
  object.var1 = u8(fixedY);
  object.yOffset = u8(fixedY >> 8);
  object.xOffset ^= 0x10;
}

function thunderWave(object) {
  if (object.jump === 1) {
    object.jump = 2;
    reinitFrameset(object, 'BATTLE_ANIM_FRAMESET_THUNDER_WAVE_EXTRA');
    return;
  }
  if (object.jump === 3) deactivate(object);
}

function bite(object) {
  if (object.jump === 0) {
    object.jump = 1;
    object.var1 = object.param & 0x80 ? 0x30 : 0x10;
    object.param &= 0x7f;
  }
  if (object.jump === 1) {
    const offset = sine(object.var1, object.param);
    setOffset(object, 'yOffset', offset);
    reinitFrameset(object, offset < 0 ? 'BATTLE_ANIM_FRAMESET_BITE_1' : 'BATTLE_ANIM_FRAMESET_BITE_2');
    object.var1 = u8(object.var1 + 2);
    if ((object.var1 & 0x1f) === 0) object.jump += 1;
    return;
  }
  if (object.jump >= 2 && object.jump <= 5) {
    object.jump += 1;
    return;
  }
  if (object.jump === 6) object.jump = 1;
}

function solarBeam(object) {
  if (object.jump === 0) {
    object.jump = 1;
    object.var1 = 0x28;
    object.var2 = 0;
  }
  setOffset(object, 'yOffset', sine(object.param, object.var1));
  setOffset(object, 'xOffset', cosine(object.param, object.var1));
  if (object.var1 === 0) {
    deactivate(object);
    return;
  }
  const radius = ((object.var1 << 8) | object.var2) - 0x80;
  object.var1 = u8(radius >> 8);
  object.var2 = u8(radius);
}

function setSpinCoords(object) {
  const speed = object.param & 0x0f;
  object.x = u8(object.x + speed);
  object.y = u8(object.y - (speed >> 1));
}

function userToTargetSpin(object) {
  if (object.jump === 0) {
    if (object.x < 0x80) {
      setSpinCoords(object);
      return;
    }
    object.jump = 1;
  }
  if (object.jump === 1) {
    object.jump = 2;
    object.var1 = 0;
  }
  if (object.jump === 2) {
    if (object.var1 < 0x40) {
      setOffset(object, 'yOffset', (cosine(object.var1, 0x18) - 0x18) >> 1);
      setOffset(object, 'xOffset', sine(object.var1, 0x18));
      object.var1 = u8(object.var1 + (object.param & 0x0f));
      return;
    }
    const loops = object.param & 0xf0;
    if (loops) {
      object.param = (loops - 0x10) | (object.param & 0x0f);
      object.jump = 1;
      return;
    }
    object.jump = 3;
  }
  if (object.jump === 3) {
    if (object.x >= 0xb0) deactivate(object);
    else setSpinCoords(object);
  }
}

function shiny(object) {
  if (object.jump !== 0) return;
  object.jump = 1;
  setOffset(object, 'yOffset', sine(object.param, 0x10));
  setOffset(object, 'xOffset', cosine(object.param, 0x10));
  object.var2 = 0x0f;
}

function smokeFlameWheel(object) {
  const angle = object.param;
  setOffset(object, 'yOffset', (sine(angle, 0x18) >> 3) + signed8(object.var2));
  setOffset(object, 'xOffset', cosine(angle, 0x18));
  object.param = u8(object.param + 2);
  if ((object.param & 7) !== 0) return;
  if (object.var2 === 0xe8) deactivate(object);
  else object.var2 = u8(object.var2 - 1);
}

function presentSmokescreen(object) {
  if (object.jump === 0) {
    object.jump = 1;
    object.var1 = 0x34;
    object.var2 = 0x10;
  }
  if (object.jump === 1) {
    if (object.x >= 0x6c) return;
    stepToTarget(object, 2);
    setOffset(object, 'yOffset', -Math.abs(sine(object.var1, object.var2)));
    object.var1 = u8(object.var1 - 4);
    return;
  }
  deactivate(object);
}

function floatUp(object) {
  const angle = object.var1;
  object.var1 = u8(object.var1 + 2);
  setOffset(object, 'xOffset', sine(angle, 4));
  const fixedY = ((object.yOffset << 8) | object.var2) - 0x60;
  object.yOffset = u8(fixedY >> 8);
  object.var2 = u8(fixedY);
}

function speedLine(object) {
  if (object.jump === 0) {
    object.jump = 1;
    reinitFrameset(object, `BATTLE_ANIM_FRAMESET_SPEED_LINE_${(object.param & 0x7f) + 1}`);
  }
  setOffset(object, 'xOffset', signed8(object.xOffset) + (object.param & 0x80 ? -1 : 1));
}

const CALLBACKS = Object.freeze({
  NULL(object) { if (object.jump !== 0) deactivate(object); },
  MOVE_IN_CIRCLE: moveInCircle,
  USER_TO_TARGET_SPIN: userToTargetSpin,
  SHAKE: shake,
  FIRE_BLAST: fireBlast,
  RAZOR_LEAF: razorLeaf,
  WATER_GUN: waterGun,
  EMBER: ember,
  POWDER: powder,
  THUNDER_WAVE: thunderWave,
  BITE: bite,
  SOLAR_BEAM: solarBeam,
  FLOAT_UP: floatUp,
  SHINY: shiny,
  SMOKE_FLAME_WHEEL: smokeFlameWheel,
  PRESENT_SMOKESCREEN: presentSmokescreen,
  SPEED_LINE: speedLine,
});

export const POKEGOLD_SUPPORTED_CALLBACKS = Object.freeze(Object.keys(CALLBACKS));

export function createAnimationObject(name, x, y, param, index) {
  const definition = POKEGOLD_OBJECTS[name];
  if (!definition) throw new Error(`Unknown pokegold object: ${name}`);
  return {
    active: true,
    virtual: false,
    index,
    name,
    callback: definition.callback,
    palette: definition.palette,
    gfx: definition.gfx,
    priority: definition.priority,
    x: u8(x),
    y: u8(y),
    xOffset: 0,
    yOffset: 0,
    param: u8(param),
    jump: 0,
    var1: 0,
    var2: 0,
    frameset: definition.frameset,
    frame: -1,
    frameDuration: 0,
    renderStep: null,
  };
}

export function updateAnimationObject(object) {
  if (!object.active || object.virtual) return;
  const callback = CALLBACKS[object.callback];
  if (!callback) throw new Error(`Unsupported pokegold callback: ${object.callback}`);
  callback(object);
}

export function advanceAnimationFrameset(object) {
  if (!object.active || object.virtual) return null;
  const frameset = POKEGOLD_FRAMESETS[object.frameset];
  if (!frameset) throw new Error(`Unknown pokegold frameset: ${object.frameset}`);
  if (object.frameDuration > 0) {
    object.frameDuration -= 1;
    return object.renderStep;
  }

  object.frame += 1;
  if (object.frame >= frameset.steps.length) {
    if (frameset.mode === 'delete') {
      deactivate(object);
      return null;
    }
    if (frameset.mode === 'restart') object.frame = 0;
    else object.frame = frameset.steps.length - 1;
  }
  const step = frameset.steps[object.frame];
  object.frameDuration = step.duration;
  object.renderStep = step;
  return step;
}
