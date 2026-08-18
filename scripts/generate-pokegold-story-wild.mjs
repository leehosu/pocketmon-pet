// AI-GENERATED: pret/pokegold의 Gold 전용 초기 성도 출현표를 앱 정적 카탈로그로 변환한다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.argv[2] || '/tmp/pokegold');
const wildSource = readFileSync(join(sourceRoot, 'data/wild/johto_grass.asm'), 'utf8');
const constantsSource = readFileSync(join(sourceRoot, 'constants/pokemon_constants.asm'), 'utf8');
const outputPath = join(repoRoot, 'src/core/data/gold-story-wild.generated.js');
const slotWeights = [30, 30, 20, 10, 5, 4, 1];
const zoneMaps = {
  violet: ['ROUTE_29', 'ROUTE_30', 'ROUTE_31', 'SPROUT_TOWER_2F', 'SPROUT_TOWER_3F'],
  azalea: ['ROUTE_32', 'UNION_CAVE_1F', 'SLOWPOKE_WELL_B1F'],
};

const speciesIds = new Map();
for (const match of constantsSource.matchAll(/^\s*const\s+([A-Z0-9_]+)\s*;\s*([0-9a-f]{2})\b/gim)) {
  speciesIds.set(match[1], Number.parseInt(match[2], 16));
}

function parseMap(mapId) {
  const start = wildSource.indexOf(`def_grass_wildmons ${mapId}`);
  const end = wildSource.indexOf('end_grass_wildmons', start);
  if (start < 0 || end < 0) throw new Error(`출현표를 찾을 수 없습니다: ${mapId}`);
  const lines = wildSource.slice(start, end).split(/\r?\n/);
  const rate = Number(lines.find((line) => /percent/.test(line))?.match(/db\s+(\d+)\s+percent/)?.[1]);
  const periods = { morn: [], day: [], nite: [] };
  let period = null;
  let enabled = true;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'IF DEF(_GOLD)') { enabled = true; continue; }
    if (line === 'ELIF DEF(_SILVER)') { enabled = false; continue; }
    if (line === 'ENDC') { enabled = true; continue; }
    const periodMatch = line.match(/^;\s*(morn|day|nite)$/);
    if (periodMatch && enabled) { period = periodMatch[1]; continue; }
    const slot = line.match(/^db\s+(\d+)\s*,\s*([A-Z0-9_]+)$/);
    if (!enabled || !period || !slot || periods[period].length >= 7) continue;
    const speciesId = speciesIds.get(slot[2]);
    if (!speciesId) throw new Error(`도감 번호를 찾을 수 없습니다: ${slot[2]}`);
    periods[period].push({ speciesId, level: Number(slot[1]), weight: slotWeights[periods[period].length] });
  }
  if (!rate || Object.values(periods).some((slots) => slots.length !== 7)) {
    throw new Error(`불완전한 출현표입니다: ${mapId}`);
  }
  return { id: mapId, rate, periods };
}

const zones = Object.fromEntries(Object.entries(zoneMaps).map(([zone, maps]) => (
  [zone, maps.map(parseMap)]
)));
const output = '// AI-GENERATED: pret/pokegold Gold 출현표에서 생성. 직접 수정하지 않는다.\n'
  + 'function deepFreeze(value) {\n'
  + '  Object.values(value).forEach((entry) => { if (entry && typeof entry === \'object\') deepFreeze(entry); });\n'
  + '  return Object.freeze(value);\n'
  + '}\n\n'
  + `export const GOLD_STORY_WILD_ZONES = deepFreeze(${JSON.stringify(zones, null, 2)});\n`;
writeFileSync(outputPath, output);
console.log(`Generated ${outputPath}`);
