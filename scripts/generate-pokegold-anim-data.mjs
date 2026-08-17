// AI-GENERATED: pret/pokegold battle-animation sources are compiled for the browser here.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.argv[2] || '/tmp/pokegold');
const outputFile = join(repoRoot, 'src/renderer/pokegold-anim-data.js');
const assetDir = join(repoRoot, 'src/renderer/assets/battle-anims');

const MOVE_DEFS = Object.freeze({
  gsc_razor_leaf: { label: 'BattleAnim_RazorLeaf', param: 0 },
  gsc_body_slam: { label: 'BattleAnim_BodySlam', param: 0 },
  gsc_poisonpowder: { label: 'BattleAnim_Poisonpowder', param: 0 },
  gsc_synthesis: { label: 'BattleAnim_Synthesis', param: 0 },
  gsc_solarbeam: { label: 'BattleAnim_Solarbeam', param: 0 },
  gsc_light_screen: { label: 'BattleAnim_LightScreen', param: 0 },
  gsc_ember: { label: 'BattleAnim_Ember', param: 0 },
  gsc_smokescreen: { label: 'BattleAnim_Smokescreen', param: 0 },
  gsc_flame_wheel: { label: 'BattleAnim_FlameWheel', param: 0 },
  gsc_swift: { label: 'BattleAnim_Swift', param: 0 },
  gsc_flamethrower: { label: 'BattleAnim_Flamethrower', param: 0 },
  gsc_fire_blast: { label: 'BattleAnim_FireBlast', param: 0 },
  gsc_water_gun: { label: 'BattleAnim_WaterGun', param: 0 },
  gsc_bite: { label: 'BattleAnim_Bite', param: 0 },
  gsc_ice_punch: { label: 'BattleAnim_IcePunch', param: 0 },
  gsc_scary_face: { label: 'BattleAnim_ScaryFace', param: 0 },
  gsc_hydro_pump: { label: 'BattleAnim_HydroPump', param: 0 },
  gsc_slash: { label: 'BattleAnim_Slash', param: 0 },
  gsc_thundershock: { label: 'BattleAnim_Thundershock', param: 0 },
  gsc_sweet_kiss: { label: 'BattleAnim_SweetKiss', param: 0 },
  gsc_thunder_wave: { label: 'BattleAnim_ThunderWave', param: 0 },
  gsc_quick_attack: { label: 'BattleAnim_QuickAttack', param: 0 },
  gsc_thunderbolt: { label: 'BattleAnim_Thunderbolt', param: 0 },
  gsc_thunder: { label: 'BattleAnim_Thunder', param: 0 },
});

const SUPPORTED_SCRIPT_COMMANDS = new Set([
  'anim_1gfx', 'anim_2gfx', 'anim_3gfx',
  'anim_battlergfx_1row', 'anim_battlergfx_2row',
  'anim_bgeffect', 'anim_bgp', 'anim_call', 'anim_if_param_equal',
  'anim_incbgeffect', 'anim_incobj', 'anim_loop', 'anim_obj',
  'anim_ret', 'anim_sound', 'anim_wait',
]);

function read(relativePath) {
  return readFileSync(join(sourceRoot, relativePath), 'utf8');
}

function number(value) {
  const text = value.trim();
  const sign = text.startsWith('-') ? -1 : 1;
  const unsigned = sign < 0 ? text.slice(1) : text;
  if (/^\$[0-9a-f]+$/i.test(unsigned)) return sign * parseInt(unsigned.slice(1), 16);
  if (/^%[01]+$/.test(unsigned)) return sign * parseInt(unsigned.slice(1), 2);
  if (/^\d+$/.test(unsigned)) return sign * parseInt(unsigned, 10);
  throw new Error(`Expected numeric ASM value, received: ${value}`);
}

function splitArgs(value = '') {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function json(value) {
  return JSON.stringify(value, null, 2);
}

function parseMoveScripts() {
  const source = read('data/moves/animations.asm');
  const lines = source.split(/\r?\n/);
  const globals = [];
  lines.forEach((line, index) => {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*$/);
    if (match) globals.push({ name: match[1], index });
  });
  const byName = new Map(globals.map((entry, index) => [entry.name, { ...entry, order: index }]));

  function bodyFor(name) {
    const entry = byName.get(name);
    if (!entry) throw new Error(`Missing animation script label: ${name}`);
    const end = globals[entry.order + 1]?.index ?? lines.length;
    return lines.slice(entry.index + 1, end);
  }

  function resolveAlias(name) {
    const visited = new Set();
    let current = name;
    while (true) {
      if (visited.has(current)) throw new Error(`Animation alias cycle: ${[...visited, current].join(' -> ')}`);
      visited.add(current);
      if (bodyFor(current).some((line) => /^\s+anim_[a-z0-9_]+/i.test(line))) return current;
      const entry = byName.get(current);
      const next = globals[entry.order + 1]?.name;
      if (!next) throw new Error(`Animation alias has no implementation: ${name}`);
      current = next;
    }
  }

  function parseScript(requestedName) {
    const name = resolveAlias(requestedName);
    const body = bodyFor(name);
    const labels = { [name]: 0 };
    let commandIndex = 0;
    for (const rawLine of body) {
      const line = rawLine.replace(/;.*$/, '').trim();
      const local = line.match(/^(\.[A-Za-z0-9_]+):?$/);
      if (local) {
        labels[`${name}${local[1]}`] = commandIndex;
        continue;
      }
      if (/^anim_[a-z0-9_]+/i.test(line)) commandIndex += 1;
    }

    const commands = [];
    const dependencies = new Set();
    const objects = new Set();
    const backgrounds = new Set();
    for (const rawLine of body) {
      const line = rawLine.replace(/;.*$/, '').trim();
      const match = line.match(/^(anim_[a-z0-9_]+)(?:\s+(.*))?$/i);
      if (!match) continue;
      const op = match[1].toLowerCase();
      if (!SUPPORTED_SCRIPT_COMMANDS.has(op)) throw new Error(`${name} uses unsupported command ${op}`);
      const args = splitArgs(match[2]);
      const command = { op };

      if (op === 'anim_obj') {
        if (args.length !== 4) throw new Error(`${name}: invalid anim_obj: ${line}`);
        Object.assign(command, { object: args[0], x: number(args[1]), y: number(args[2]), param: number(args[3]) });
        objects.add(args[0]);
      } else if (op === 'anim_wait') {
        command.frames = number(args[0]);
      } else if (op === 'anim_incobj') {
        command.index = number(args[0]);
      } else if (op === 'anim_loop') {
        const target = args[1].startsWith('.') ? `${name}${args[1]}` : resolveAlias(args[1]);
        Object.assign(command, { count: number(args[0]), target: labels[target] ?? target });
        if (typeof command.target === 'string') dependencies.add(command.target);
      } else if (op === 'anim_call') {
        command.target = args[0].startsWith('.') ? `${name}${args[0]}` : resolveAlias(args[0]);
        if (command.target.startsWith('BattleAnim')) dependencies.add(command.target);
      } else if (op === 'anim_if_param_equal') {
        const target = args[1].startsWith('.') ? `${name}${args[1]}` : resolveAlias(args[1]);
        Object.assign(command, { value: number(args[0]), target: labels[target] ?? target });
        if (typeof command.target === 'string') dependencies.add(command.target);
      } else if (op === 'anim_bgeffect') {
        Object.assign(command, {
          effect: args[0],
          jump: number(args[1]),
          turn: /^BG_EFFECT_/.test(args[2]) ? args[2] : number(args[2]),
          param: number(args[3]),
        });
        backgrounds.add(args[0]);
      } else if (op === 'anim_incbgeffect') {
        command.effect = args[0];
        backgrounds.add(args[0]);
      } else if (op === 'anim_bgp') {
        command.value = number(args[0]);
      } else if (/^anim_[123]gfx$/.test(op)) {
        command.gfx = args;
      } else if (op === 'anim_sound') {
        command.args = args.map((arg) => (/^-?(?:\$[0-9a-f]+|%[01]+|\d+)$/i.test(arg) ? number(arg) : arg));
      }
      commands.push(command);
    }

    for (const [label, target] of Object.entries(labels)) {
      if (target > commands.length) throw new Error(`${name}: invalid local label ${label}`);
    }
    for (const command of commands) {
      if (['anim_loop', 'anim_if_param_equal'].includes(command.op)
        && typeof command.target === 'string' && command.target.startsWith(`${name}.`)) {
        throw new Error(`${name}: unresolved local target ${command.target}`);
      }
    }
    return { name, labels, commands, dependencies, objects, backgrounds };
  }

  const queue = Object.values(MOVE_DEFS).map(({ label }) => resolveAlias(label));
  const scripts = {};
  const requiredObjects = new Set();
  const requiredBackgrounds = new Set();
  while (queue.length) {
    const name = queue.shift();
    if (scripts[name]) continue;
    const parsed = parseScript(name);
    scripts[name] = { labels: parsed.labels, commands: parsed.commands };
    parsed.objects.forEach((object) => requiredObjects.add(object));
    parsed.backgrounds.forEach((effect) => requiredBackgrounds.add(effect));
    parsed.dependencies.forEach((dependency) => queue.push(resolveAlias(dependency)));
  }

  const moves = Object.fromEntries(Object.entries(MOVE_DEFS).map(([effect, definition]) => [effect, {
    ...definition,
    script: resolveAlias(definition.label),
  }]));
  if (Object.keys(moves).length !== 24) throw new Error(`Expected 24 moves, found ${Object.keys(moves).length}`);
  return { moves, scripts, requiredObjects, requiredBackgrounds };
}

function constantsInSection(source, startMarker, endMarker, prefix) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Missing constants section ${startMarker}`);
  return [...source.slice(start, end).matchAll(new RegExp(`^\\s*const\\s+(${prefix}[A-Z0-9_]+)`, 'gm'))]
    .map((match) => match[1]);
}

function parseObjects(requiredObjects) {
  const constants = read('constants/battle_anim_constants.asm');
  const names = constantsInSection(constants, '; BattleAnimObjects indexes', 'DEF NUM_BATTLE_ANIM_OBJS', 'BATTLE_ANIM_OBJ_');
  const source = read('data/battle_anims/objects.asm');
  const rows = [...source.matchAll(/^\s*battleanimobj\s+([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^\s;]+)/gm)]
    .map((match) => match.slice(1));
  if (names.length !== rows.length) throw new Error(`Object table mismatch: ${names.length} constants, ${rows.length} rows`);

  const objects = {};
  names.forEach((name, index) => {
    if (!requiredObjects.has(name)) return;
    const [flags, yFix, frameset, callback, palette, gfx] = rows[index];
    objects[name] = {
      priority: flags.includes('OAM_PRIO'),
      frameset,
      callback: callback.replace('BATTLE_ANIM_FUNC_', ''),
      palette: palette.replace('PAL_BATTLE_OB_', '').toLowerCase(),
      gfx: gfx.replace('BATTLE_ANIM_GFX_', '').toLowerCase(),
      yFix: number(yFix),
    };
  });
  const missing = [...requiredObjects].filter((name) => !objects[name]);
  if (missing.length) throw new Error(`Unresolved animation objects: ${missing.join(', ')}`);
  return objects;
}

function localSections(source, prefix) {
  const matches = [...source.matchAll(new RegExp(`^\\.${prefix}([A-Za-z0-9_]+):\\s*$`, 'gm'))];
  return Object.fromEntries(matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? source.length;
    return [match[1].toUpperCase(), source.slice(start, end)];
  }));
}

function parseFramesets() {
  const source = read('data/battle_anims/framesets.asm');
  const framesets = {};
  const tablePattern = /^\s*dw\s+\.Frameset_([A-Za-z0-9_]+)\s*;\s*(BATTLE_ANIM_FRAMESET_[A-Z0-9_]+)/gm;
  for (const match of source.matchAll(tablePattern)) {
    const labelPattern = new RegExp(`^\\.Frameset_${match[1]}:\\s*$`, 'm');
    const label = labelPattern.exec(source);
    if (!label) throw new Error(`Missing frameset body: ${match[1]}`);
    const tail = source.slice(label.index + label[0].length);
    const terminal = /^\s*oam(?:restart|end|delete)\s*$/m.exec(tail);
    if (!terminal) throw new Error(`Missing frameset terminator: ${match[1]}`);
    // A few Gold framesets intentionally fall through into the next labeled frameset.
    const body = tail.slice(0, terminal.index + terminal[0].length);
    const steps = [];
    let mode = null;
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.replace(/;.*$/, '').trim();
      const frame = line.match(/^oamframe\s+(BATTLE_ANIM_OAMSET_[0-9A-F]+),\s*([^,]+)(?:,\s*(.*))?$/i);
      if (frame) {
        steps.push({
          oam: frame[1].toUpperCase(),
          duration: number(frame[2]),
          flipX: Boolean(frame[3]?.includes('B_OAM_XFLIP')),
          flipY: Boolean(frame[3]?.includes('B_OAM_YFLIP')),
        });
        continue;
      }
      const wait = line.match(/^oamwait\s+(.+)$/);
      if (wait) {
        steps.push({ oam: null, duration: number(wait[1]), flipX: false, flipY: false });
        continue;
      }
      if (line === 'oamrestart') mode = 'restart';
      if (line === 'oamend') mode = 'end';
      if (line === 'oamdelete') mode = 'delete';
    }
    if (!steps.length || !mode) throw new Error(`Incomplete frameset ${match[2]}`);
    framesets[match[2]] = { steps, mode };
  }
  return framesets;
}

function parseOamSets() {
  const source = read('data/battle_anims/oam.asm');
  const oamSets = {};
  const pattern = /^\s*battleanimoam\s+([^,]+),\s*([^,]+),\s*\.OAMData_([0-9a-f]+)\s*;\s*(BATTLE_ANIM_OAMSET_[0-9A-F]+)/gim;
  for (const match of source.matchAll(pattern)) {
    const tileOffset = number(match[1]);
    const count = number(match[2]);
    const labelPattern = new RegExp(`^\\.OAMData_${match[3]}:\\s*$`, 'mi');
    const label = labelPattern.exec(source);
    if (!label) throw new Error(`Missing OAM body: ${match[3]}`);
    // OAM sets can deliberately continue through another label (for shared suffixes).
    const body = source.slice(label.index + label[0].length);
    const tiles = [];
    for (const entry of body.matchAll(/^\s*dbsprite\s+([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*(.+)$/gm)) {
      tiles.push({
        x: number(entry[1]) * 8 + number(entry[3]),
        y: number(entry[2]) * 8 + number(entry[4]),
        tile: tileOffset + number(entry[5]),
        flipX: entry[6].includes('OAM_XFLIP'),
        flipY: entry[6].includes('OAM_YFLIP'),
      });
      if (tiles.length === count) break;
    }
    if (tiles.length !== count) throw new Error(`${match[4]} expected ${count} OAM tiles, found ${tiles.length}`);
    oamSets[match[4].toUpperCase()] = tiles;
  }
  return oamSets;
}

function parsePalettes() {
  const source = read('gfx/battle_anims/battle_anims.pal');
  const palettes = {};
  const pattern = /^;\s*([a-z]+)\s*$\n((?:\s*RGB\s+\d+,\s*\d+,\s*\d+\s*\n){4})/gm;
  for (const match of source.matchAll(pattern)) {
    const colors = [...match[2].matchAll(/RGB\s+(\d+),\s*(\d+),\s*(\d+)/g)].map((rgb) => {
      const [r, g, b] = rgb.slice(1).map((value) => Number(value) << 3);
      return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    });
    palettes[match[1]] = [null, ...colors.slice(1)];
  }
  const expected = ['gray', 'yellow', 'red', 'green', 'blue', 'brown'];
  const missing = expected.filter((name) => !palettes[name]);
  if (missing.length) throw new Error(`Missing battle animation palettes: ${missing.join(', ')}`);
  return palettes;
}

function validateReferences({ scripts, objects, framesets, oamSets }) {
  for (const [scriptName, script] of Object.entries(scripts)) {
    for (const command of script.commands) {
      if (command.op === 'anim_obj' && !objects[command.object]) {
        throw new Error(`${scriptName} references missing object ${command.object}`);
      }
      if (command.op === 'anim_call' && !scripts[command.target]) {
        throw new Error(`${scriptName} calls missing script ${command.target}`);
      }
    }
  }
  for (const [name, object] of Object.entries(objects)) {
    if (!framesets[object.frameset]) throw new Error(`${name} references missing frameset ${object.frameset}`);
  }
  for (const [name, frameset] of Object.entries(framesets)) {
    for (const step of frameset.steps) {
      if (step.oam && !oamSets[step.oam]) throw new Error(`${name} references missing OAM set ${step.oam}`);
    }
  }
}

function copyAssets(objects) {
  mkdirSync(assetDir, { recursive: true });
  const names = [...new Set(Object.values(objects).map(({ gfx }) => gfx))].sort();
  for (const name of names) {
    const source = join(sourceRoot, 'gfx/battle_anims', `${name}.png`);
    copyFileSync(source, join(assetDir, basename(source)));
  }
  return names;
}

const sourceCommit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const moveData = parseMoveScripts();
const objects = parseObjects(moveData.requiredObjects);
const framesets = parseFramesets();
const oamSets = parseOamSets();
const palettes = parsePalettes();
validateReferences({ scripts: moveData.scripts, objects, framesets, oamSets });
const assets = copyAssets(objects);
const callbacks = [...new Set(Object.values(objects).map(({ callback }) => callback))].sort();

const generated = [
  '// AI-GENERATED: scripts/generate-pokegold-anim-data.mjs로 생성. 직접 수정하지 않는다.',
  `// Source: https://github.com/pret/pokegold/tree/${sourceCommit}`,
  `export const POKEGOLD_SOURCE = Object.freeze(${json({ commit: sourceCommit, moves: 24, assets, callbacks, backgrounds: [...moveData.requiredBackgrounds].sort() })});`,
  `export const POKEGOLD_MOVES = Object.freeze(${json(moveData.moves)});`,
  `export const POKEGOLD_SCRIPTS = Object.freeze(${json(moveData.scripts)});`,
  `export const POKEGOLD_OBJECTS = Object.freeze(${json(objects)});`,
  `export const POKEGOLD_FRAMESETS = Object.freeze(${json(framesets)});`,
  `export const POKEGOLD_OAM_SETS = Object.freeze(${json(oamSets)});`,
  `export const POKEGOLD_PALETTES = Object.freeze(${json(palettes)});`,
  '',
].join('\n');

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, generated);
console.log(`Generated ${outputFile} from pret/pokegold ${sourceCommit}`);
console.log(`Validated 24 moves, ${Object.keys(moveData.scripts).length} scripts, ${Object.keys(objects).length} objects, ${callbacks.length} callbacks`);
