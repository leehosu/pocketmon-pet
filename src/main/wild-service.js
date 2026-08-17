// AI-GENERATED: PokéAPI 야생 포켓몬 메타데이터와 투명 스프라이트를 원자적으로 캐시한다.
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cryUrl,
  pokemonSpeciesUrl,
  pokemonUrl,
  spriteUrl,
} from '../core/pokeapi.js';
import { goldSilverLevelMoveIds } from '../core/wild-catalog.js';

function atomicWrite(file, data) {
  const temp = `${file}.download`;
  writeFileSync(temp, data);
  renameSync(temp, file);
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`PokéAPI ${response.status}`);
  return response.json();
}

async function ensureAsset(url, file, fetchImpl) {
  if (existsSync(file)) return;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Asset ${response.status}`);
  try {
    atomicWrite(file, Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    try { unlinkSync(`${file}.download`); } catch { /* ignore */ }
    throw error;
  }
}

function dataUrl(file, mime) {
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

export async function prepareWildPokemon({
  cacheDir,
  speciesId,
  level,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
  const dir = join(cacheDir, 'wild');
  mkdirSync(dir, { recursive: true });
  const metadataFile = join(dir, `${speciesId}_${level}.json`);
  const spriteFile = join(dir, `${speciesId}.png`);
  const cryFile = join(dir, `${speciesId}.ogg`);

  let metadata = null;
  if (existsSync(metadataFile)) {
    try { metadata = JSON.parse(readFileSync(metadataFile, 'utf8')); } catch { /* refetch */ }
  }
  if (!metadata?.name || !Array.isArray(metadata.moveIds)) {
    const [pokemon, species] = await Promise.all([
      fetchJson(pokemonUrl(speciesId), fetchImpl),
      fetchJson(pokemonSpeciesUrl(speciesId), fetchImpl),
    ]);
    const korean = (species.names || []).find((entry) => entry.language?.name === 'ko');
    metadata = {
      speciesId,
      level,
      name: korean?.name || pokemon.name || `No.${speciesId}`,
      moveIds: goldSilverLevelMoveIds(pokemon, level),
      source: 'pokeapi:gold',
    };
    atomicWrite(metadataFile, JSON.stringify(metadata));
  }

  await ensureAsset(spriteUrl(speciesId), spriteFile, fetchImpl);
  try { await ensureAsset(cryUrl(speciesId), cryFile, fetchImpl); } catch { /* 울음소리는 선택 사항 */ }
  return {
    ...metadata,
    sprite: dataUrl(spriteFile, 'image/png'),
    cry: existsSync(cryFile) ? dataUrl(cryFile, 'audio/ogg') : null,
  };
}
