// AI-GENERATED: draws only original pret/pokegold tiles and palettes.
import {
  POKEGOLD_OAM_SETS,
  POKEGOLD_PALETTES,
  POKEGOLD_SOURCE,
} from './pokegold-anim-data.js';
import { signed8 } from './pokegold-object-engine.js';

const USER_ANCHOR = Object.freeze({ x: 48, y: 84 });
const TARGET_ANCHOR = Object.freeze({ x: 136, y: 56 });
const TARGET_DISTANCE_RATIO = 0.42;
const tintedSheets = new Map();
let sheetsPromise = null;

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load pokegold asset: ${source}`));
    image.src = source;
  });
}

export function loadPokegoldAssets() {
  if (!sheetsPromise) {
    sheetsPromise = Promise.all(POKEGOLD_SOURCE.assets.map(async (name) => [
      name,
      await loadImage(new URL(`./assets/battle-anims/${name}.png`, import.meta.url).href),
    ])).then((entries) => Object.fromEntries(entries));
  }
  return sheetsPromise;
}

function colorIndex(red) {
  if (red > 212) return 0;
  if (red > 127) return 1;
  if (red > 42) return 2;
  return 3;
}

function paletteMap(mode, phase) {
  if (!phase) return [0, 1, 2, 3];
  if (mode === 'mid') return [0, 2, 1, 3];
  if (mode === 'gray-yellow') return [0, 0, 1, 2];
  return [0, 1, 2, 3];
}

function tintedSheet(sheets, name, paletteName, mode, phase) {
  const key = `${name}:${paletteName}:${mode}:${phase}`;
  if (tintedSheets.has(key)) return tintedSheets.get(key);
  const image = sheets[name];
  const palette = POKEGOLD_PALETTES[paletteName];
  if (!image || !palette) throw new Error(`Missing pokegold render resource: ${name}/${paletteName}`);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const mapping = paletteMap(mode, phase);
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const sourceIndex = colorIndex(pixels.data[offset]);
    const mappedIndex = mapping[sourceIndex];
    const color = palette[mappedIndex];
    if (!color || mappedIndex === 0) {
      pixels.data[offset + 3] = 0;
      continue;
    }
    pixels.data[offset] = parseInt(color.slice(1, 3), 16);
    pixels.data[offset + 1] = parseInt(color.slice(3, 5), 16);
    pixels.data[offset + 2] = parseInt(color.slice(5, 7), 16);
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  tintedSheets.set(key, canvas);
  return canvas;
}

function clampedIntegerScale(shortSide, divisor, maximum) {
  return Math.max(2, Math.min(maximum, Math.floor(shortSide / divisor)));
}

export function pokegoldLayout(width, height) {
  const shortSide = Math.min(width, height);
  const coordinateScale = shortSide * TARGET_DISTANCE_RATIO / (TARGET_ANCHOR.x - USER_ANCHOR.x);
  return {
    coordinateScale,
    effectScale: clampedIntegerScale(shortSide, 180, 5),
    pokemonScale: clampedIntegerScale(shortSide, 240, 3),
    user: { x: width / 2, y: height / 2 },
    target: {
      x: width / 2 + (TARGET_ANCHOR.x - USER_ANCHOR.x) * coordinateScale,
      y: height / 2 + (TARGET_ANCHOR.y - USER_ANCHOR.y) * coordinateScale,
    },
  };
}

function nativeToScreen(x, y, layout) {
  return {
    x: Math.round(layout.user.x + (x - USER_ANCHOR.x) * layout.coordinateScale),
    y: Math.round(layout.user.y + (y - USER_ANCHOR.y) * layout.coordinateScale),
  };
}

function ensurePokemonLayer(renderer, size) {
  if (!renderer.pokemonLayer) renderer.pokemonLayer = document.createElement('canvas');
  if (renderer.pokemonLayer.width !== size || renderer.pokemonLayer.height !== size) {
    renderer.pokemonLayer.width = size;
    renderer.pokemonLayer.height = size;
  }
  return renderer.pokemonLayer;
}

function drawPokemon(renderer, context, state, pokemonSprite, layout) {
  const presentation = state.presentation;
  if (!pokemonSprite || !presentation.pokemonVisible) return;
  const { pokemonScale: scale } = layout;
  const size = 56 * scale;
  const layer = ensurePokemonLayer(renderer, size);
  const layerContext = layer.getContext('2d');
  layerContext.clearRect(0, 0, size, size);
  layerContext.imageSmoothingEnabled = false;
  layerContext.filter = [
    `brightness(${presentation.pokemonBrightness})`,
    `contrast(${presentation.pokemonContrast})`,
    `saturate(${presentation.pokemonSaturate})`,
    `invert(${presentation.pokemonInvert})`,
  ].join(' ');
  layerContext.drawImage(pokemonSprite, 0, 0, size, size);
  layerContext.filter = 'none';

  const centerX = Math.round(layout.user.x + presentation.pokemonX * scale);
  const centerY = Math.round(layout.user.y + presentation.pokemonY * scale);
  const left = centerX - size / 2;
  const top = centerY - size / 2;
  context.imageSmoothingEnabled = false;
  if (!presentation.waterStrength) {
    context.drawImage(layer, left, top);
    return;
  }
  for (let row = 0; row < size; row += scale) {
    const sourceHeight = Math.min(scale, size - row);
    const wave = Math.round(Math.sin((row / scale + presentation.waterPhase) * Math.PI / 16)
      * presentation.waterStrength * scale);
    context.drawImage(layer, 0, row, size, sourceHeight, left + wave, top + row, size, sourceHeight);
  }
}

function drawObject(context, state, object, sheets, layout) {
  const step = object.renderStep;
  if (!step?.oam) return;
  const tiles = POKEGOLD_OAM_SETS[step.oam];
  if (!tiles) throw new Error(`Missing pokegold OAM set: ${step.oam}`);
  const source = tintedSheet(
    sheets,
    object.gfx,
    object.palette,
    state.presentation.objectPaletteMode,
    state.presentation.objectPalettePhase,
  );
  const anchor = nativeToScreen(
    object.x + signed8(object.xOffset),
    object.y + signed8(object.yOffset),
    layout,
  );
  const scale = layout.effectScale;
  const columns = Math.max(1, Math.floor(source.width / 8));
  for (const tile of tiles) {
    const tileX = step.flipX ? -tile.x - 8 : tile.x;
    const tileY = step.flipY ? -tile.y - 8 : tile.y;
    const sourceX = (tile.tile % columns) * 8;
    const sourceY = Math.floor(tile.tile / columns) * 8;
    const flipX = Boolean(tile.flipX) !== Boolean(step.flipX);
    const flipY = Boolean(tile.flipY) !== Boolean(step.flipY);
    context.save();
    context.imageSmoothingEnabled = false;
    context.translate(
      Math.round(anchor.x + (tileX + 4) * scale),
      Math.round(anchor.y + (tileY + 4) * scale),
    );
    context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    context.drawImage(source, sourceX, sourceY, 8, 8, -4 * scale, -4 * scale, 8 * scale, 8 * scale);
    context.restore();
  }
}

export class PokegoldAnimationRenderer {
  constructor() {
    this.sheets = null;
    this.pokemonLayer = null;
  }

  async load() {
    this.sheets = await loadPokegoldAssets();
    return this;
  }

  render(context, state, { pokemonSprite = null, width = context.canvas.width, height = context.canvas.height } = {}) {
    if (!this.sheets) return false;
    const layout = pokegoldLayout(width, height);
    const behind = state.objects.filter(({ priority }) => priority);
    const front = state.objects.filter(({ priority }) => !priority);
    behind.forEach((object) => drawObject(context, state, object, this.sheets, layout));
    drawPokemon(this, context, state, pokemonSprite, layout);
    front.forEach((object) => drawObject(context, state, object, this.sheets, layout));
    return true;
  }
}
