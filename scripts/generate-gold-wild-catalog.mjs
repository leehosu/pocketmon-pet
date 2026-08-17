// AI-GENERATED: PokéAPI의 Gold 버전 encounter 데이터를 정적 카탈로그로 만든다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputFile = join(repoRoot, 'src/core/data/gold-wild.generated.js');
const excluded = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251]);

async function fetchJson(url, attempts = 3) {
  let error;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'pocketmon-pet-data-generator' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (caught) {
      error = caught;
      await new Promise((resolveWait) => setTimeout(resolveWait, 250 * (attempt + 1)));
    }
  }
  throw error;
}

async function loadOne(id) {
  if (excluded.has(id)) return null;
  const areas = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${id}/encounters`);
  const levels = [];
  for (const area of areas) {
    for (const version of area.version_details || []) {
      if (version.version?.name !== 'gold') continue;
      for (const detail of version.encounter_details || []) {
        levels.push(detail.min_level, detail.max_level);
      }
    }
  }
  if (!levels.length) return null;
  return { id, minLevel: Math.min(...levels), maxLevel: Math.max(...levels) };
}

const ids = Array.from({ length: 251 }, (_, index) => index + 1);
const catalog = [];
const concurrency = 12;
for (let offset = 0; offset < ids.length; offset += concurrency) {
  const batch = ids.slice(offset, offset + concurrency);
  const rows = await Promise.all(batch.map(loadOne));
  catalog.push(...rows.filter(Boolean));
}

const generated = [
  '// AI-GENERATED: scripts/generate-gold-wild-catalog.mjs로 PokéAPI에서 생성. 직접 수정하지 않는다.',
  '// Source: https://pokeapi.co/api/v2/pokemon/{id}/encounters (version=gold)',
  `export const GOLD_WILD_CATALOG = Object.freeze(${JSON.stringify(catalog, null, 2)});`,
  '',
].join('\n');
mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, generated);
console.log(`Generated ${catalog.length} Gold encounter species in ${outputFile}`);
