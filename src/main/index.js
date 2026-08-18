import { app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  existsSync, statSync, openSync, readSync, closeSync, readdirSync, readFileSync,
  writeFileSync, mkdirSync, createWriteStream, renameSync, unlinkSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import https from 'node:https';

import { dataDir, EVENTS_FILE } from '../core/paths.js';
import { compactEventsFile } from '../core/events-log.js';
import { loadState, saveState, rollStarter } from '../core/store.js';
import { getSpeciesByKey, canEvolve } from '../core/roster.js';
import { parseSessionLines, parseCodexLines, sessionScanFloor } from '../core/session-parser.js';
import { tick } from './orchestrator.js';
import { SPRITE_DIR, parseSpriteFileName } from '../core/sprite-files.js';
import {
  dexLine, spriteUrl, backSpriteUrl, cryUrl, pokemonUrl, moveUrl, moveValueForVersion,
} from '../core/pokeapi.js';
import {
  GEN2_EFFECTS, gen2BattleEffectForMove, gen2SkillsForStage,
} from '../core/gsc-moves.js';
import {
  BATTLE_ACTION_MS, BATTLE_DETAIL_MS, battleEventSchedule, battleTimelineDuration,
} from '../core/battle-timeline.js';
import { applyBattleExperience, localDateKey } from '../core/xp-engine.js';
import {
  createBattleProfile,
  ensureBattleProfile,
  recordBattleLoss,
  recordBattleVictory,
  wildBattleExperience,
} from '../core/gen2-profile.js';
import { createGen2Battle, resolveGen2Turn } from '../core/gen2-battle.js';
import {
  canScheduleEncounter,
  nextEncounterDelayMs,
  wildAppearanceDurationMs,
} from '../core/encounter-scheduler.js';
import { chooseWildEncounter } from '../core/wild-catalog.js';
import { prepareWildPokemon } from './wild-service.js';
import { battleWindowBounds } from '../core/battle-window-bounds.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TICK_MS = 4000;
const WINDOW_SIZE = 96; // 스프라이트 캔버스(가로=세로)
// 호버 시 뜨는 XP 바·상태 텍스트를 포켓몬 아래에 두기 위한 여유 높이.
// 창은 투명이라 평상시엔 빈 공간이 보이지 않는다.
const HUD_HEIGHT = 28;
const WINDOW_HEIGHT = WINDOW_SIZE + HUD_HEIGHT;
// 더블클릭 상세 패널(상태 + 기술 버튼)을 담기 위해 창을 잠깐 확장할 크기(닫으면 WINDOW_SIZE로 원복).
const DETAIL_WIDTH = 210;
const DETAIL_HEIGHT = 320;
// 기술 이펙트 오버레이 자동 종료 시간.
const EFFECT_DURATION_MS = 2800;
const POKEGOLD_EFFECT_DURATION_MS = 4300;
const RESULT_HOLD_MS = 3000;
const WILD_WINDOW_WIDTH = 180;
const WILD_WINDOW_HEIGHT = 190;
// AI-GENERATED: 작업 화면을 가리지 않는 단일 플로팅 배틀 스테이지 크기.
const BATTLE_WINDOW_WIDTH = 600;
const BATTLE_WINDOW_HEIGHT = 460;
const EFFECT_TYPES = [
  'leaf', 'leaf_swirl',
  'fire', 'fire_breath',
  'water', 'water_bubbles',
  'electric', 'electric_bolts',
  'hatch',  // 부화 연출(화면 전체)
  'evolve', // 진화 연출(화면 전체)
  'fire_kanji', // 불대문자: 큰 대(大) 글자를 불로 (公용 한자 + 오리지널 애니)
  // 개념 기반 오리지널 스타일(타입 색으로 tint) — 기술마다 달라 보이게
  'grass_beam', 'fire_beam', 'water_beam', 'electric_beam',
  'grass_impact', 'fire_impact', 'water_impact', 'electric_impact',
  ...GEN2_EFFECTS,
];
const SPECIES_KEYS = ['grass', 'fire', 'water', 'electric'];
const DRIFT_STEP_BUSY = 6; // 프롬프트 처리중(달리기) — 크게 움직임
const DRIFT_STEP_IDLE = 1; // 평상시 — 가끔 조금만 움직임
const IDLE_MOVE_CHANCE = 0.15;
// 첫 실행 시 과거 세션 로그를 소급해 XP로 주지 않는다(0 = 앱을 켠 이후 활동만 인정).
// 알을 "키우는" 연출이 성립하려면 설치 순간 XP가 들어오면 안 된다 — 소급이 살아 있으면
// 부화 문턱(XP_RULES.hatchXp)을 아무리 올려도 하루치가 통째로 들어와 그냥 넘어간다.
const FIRST_RUN_SESSION_WINDOW_MS = 0;
// 앱을 켠 시각 기준으로 한 번만 계산한다(매 tick 재계산하면 floor가 현재로 계속 밀려
// 어떤 이벤트도 잡히지 않는다 — sessionScanFloor 주석 참고).
const FIRST_RUN_FLOOR = Date.now() - FIRST_RUN_SESSION_WINDOW_MS;
const OFFSET_FILE = 'offset';

// 16x16 포켓볼 스타일 트레이 아이콘(외부 에셋 없이 인라인 PNG로 제공).
const TRAY_ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAS0lEQVR4nGNgoDYQERH5jw8TrfmZjQ0KJmgILo24' +
  'DCJLM05DCPmbYHhQxYCvX7+ShAehAaQYgjMQyTaAFEOISo3YDCIrP5CcmcgBACPIn+yKwOQDAAAAAElFTkSuQmCC';

// 수동 드래그와 자동 드리프트가 창을 동시에 잡아당겨 싸우지 않도록,
// 마지막 수동 이동 후 이 시간 동안은 auto-drift를 건너뛴다.
const MANUAL_MOVE_COOLDOWN_MS = 1500;

let mainWindow = null;
let effectWin = null;
let wildWindow = null;
let battleWindow = null;
let tray = null;
let intervalId = null;
let driftDir = 1;
let state = null;
let lastManualMoveAt = 0;
let lastCrySig = null; // 렌더러에 마지막으로 보낸 울음소리(종_단계) 시그니처
let lastMovesSig = null; // 렌더러에 마지막으로 보낸 기술목록(종) 시그니처
let nextEncounterAt = 0;
let currentEncounter = null;
let currentBattle = null;
let encounterPreparing = false;
let encounterExpiryTimer = null;
let battleTurnTimer = null;
let battleEffectTimers = [];
const pendingSpriteLines = new Set();

// ---- readEvents(): hook이 append하는 서명된 events.jsonl을 증분 읽기 + 검증 ----
// 서명(sig)이 없거나 위조된 이벤트는 조용히 버린다(치팅 방지) — 앱이 XP의 유일한 권위.
// 오프셋은 별도 파일(~/.pocketmon/offset)에 영속한다 — in-memory면 재시작마다
// events.jsonl 전체를 재replay해 stale busy가 되살아나고 파일이 무한 성장한다.
let eventsOffset = 0;

function offsetPath() { return join(dataDir(), OFFSET_FILE); }

function loadOffset() {
  const file = offsetPath();
  if (!existsSync(file)) return 0;
  try {
    const n = parseInt(readFileSync(file, 'utf8').trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}

function saveOffset(n) {
  try {
    mkdirSync(dataDir(), { recursive: true });
    writeFileSync(offsetPath(), String(n));
  } catch { /* 오프셋 영속 실패는 다음 tick에 재시도 — 치명적 아님 */ }
}

function compactEvents(file) {
  const next = compactEventsFile(file, eventsOffset);
  if (next === eventsOffset) return;
  eventsOffset = next;
  saveOffset(next);
}

function readEvents() {
  const file = join(dataDir(), EVENTS_FILE);
  if (!existsSync(file)) return [];
  let stat;
  try { stat = statSync(file); } catch { return []; }
  if (stat.size < eventsOffset) { eventsOffset = 0; saveOffset(0); } // 회전/축소 → 처음부터
  if (stat.size <= eventsOffset) return [];

  const length = stat.size - eventsOffset;
  const buf = Buffer.alloc(length);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, buf, 0, length, eventsOffset);
  } finally {
    closeSync(fd);
  }
  const chunk = buf.toString('utf8');
  const lastNewline = chunk.lastIndexOf('\n');
  if (lastNewline === -1) return []; // 아직 완결된 줄이 없음 — 다음 tick에 재시도
  const complete = chunk.slice(0, lastNewline);
  eventsOffset += Buffer.byteLength(chunk.slice(0, lastNewline + 1), 'utf8');
  saveOffset(eventsOffset); // 소비한 라인 지점을 영속 → 재시작 후엔 새 이벤트만 읽는다

  const out = [];
  for (const line of complete.split('\n')) {
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (!obj || typeof obj !== 'object') continue;
    const { id, kind, ts } = obj;
    if (!id || !kind) continue; // 필수 필드 없으면 스킵(개인용 — 서명 검증 없음)
    out.push({ id, kind, ts });
  }
  compactEvents(file); // 소비분이 쌓였으면 앞부분을 잘라 파일 무한 증가를 막는다
  return out;
}

// ---- readSessionEvents(sinceTs): Claude Code 자신의 세션 로그(권위 소스, 서명 불요) ----
function listJsonlFilesRecursive(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJsonlFilesRecursive(full));
    else if (ent.isFile() && ent.name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

// 한 로그 루트를 재귀 스캔해 (parser로) 토큰 이벤트를 뽑는다. floor 이전 파일은 mtime으로 건너뜀.
function scanSessionRoot(root, floor, parser) {
  if (!existsSync(root)) return [];
  const events = [];
  for (const file of listJsonlFilesRecursive(root)) {
    let st;
    try { st = statSync(file); } catch { continue; }
    if (st.mtimeMs < floor) continue; // 이 파일에 floor 이후 새 내용이 없음
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    events.push(...parser(content.split('\n'), floor));
  }
  return events;
}

// 권위 토큰 소스: Claude Code(~/.claude/projects) + Codex(~/.codex/sessions) 세션 로그.
// 두 소스의 ts는 모두 ISO(Date.parse)라 lastSessionTs 커서·일일 상한을 그대로 공유한다.
function readSessionEvents(sinceTs) {
  const floor = sessionScanFloor(sinceTs, FIRST_RUN_FLOOR);
  return [
    ...scanSessionRoot(join(homedir(), '.claude', 'projects'), floor, parseSessionLines),
    ...scanSessionRoot(join(homedir(), '.codex', 'sessions'), floor, parseCodexLines),
  ];
}

// ---- 창 드리프트: busy(달리기)면 크게, idle이면 가끔 조금 이동, 화면 경계에서 반전 ----
function driftWindow(activity) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // 사용자가 방금 수동으로 창을 옮겼다면 잠깐 자동 이동을 멈춘다(충돌 방지).
  if (Date.now() - lastManualMoveAt < MANUAL_MOVE_COOLDOWN_MS) return;
  let step = 0;
  if (activity.busy) step = DRIFT_STEP_BUSY;
  else if (Math.random() < IDLE_MOVE_CHANCE) step = DRIFT_STEP_IDLE;
  if (step === 0) return;

  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const { x: areaX, y: areaY, width: areaW, height: areaH } = display.workArea;
  const bounds = mainWindow.getBounds();
  const minX = areaX;
  const maxX = areaX + areaW - bounds.width;
  const minY = areaY;
  const maxY = areaY + areaH - bounds.height;

  let nextX = bounds.x + step * driftDir;
  if (nextX <= minX) { nextX = minX; driftDir = 1; }
  else if (nextX >= maxX) { nextX = maxX; driftDir = -1; }
  const nextY = Math.min(Math.max(bounds.y, minY), maxY);

  mainWindow.setBounds({ x: nextX, y: nextY, width: bounds.width, height: bounds.height });
}

// ---- 다운로드 스프라이트: 앱 전용 캐시 폴더(~/.pocketmon/dex/)의 PNG → data URL 맵 ----
// 사용자가 임의 PNG를 넣어 교체하는 커스텀 기능은 없다. 앱이 PokéAPI에서 받아
// 이 폴더에 저장한 <species>_<stage>.png 만 로드한다.
// 폴더 전체를 매 tick 재전송하면 대용량 IPC가 되므로, 파일목록+mtime+size로
// 만든 시그니처가 바뀔 때만(=최초 1회 포함, 다운로드 완료 반영 포함) 재로드해 payload에 싣는다.
let customSpritesSignature = null;

// 기술 이펙트: 투명·클릭통과 오버레이 창에서 재생한다.
// 일반 기술은 디스플레이 전체, 배틀 기술은 컴팩트 배틀 창 영역만 사용한다.
function playSkillEffect(effect, opts, targetBounds) {
  if (!EFFECT_TYPES.includes(effect)) return;
  // 이전 이펙트가 남아 있으면 먼저 정리(중첩 방지).
  if (effectWin && !effectWin.isDestroyed()) { effectWin.close(); }
  effectWin = null;

  const disp = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const b = targetBounds || disp.bounds;

  const win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, backgroundColor: '#00000000', frame: false, hasShadow: false,
    resizable: false, movable: false, minimizable: false, maximizable: false,
    focusable: false, skipTaskbar: true, enableLargerThanScreen: true,
    webPreferences: { contextIsolation: true },
  });
  effectWin = win;
  win.setBackgroundColor('#00000000');
  win.setIgnoreMouseEvents(true, { forward: true }); // 클릭이 데스크톱으로 통과
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(join(__dirname, '../renderer/effect-overlay.html'), { query: { effect, ...(opts || {}) } });

  const duration = effect.startsWith('gsc_') ? POKEGOLD_EFFECT_DURATION_MS : EFFECT_DURATION_MS;
  setTimeout(() => {
    if (win && !win.isDestroyed()) win.close();
    if (effectWin === win) effectWin = null;
  }, duration);
}

function spritesDirPath() { return join(dataDir(), SPRITE_DIR); }

// 스프라이트 PNG를 data URL로 읽음(없으면 null). 진화 연출에 이전/다음 폼 이미지를 넘길 때 사용.
function spriteDataUrl(species, stage) {
  try {
    const p = join(spritesDirPath(), `${species}_${stage}.png`);
    if (!existsSync(p)) return null;
    return 'data:image/png;base64,' + readFileSync(p).toString('base64');
  } catch { return null; }
}

function backSpriteDataUrl(species, stage) {
  try {
    const p = join(spritesDirPath(), `${species}_${stage}_back.png`);
    if (!existsSync(p)) return null;
    return 'data:image/png;base64,' + readFileSync(p).toString('base64');
  } catch { return null; }
}

// 공개 URL을 파일로 다운로드(리다이렉트 추적, tmp→rename). 실패는 콜백으로 전달.
function downloadTo(url, dest, cb, redirects) {
  redirects = redirects || 0;
  const req = https.get(url, (res) => {
    const code = res.statusCode;
    if ([301, 302, 307, 308].includes(code) && res.headers.location && redirects < 5) {
      res.resume();
      downloadTo(res.headers.location, dest, cb, redirects + 1);
      return;
    }
    if (code !== 200) { res.resume(); cb(new Error('HTTP ' + code)); return; }
    const tmp = dest + '.download';
    const ws = createWriteStream(tmp);
    res.pipe(ws);
    ws.on('finish', () => ws.close(() => {
      try { renameSync(tmp, dest); } catch (e) { cb(e); return; }
      cb(null);
    }));
    ws.on('error', (e) => { try { unlinkSync(tmp); } catch { /* ignore */ } cb(e); });
  });
  req.on('error', cb);
  req.setTimeout(10000, () => req.destroy(new Error('timeout')));
}

// 현재 종의 진화 라인 골드판 정면·후면 스프라이트를 공개 PokéAPI에서 런타임 다운로드해
// ~/.pocketmon/dex/에 캐시(앱에 번들하지 않음). 이미 있으면 건너뛴다.
// 실패/오프라인은 조용히 무시 — 기존 코드 도트로 폴백. 다운로드 성공 시 다음 tick의
// 스프라이트 폴더 서명 갱신이 자동으로 렌더러에 반영한다.
function fetchSpeciesSprites(key) {
  const line = dexLine(key);
  if (!line.length || pendingSpriteLines.has(key)) return;
  const dir = spritesDirPath();
  const cdir = criesDirPath();
  try { mkdirSync(dir, { recursive: true }); mkdirSync(cdir, { recursive: true }); } catch { return; }
  const marker = join(dir, `.pokeapi-gold-${key}-v2`);
  const refreshGoldSprites = !existsSync(marker);
  let pending = 0;
  let failed = false;
  pendingSpriteLines.add(key);
  const done = (error) => {
    failed ||= Boolean(error);
    pending -= 1;
    if (pending > 0) return;
    if (!failed) {
      try { writeFileSync(marker, 'PokeAPI generation-ii/gold'); } catch { /* 다음 실행에 재시도 */ }
    }
    pendingSpriteLines.delete(key);
  };
  line.forEach((dexId, stage) => {
    const png = join(dir, `${key}_${stage}.png`);
    if (refreshGoldSprites || !existsSync(png)) {
      pending += 1;
      downloadTo(spriteUrl(dexId), png, done);
    }
    const backPng = join(dir, `${key}_${stage}_back.png`);
    if (refreshGoldSprites || !existsSync(backPng)) {
      pending += 1;
      downloadTo(backSpriteUrl(dexId), backPng, done);
    }
    // 울음소리(.ogg)도 같은 방식으로 런타임 캐시.
    const ogg = join(cdir, `${key}_${stage}.ogg`);
    if (!existsSync(ogg)) downloadTo(cryUrl(dexId), ogg, () => {});
  });
  if (pending === 0) pendingSpriteLines.delete(key);
}

function criesDirPath() { return join(dataDir(), 'cries'); }
function movesDirPath() { return join(dataDir(), 'moves'); }

const prettify = (slug) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function gen2DisplayMoves(species, stage = 0) {
  return gen2SkillsForStage(species, stage).map(({ slug, name, effect }) => ({
    slug, name, effect, source: 'builtin',
  }));
}

function usesOnlyGen2Effects(moves) {
  return Array.isArray(moves) && moves.length > 0 && moves.every((m) => GEN2_EFFECTS.has(m.effect));
}

function sameMoves(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length
    && a.every((m, i) => m.slug === b[i].slug && m.name === b[i].name && m.effect === b[i].effect);
}

const GEN2_PHYSICAL_TYPES = new Set(['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel']);

function goldSilverDamageClass(type, currentDamageClass) {
  if (currentDamageClass === 'status') return 'status';
  return GEN2_PHYSICAL_TYPES.has(type) ? 'physical' : 'special';
}

function hasGoldSilverMetadata(moves) {
  return Array.isArray(moves) && moves.every((move) => (
    move.source === 'pokeapi:gold-silver'
    && move.meta
    && move.meta.schema === 2
    && move.meta.type
    && move.meta.learnMethod
  ));
}

// PokéAPI의 gold-silver 버전 그룹에서 습득 가능 여부와 기술 메타데이터를 확인해 캐시한다.
async function fetchMoves(species, stage) {
  let file = null;
  let expected = [];
  try {
    const line = dexLine(species);
    if (!line.length || line[stage] == null) return;
    file = join(movesDirPath(), `${species}_${stage}.json`);
    expected = gen2DisplayMoves(species, stage);
    if (existsSync(file)) {
      try {
        const cached = JSON.parse(readFileSync(file, 'utf8'));
        if (usesOnlyGen2Effects(cached) && sameMoves(cached, expected) && hasGoldSilverMetadata(cached)) return;
      } catch { /* 오래되거나 손상된 캐시는 API 데이터로 갱신 */ }
    }
    const pokemonResponse = await fetch(pokemonUrl(line[stage]));
    if (!pokemonResponse.ok) throw new Error(`PokéAPI pokemon ${pokemonResponse.status}`);
    const pk = await pokemonResponse.json();
    const out = await Promise.all(expected.map(async (move) => {
      const learned = (pk.moves || []).find((entry) => entry.move.name === move.slug);
      const details = (learned?.version_group_details || [])
        .filter((entry) => entry.version_group.name === 'gold-silver');
      if (!details.length) throw new Error(`${move.slug} is not learnable in gold-silver`);
      const moveResponse = await fetch(moveUrl(move.slug));
      if (!moveResponse.ok) throw new Error(`PokéAPI move ${moveResponse.status}`);
      const mv = await moveResponse.json();
      const ko = (mv.names || []).find((entry) => entry.language?.name === 'ko');
      const type = moveValueForVersion(mv, 'type')?.name || mv.type?.name || null;
      const flavor = (mv.flavor_text_entries || []).find((entry) => (
        entry.version_group?.name === 'gold-silver' && entry.language?.name === 'en'
      ));
      const effectEntry = (mv.effect_entries || []).find((entry) => entry.language?.name === 'en');
      const machine = (mv.machines || []).find((entry) => entry.version_group?.name === 'gold-silver');
      const learnMethods = details.map((entry) => ({
        method: entry.move_learn_method.name,
        level: entry.level_learned_at,
      }));
      return {
        ...move,
        name: ko?.name || move.name || prettify(move.slug),
        source: 'pokeapi:gold-silver',
        meta: {
          schema: 2,
          id: mv.id,
          type,
          damageClass: goldSilverDamageClass(type, mv.damage_class?.name),
          currentDamageClass: mv.damage_class?.name || null,
          power: moveValueForVersion(mv, 'power'),
          accuracy: moveValueForVersion(mv, 'accuracy'),
          pp: moveValueForVersion(mv, 'pp'),
          priority: mv.priority,
          target: mv.target?.name || null,
          generation: mv.generation?.name || null,
          learnMethod: learnMethods[0].method,
          levelLearnedAt: learnMethods[0].level,
          learnMethods,
          machineUrl: machine?.machine?.url || null,
          ailment: mv.meta?.ailment?.name || 'none',
          category: mv.meta?.category?.name || null,
          effectChance: moveValueForVersion(mv, 'effect_chance'),
          ailmentChance: mv.meta?.ailment_chance ?? 0,
          flinchChance: mv.meta?.flinch_chance ?? 0,
          statChance: mv.meta?.stat_chance ?? 0,
          criticalRate: mv.meta?.crit_rate ?? 0,
          drain: mv.meta?.drain ?? 0,
          healing: mv.meta?.healing ?? 0,
          minHits: mv.meta?.min_hits ?? null,
          maxHits: mv.meta?.max_hits ?? null,
          minTurns: mv.meta?.min_turns ?? null,
          maxTurns: mv.meta?.max_turns ?? null,
          statChanges: (mv.stat_changes || []).map((entry) => ({
            stat: entry.stat.name,
            change: entry.change,
          })),
          goldSilverFlavorText: flavor?.flavor_text?.replace(/\s+/g, ' ').trim() || null,
          shortEffect: effectEntry?.short_effect?.replace(/\$effect_chance/g, String(moveValueForVersion(mv, 'effect_chance') ?? '')) || null,
        },
      };
    }));
    if (out.length === expected.length) {
      mkdirSync(movesDirPath(), { recursive: true });
      writeFileSync(file, JSON.stringify(out));
      lastMovesSig = null;
    }
  } catch {
    if (file && expected.length) {
      try {
        mkdirSync(movesDirPath(), { recursive: true });
        writeFileSync(file, JSON.stringify(expected));
        lastMovesSig = null;
      } catch { /* 렌더러의 내장 기술표로 폴백 */ }
    }
  }
}

// 진화 라인 전체(3단계) 기술을 미리 받아둔다 → 진화 순간 바로 교체 가능.
function fetchMovesLine(species) { for (let s = 0; s < 3; s++) fetchMoves(species, s); }

function fetchPokeApiRoster() {
  for (const species of SPECIES_KEYS) {
    fetchSpeciesSprites(species);
    fetchMovesLine(species);
  }
}

// 종/단계가 바뀌었고 그 단계 무브 캐시가 준비되면 payload에 moves를 전달(매 tick 방지).
function attachMoves(payload) {
  if (!state || !state.hatched || !state.species) return;
  const sig = `${state.species}_${state.stage || 0}`;
  if (sig === lastMovesSig) return;
  try {
    const file = join(movesDirPath(), `${state.species}_${state.stage || 0}.json`);
    if (!existsSync(file)) {
      payload.moves = gen2DisplayMoves(state.species, state.stage || 0);
      lastMovesSig = sig;
      return;
    }
    let moves = JSON.parse(readFileSync(file, 'utf8'));
    if (!usesOnlyGen2Effects(moves)) {
      moves = gen2DisplayMoves(state.species, state.stage || 0);
      writeFileSync(file, JSON.stringify(moves));
    } else {
      const expected = gen2DisplayMoves(state.species, state.stage || 0);
      if (expected.length && !sameMoves(moves, expected)) {
        moves = expected;
        writeFileSync(file, JSON.stringify(moves));
      }
    }
    payload.moves = moves;
    lastMovesSig = sig;
  } catch { /* ignore */ }
}

// 현재(부화 후) 종·단계의 울음소리를 data URL로 읽음(없으면 null).
function cryDataUrl(species, stage) {
  try {
    const p = join(criesDirPath(), `${species}_${stage}.ogg`);
    if (!existsSync(p)) return null;
    return 'data:audio/ogg;base64,' + readFileSync(p).toString('base64');
  } catch { return null; }
}

// 종/단계가 바뀌었고 파일이 준비됐을 때만 payload에 cry(data URL)를 실어 렌더러에 전달
// (매 tick 재전송 방지). lastCrySig로 게이트.
function attachCry(payload) {
  if (!state || !state.hatched || !state.species) return;
  const sig = `${state.species}_${state.stage || 0}`;
  if (sig === lastCrySig) return;
  const url = cryDataUrl(state.species, state.stage || 0);
  if (!url) return; // 아직 다운로드 전 → 다음 tick에
  payload.cry = url;
  lastCrySig = sig;
}

function computeSpritesSignature(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return ''; }
  const parts = [];
  for (const name of [...entries].sort()) {
    try {
      const st = statSync(join(dir, name));
      parts.push(`${name}:${st.mtimeMs}:${st.size}`);
    } catch { /* 스캔 중 사라진 파일 — 스킵 */ }
  }
  return parts.join('|');
}

function loadCustomSprites(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return {}; }
  const map = {};
  for (const name of entries) {
    const parsed = parseSpriteFileName(name);
    if (!parsed) continue; // 파일명 규칙 안 맞으면 무시(디렉토리/기타 파일 포함)
    try {
      const buf = readFileSync(join(dir, name));
      map[parsed.key] = `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      // 개별 파일 읽기 실패는 스킵 — 앱 크래시 금지
    }
  }
  return map;
}

// 폴더가 최초 스캔이거나 변경됐을 때만 새 맵을 반환, 아니면 null(재전송 생략).
function refreshCustomSpritesIfChanged() {
  const dir = spritesDirPath();
  const sig = computeSpritesSignature(dir);
  if (sig === customSpritesSignature) return null; // 변경 없음 — 재전송 생략
  customSpritesSignature = sig;
  return loadCustomSprites(dir);
}

// ---- AI-GENERATED: 야생 조우와 2세대 전투 창 수명주기 ----
function scheduleNextEncounter(now = Date.now()) {
  nextEncounterAt = state?.hatched ? now + nextEncounterDelayMs(Math.random) : 0;
}

function clearEncounterExpiry() {
  if (encounterExpiryTimer) clearTimeout(encounterExpiryTimer);
  encounterExpiryTimer = null;
}

function closeWildWindow() {
  clearEncounterExpiry();
  const win = wildWindow;
  wildWindow = null;
  if (win && !win.isDestroyed()) win.close();
}

function finishUnclaimedEncounter() {
  closeWildWindow();
  currentEncounter = null;
  scheduleNextEncounter();
}

function sendWildState() {
  if (!wildWindow || wildWindow.isDestroyed() || !currentEncounter) return;
  wildWindow.webContents.send('wild-state', {
    id: currentEncounter.id,
    speciesId: currentEncounter.speciesId,
    name: currentEncounter.name,
    level: currentEncounter.level,
    sprite: currentEncounter.sprite,
    cry: currentEncounter.cry,
    expiresAt: currentEncounter.expiresAt,
  });
}

function createWildWindow(encounter) {
  const display = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
  const area = display.workArea;
  const xRange = Math.max(1, area.width - WILD_WINDOW_WIDTH);
  const yRange = Math.max(1, area.height - WILD_WINDOW_HEIGHT);
  const x = area.x + Math.floor(Math.random() * xRange);
  const y = area.y + Math.floor(Math.random() * yRange);
  const win = new BrowserWindow({
    x, y, width: WILD_WINDOW_WIDTH, height: WILD_WINDOW_HEIGHT,
    transparent: true, backgroundColor: '#00000000', frame: false, hasShadow: false,
    resizable: false, movable: false, minimizable: false, maximizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  wildWindow = win;
  win.setBackgroundColor('#00000000');
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(join(__dirname, '../renderer/wild-encounter.html'));
  win.webContents.once('did-finish-load', sendWildState);
  win.on('closed', () => {
    if (wildWindow !== win) return;
    wildWindow = null;
    clearEncounterExpiry();
    if (currentEncounter && !currentBattle) {
      currentEncounter = null;
      scheduleNextEncounter();
    }
  });
  encounterExpiryTimer = setTimeout(() => {
    if (currentEncounter?.id === encounter.id && !currentBattle) finishUnclaimedEncounter();
  }, Math.max(0, encounter.expiresAt - Date.now()));
}

async function prepareAndShowWildEncounter(force = false) {
  if (encounterPreparing || currentEncounter || currentBattle || !state?.hatched) return;
  const now = Date.now();
  const cooldownUntil = state.battleProfile?.encounterCooldownUntil || 0;
  if (!force && !canScheduleEncounter({ hatched: true, cooldownUntil }, now)) return;
  encounterPreparing = true;
  nextEncounterAt = 0;
  try {
    const selected = chooseWildEncounter(state.level || 1, Math.random);
    if (!selected) throw new Error('No eligible Gold encounter');
    const prepared = await prepareWildPokemon({ cacheDir: dataDir(), ...selected });
    if (currentEncounter || currentBattle || !state?.hatched) return;
    const duration = wildAppearanceDurationMs(Math.random);
    currentEncounter = {
      id: randomUUID(),
      ...selected,
      ...prepared,
      expiresAt: Date.now() + duration,
    };
    createWildWindow(currentEncounter);
  } catch {
    scheduleNextEncounter();
  } finally {
    encounterPreparing = false;
  }
}

function runEncounterScheduler(now = Date.now()) {
  if (!state?.hatched || currentEncounter || currentBattle || encounterPreparing) return;
  const cooldownUntil = state.battleProfile?.encounterCooldownUntil || 0;
  if (!canScheduleEncounter({ hatched: true, cooldownUntil }, now)) {
    nextEncounterAt = 0;
    return;
  }
  if (!nextEncounterAt) scheduleNextEncounter(now);
  if (now >= nextEncounterAt) prepareAndShowWildEncounter();
}

function battlePayload(events = [], previousBattle = null) {
  if (!currentBattle) return null;
  return {
    battleId: currentBattle.id,
    turn: currentBattle.battle.turn,
    resolving: currentBattle.resolving,
    reward: currentBattle.reward,
    totalXp: state?.xp || 0,
    level: state?.level || 1,
    resultChanges: currentBattle.resultChanges,
    battle: currentBattle.battle,
    previousBattle,
    events,
    playerMoves: currentBattle.playerMoves,
    playerSprite: currentBattle.playerSprite,
    playerSpriteIsBack: currentBattle.playerSpriteIsBack,
    enemySprite: currentBattle.encounter.sprite,
    enemyCry: currentBattle.encounter.cry,
  };
}

function sendBattleState(events = [], previousBattle = null) {
  if (!battleWindow || battleWindow.isDestroyed()) return;
  const payload = battlePayload(events, previousBattle);
  if (payload) battleWindow.webContents.send('battle-state', payload);
}

function clearBattleEffects(closeCurrent = false) {
  for (const timer of battleEffectTimers) clearTimeout(timer);
  battleEffectTimers = [];
  if (closeCurrent && effectWin && !effectWin.isDestroyed()) effectWin.close();
  if (closeCurrent) effectWin = null;
}

function restorePetWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.showInactive();
    broadcastState(currentBattle?.resultChanges || {});
  }
}

function finishBattleSession() {
  if (battleTurnTimer) clearTimeout(battleTurnTimer);
  battleTurnTimer = null;
  clearBattleEffects(true);
  const win = battleWindow;
  battleWindow = null;
  restorePetWindow();
  currentBattle = null;
  if (win && !win.isDestroyed()) win.close();
  nextEncounterAt = 0;
}

function createBattleWindow(anchorBounds) {
  const display = anchorBounds
    ? screen.getDisplayMatching(anchorBounds)
    : (mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getPrimaryDisplay());
  const bounds = battleWindowBounds(display.workArea, anchorBounds, {
    width: BATTLE_WINDOW_WIDTH,
    height: BATTLE_WINDOW_HEIGHT,
  });
  const win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    transparent: true, backgroundColor: '#00000000', frame: false, hasShadow: false,
    resizable: false, movable: true, minimizable: false, maximizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required',
      backgroundThrottling: false,
    },
  });
  battleWindow = win;
  win.webContents.setAudioMuted(false);
  win.setBackgroundColor('#00000000');
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(join(__dirname, '../renderer/battle-window.html'));
  win.webContents.once('did-finish-load', () => sendBattleState());
  win.on('closed', () => {
    if (battleWindow !== win) return;
    battleWindow = null;
    if (battleTurnTimer) clearTimeout(battleTurnTimer);
    battleTurnTimer = null;
    clearBattleEffects(true);
    restorePetWindow();
    currentBattle = null;
    nextEncounterAt = 0;
  });
}

function startBattle(encounter) {
  const encounterBounds = wildWindow && !wildWindow.isDestroyed()
    ? wildWindow.getBounds()
    : null;
  state = ensureBattleProfile(state, Math.random);
  const line = dexLine(state.species);
  const playerSpeciesId = line[state.stage || 0];
  const roster = getSpeciesByKey(state.species);
  const playerName = roster?.stages[state.stage || 0]?.name || '포켓몬';
  const playerMoves = gen2SkillsForStage(state.species, state.stage || 0);
  const playerBackSprite = backSpriteDataUrl(state.species, state.stage || 0);
  const enemyDvs = createBattleProfile(Math.random).dvs;
  const battle = createGen2Battle({
    player: {
      speciesId: playerSpeciesId,
      name: playerName,
      level: state.level,
      dvs: state.battleProfile.dvs,
      statExp: state.battleProfile.statExp,
      moves: playerMoves.map((move) => move.slug),
    },
    enemy: {
      speciesId: encounter.speciesId,
      name: encounter.name,
      level: encounter.level,
      dvs: enemyDvs,
      statExp: { hp: 0, attack: 0, defense: 0, speed: 0, special: 0 },
      moves: encounter.moveIds,
    },
  });
  currentBattle = {
    id: randomUUID(),
    encounter,
    battle,
    playerMoves,
    playerSprite: playerBackSprite || spriteDataUrl(state.species, state.stage || 0),
    playerSpriteIsBack: Boolean(playerBackSprite),
    resolving: false,
    outcomeCommitted: false,
    reward: 0,
    resultChanges: {},
  };
  currentEncounter = null;
  closeWildWindow();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  createBattleWindow(encounterBounds);
}

function commitBattleOutcome() {
  if (!currentBattle || currentBattle.outcomeCommitted || !currentBattle.battle.winner) return;
  currentBattle.outcomeCommitted = true;
  if (currentBattle.battle.winner === 'player') {
    const reward = wildBattleExperience(currentBattle.encounter.speciesId, currentBattle.encounter.level);
    state = {
      ...state,
      battleProfile: recordBattleVictory(state.battleProfile, currentBattle.encounter.speciesId),
    };
    const applied = applyBattleExperience(state, reward);
    state = applied.state;
    currentBattle.reward = reward;
    currentBattle.resultChanges = { ...applied.changes, battleWon: true };
  } else {
    state = { ...state, battleProfile: recordBattleLoss(state.battleProfile, Date.now()) };
    currentBattle.resultChanges = { battleLost: true };
  }
  saveState(dataDir(), state);
}

function moveEventsUntilNextAction(events, index) {
  const next = events.findIndex((event, eventIndex) => eventIndex > index
    && ['move', 'unable'].includes(event.kind));
  return events.slice(index + 1, next < 0 ? events.length : next);
}

function effectForMoveEvent(event) {
  if (!currentBattle || event.kind !== 'move') return null;
  if (event.actor === 'player') {
    return currentBattle.playerMoves.find((entry) => entry.slug === event.moveSlug)?.effect || null;
  }
  const move = currentBattle.battle.enemy.moves.find((entry) => (
    (event.moveSlug && entry.slug === event.moveSlug) || entry.id === event.moveId
  ));
  return gen2BattleEffectForMove(move);
}

function playResolvedBattleEffects(events) {
  if (!currentBattle) return 0;
  clearBattleEffects(true);
  const battleId = currentBattle.id;
  let lastEffectAt = 0;

  battleEventSchedule(events).forEach(({ event, at }, index) => {
    if (event.kind !== 'move') return;
    const resolution = moveEventsUntilNextAction(events, index);
    const target = event.actor === 'player' ? 'enemy' : 'player';
    const chargeOnly = resolution.some((entry) => entry.kind === 'charge' && entry.actor === event.actor)
      && !resolution.some((entry) => entry.kind === 'damage' && entry.target === target);
    const effect = chargeOnly ? null : effectForMoveEvent(event);
    if (!effect) return;
    lastEffectAt = Math.max(lastEffectAt, at);
    const play = () => {
      if (!currentBattle || currentBattle.id !== battleId || !battleWindow || battleWindow.isDestroyed()) return;
      playSkillEffect(effect, { layout: 'battle', actor: event.actor }, battleWindow.getBounds());
    };
    if (at === 0) play();
    else battleEffectTimers.push(setTimeout(play, at));
  });
  return lastEffectAt;
}

function resolveBattleMove(payload) {
  if (!currentBattle || currentBattle.resolving || currentBattle.battle.winner) return;
  if (payload?.battleId !== currentBattle.id || Number(payload?.turn) !== currentBattle.battle.turn) return;
  if (!currentBattle.playerMoves.some((move) => move.slug === payload.moveSlug)) return;
  currentBattle.resolving = true;
  const previousBattle = currentBattle.battle;
  const result = resolveGen2Turn(previousBattle, payload.moveSlug, Math.random);
  currentBattle.battle = result.state;
  commitBattleOutcome();
  sendBattleState(result.events, previousBattle);
  const lastEffectAt = playResolvedBattleEffects(result.events);
  const timelineEnd = battleTimelineDuration(result.events);
  const effectsEnd = lastEffectAt + BATTLE_ACTION_MS;
  const resultDelay = Math.max(
    effectsEnd,
    timelineEnd + (currentBattle.battle.winner ? RESULT_HOLD_MS : BATTLE_DETAIL_MS),
  );
  battleTurnTimer = setTimeout(() => {
    battleTurnTimer = null;
    if (!currentBattle) return;
    if (currentBattle.battle.winner) {
      finishBattleSession();
      return;
    }
    currentBattle.resolving = false;
    sendBattleState();
  }, resultDelay);
}

function runTick() {
  const today = localDateKey(); // UTC가 아니라 로컬 자정 기준 — KST에서 오전 9시 리셋 방지
  const result = tick({ state, readEvents, readSessionEvents, today });
  state = result.state;
  saveState(dataDir(), state);
  driftWindow(result.activity);
  const customSprites = refreshCustomSpritesIfChanged();
  if (customSprites) result.customSprites = customSprites; // 최초 1회 + 변경 시에만 포함
  attachCry(result); // 종/단계 바뀌었고 파일 준비되면 울음소리 data URL 전달
  attachMoves(result); // 종 바뀌었고 무브 캐시 준비되면 실제 기술명 전달
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state', result);
  }
  runEncounterScheduler();
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_HEIGHT,
    x: Math.floor(workArea.x + workArea.width / 2 - WINDOW_SIZE / 2),
    y: workArea.y + workArea.height - WINDOW_HEIGHT - 24,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox:false — package.json "type":"module" 하의 ESM preload.js(import 문법)
      // 로딩 호환성을 위해 비활성화(Electron 버전별 샌드박스 ESM 프리로드 지원이
      // 불안정할 수 있어 안전한 쪽 선택). 디스플레이 없는 환경이라 실행 미검증 — 수동 확인 필요.
      sandbox: false,
    },
  });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(join(__dirname, '../renderer/pet-window.html'));
}

// 부화/진화 등 상태 변화를 즉시 렌더러에 알림(다음 tick을 기다리지 않고).
function broadcastState(changes) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const payload = {
    state,
    changes: { leveledUp: false, evolved: false, xpGained: 0, reactions: 0, ...changes },
    activity: { busy: Boolean(state?.busy), skillPulse: false },
  };
  attachCry(payload);
  attachMoves(payload);
  mainWindow.webContents.send('state', payload);
}

function sendMenuCommand(command) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  // 별도 채널을 추가하지 않고 기존 'state' 페이로드에 명령을 실어 보낸다
  // (preload.js는 onState(cb) 하나만 노출 — 렌더러가 payload.command로 분기).
  mainWindow.webContents.send('state', {
    state,
    changes: { leveledUp: false, evolved: false, xpGained: 0, reactions: 0 },
    activity: { busy: Boolean(state?.busy), skillPulse: false },
    command,
  });
}

function createTray() {
  const icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_PNG_BASE64, 'base64'));
  tray = new Tray(icon);
  tray.setToolTip('포켓몬 버디');
  const menu = Menu.buildFromTemplate([
    { label: '상태 보기', click: () => sendMenuCommand('showStatus') },
    { label: '첫 만남 다시보기', click: () => sendMenuCommand('replayIntro') },
    { label: '포켓몬 데이터 받기(PokéAPI)', click: () => { if (state?.hatched) fetchPokeApiRoster(); } },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
  tray.on('right-click', () => tray.popUpContextMenu(menu));
  tray.on('click', () => tray.popUpContextMenu(menu));
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  const dir = dataDir();
  eventsOffset = loadOffset(); // 영속된 오프셋부터 재개(재시작 시 전체 replay 방지)
  // 최초엔 알 상태(자동 뽑기 없음). 종은 부화("!" 클릭) 시에만 랜덤 결정된다.
  state = loadState(dir);
  state = { ...state, busy: false }; // 재시작 잔여 busy 무시
  state = ensureBattleProfile(state, Math.random); // 기존 세이브는 최초 1회 DV/stat EXP 생성
  saveState(dir, state);

  // 이미 부화한 경우 12마리 골드판 스프라이트와 24개 기술을 모두 비동기 캐시한다.
  if (state.hatched && state.species) fetchPokeApiRoster();

  // 렌더러의 수동 드래그 → 창 이동. 네이티브 -webkit-app-region:drag 대신 이 경로를 쓴다
  // (그래야 캔버스 클릭=핀 토글이 드래그 히트테스트에 먹히지 않는다).
  ipcMain.on('pkmn:move-window', (_e, { dx, dy }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
    lastManualMoveAt = Date.now();
  });

  // 더블클릭 상세 패널: 열리면 창을 확장해 패널을 담고, 닫히면 원래 크기로 원복.
  // 좌상단(펫 위치)은 유지하고 아래/오른쪽으로만 커지도록 x,y는 그대로 둔다.
  ipcMain.on('pkmn:set-detail', (_e, open) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    const w = open ? DETAIL_WIDTH : WINDOW_SIZE;
    const h = open ? DETAIL_HEIGHT : WINDOW_HEIGHT;
    mainWindow.setBounds({ x, y, width: w, height: h });
  });

  // 기술 선택 → 현재 디스플레이 전체를 덮는 투명·클릭통과 오버레이 창에서 이펙트 재생.
  ipcMain.on('pkmn:play-skill', (_e, effect) => {
    const sprite = state?.species ? spriteDataUrl(state.species, state.stage || 0) : null;
    playSkillEffect(effect, sprite ? { sprite } : undefined);
  });

  ipcMain.on('pkmn:accept-encounter', (_e, encounterId) => {
    if (!currentEncounter || currentEncounter.id !== encounterId || currentBattle) return;
    if (Date.now() >= currentEncounter.expiresAt) {
      finishUnclaimedEncounter();
      return;
    }
    startBattle(currentEncounter);
  });

  ipcMain.on('pkmn:battle-move', (_e, payload) => resolveBattleMove(payload));

  ipcMain.on('pkmn:leave-battle', (_e, battleId) => {
    if (!currentBattle || currentBattle.id !== battleId || currentBattle.outcomeCommitted) return;
    finishBattleSession();
  });

  // 부화: 알("!" 클릭) → 종을 랜덤 결정(rollStarter, Math.random)하고 hatched=true.
  // 종은 이 순간에만 정해지므로 미리 알 수 없고, 결과는 서명 저장되어 편집 시 리셋된다.
  ipcMain.on('pkmn:hatch', () => {
    if (!state || state.hatched) return;
    state = rollStarter(state, Math.random); // species 결정 + locked
    state = { ...state, hatched: true };
    state = ensureBattleProfile(state, Math.random);
    saveState(dataDir(), state);
    scheduleNextEncounter();
    fetchPokeApiRoster();                // 12마리 골드판 스프라이트와 24개 기술 선행 캐시
    playSkillEffect('hatch');            // 화면 전체 부화 연출
    broadcastState({ hatched: true });
  });

  // 진화: 레벨이 허용할 때만("!" 클릭) stage +1. 자동 진화 아님.
  ipcMain.on('pkmn:evolve', () => {
    if (!state || !state.hatched) return;
    if (!canEvolve(getSpeciesByKey(state.species), state.level, state.stage)) return;
    const oldStage = state.stage || 0;
    // 진화 연출에 쓸 이전/다음 폼 스프라이트(있으면 가운데에서 변신 연출).
    const from = spriteDataUrl(state.species, oldStage);
    const to = spriteDataUrl(state.species, oldStage + 1);
    state = { ...state, stage: oldStage + 1 };
    saveState(dataDir(), state);
    fetchSpeciesSprites(state.species); // 새 단계 스프라이트 보장(없었을 경우)
    fetchMoves(state.species, state.stage); // 새 단계 기술 보장(미리 안 받았을 경우)
    const opts = {};
    if (from) opts.from = from;
    if (to) opts.to = to;
    playSkillEffect('evolve', opts);    // 화면 가운데 변신 + 전체 연출
    broadcastState({ evolved: true });
  });

  createWindow();
  createTray();

  intervalId = setInterval(runTick, TICK_MS);
  scheduleNextEncounter();
  if (process.env.POCKETMON_FORCE_ENCOUNTER === '1') {
    setTimeout(() => prepareAndShowWildEncounter(true), 1500);
  }
});

app.on('window-all-closed', () => {
  // 트레이 상주 앱 — 창이 닫혀도 종료하지 않는다.
});

app.on('before-quit', () => {
  if (intervalId) clearInterval(intervalId);
  if (encounterExpiryTimer) clearTimeout(encounterExpiryTimer);
  if (battleTurnTimer) clearTimeout(battleTurnTimer);
  clearBattleEffects(true);
});
