// AI-GENERATED: pret/pokecrystal의 전투 데이터를 런타임용 정적 JS로 변환한다.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.argv[2] || '/tmp/pokecrystal');
const outputFile = join(repoRoot, 'src/core/data/gen2-data.generated.js');

const TYPE_NAMES = {
  NORMAL: 'normal', FIGHTING: 'fighting', FLYING: 'flying', POISON: 'poison',
  GROUND: 'ground', ROCK: 'rock', BUG: 'bug', GHOST: 'ghost', STEEL: 'steel',
  FIRE: 'fire', WATER: 'water', GRASS: 'grass', ELECTRIC: 'electric',
  PSYCHIC_TYPE: 'psychic', ICE: 'ice', DRAGON: 'dragon', DARK: 'dark',
};

function read(relativePath) {
  return readFileSync(join(sourceRoot, relativePath), 'utf8');
}

function bytePercent(value) {
  return Math.floor((Number(value) * 0xff) / 100);
}

function parseSpecies() {
  const dir = join(sourceRoot, 'data/pokemon/base_stats');
  const species = {};
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.asm')).sort()) {
    const source = readFileSync(join(dir, file), 'utf8');
    const header = source.match(/^\s*db\s+([A-Z0-9_]+)\s*;\s*(\d+)/m);
    const stats = source.match(/^\s*db\s+(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/m);
    const types = source.match(/^\s*db\s+([A-Z_]+)\s*,\s*([A-Z_]+)\s*;\s*type/m);
    const baseExp = source.match(/^\s*db\s+(\d+)\s*;\s*base exp/m);
    if (!header || !stats || !types || !baseExp) {
      throw new Error(`Unsupported base stat file: ${file}`);
    }
    const id = Number(header[2]);
    species[id] = {
      id,
      constant: header[1],
      stats: {
        hp: Number(stats[1]), attack: Number(stats[2]), defense: Number(stats[3]),
        speed: Number(stats[4]), specialAttack: Number(stats[5]), specialDefense: Number(stats[6]),
      },
      types: [...new Set([TYPE_NAMES[types[1]], TYPE_NAMES[types[2]]])],
      baseExp: Number(baseExp[1]),
    };
  }
  return species;
}

function parseMoves() {
  const source = read('data/moves/moves.asm');
  const moves = {};
  const movePattern = /^\s*move\s+([A-Z0-9_]+)\s*,\s*(EFFECT_[A-Z0-9_]+)\s*,\s*(\d+)\s*,\s*([A-Z0-9_]+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gm;
  let match;
  let id = 0;
  while ((match = movePattern.exec(source))) {
    id += 1;
    moves[id] = {
      id,
      constant: match[1],
      effect: match[2],
      power: Number(match[3]),
      type: TYPE_NAMES[match[4]],
      accuracyPercent: Number(match[5]),
      accuracyByte: bytePercent(match[5]),
      pp: Number(match[6]),
      effectChancePercent: Number(match[7]),
      effectChanceByte: bytePercent(match[7]),
    };
  }
  if (id !== 251) throw new Error(`Expected 251 moves, found ${id}`);

  const idByConstant = Object.fromEntries(Object.values(moves).map((move) => [move.constant, move.id]));
  const criticalSource = read('data/moves/critical_hit_moves.asm');
  const highCriticalMoveIds = [...criticalSource.matchAll(/^\s*db\s+([A-Z0-9_]+)$/gm)]
    .map((entry) => idByConstant[entry[1]])
    .filter(Boolean);
  return { moves, highCriticalMoveIds };
}

function parseTypeChart() {
  const source = read('data/types/type_matchups.asm');
  const chart = {};
  const pattern = /^\s*db\s+([A-Z_]+)\s*,\s*([A-Z_]+)\s*,\s*(NO_EFFECT|NOT_VERY_EFFECTIVE|SUPER_EFFECTIVE)$/gm;
  const factors = { NO_EFFECT: 0, NOT_VERY_EFFECTIVE: 0.5, SUPER_EFFECTIVE: 2 };
  for (const match of source.matchAll(pattern)) {
    const attack = TYPE_NAMES[match[1]];
    const defense = TYPE_NAMES[match[2]];
    if (!attack || !defense) throw new Error(`Unknown type matchup: ${match[0]}`);
    chart[`${attack}:${defense}`] = factors[match[3]];
  }
  return chart;
}

const sourceCommit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const species = parseSpecies();
const { moves, highCriticalMoveIds } = parseMoves();
const typeChart = parseTypeChart();
const generated = [
  '// AI-GENERATED: scripts/generate-gen2-data.mjs로 생성. 직접 수정하지 않는다.',
  `// Source: pret/pokecrystal ${sourceCommit}`,
  `export const GEN2_SPECIES = Object.freeze(${JSON.stringify(species, null, 2)});`,
  `export const GEN2_MOVES = Object.freeze(${JSON.stringify(moves, null, 2)});`,
  `export const GEN2_HIGH_CRITICAL_MOVE_IDS = Object.freeze(${JSON.stringify(highCriticalMoveIds)});`,
  `export const GEN2_TYPE_CHART = Object.freeze(${JSON.stringify(typeChart, null, 2)});`,
  '',
].join('\n');

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, generated);
console.log(`Generated ${outputFile}`);
