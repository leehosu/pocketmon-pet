import { app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  existsSync, statSync, openSync, readSync, closeSync, readdirSync, readFileSync,
  writeFileSync, mkdirSync,
} from 'node:fs';
import { homedir } from 'node:os';

import { dataDir, EVENTS_FILE } from '../core/paths.js';
import { verify } from '../core/integrity.js';
import { loadState, saveState } from '../core/store.js';
import { parseSessionLines } from '../core/session-parser.js';
import { tick, ensureStarter } from './orchestrator.js';
import { SPRITE_DIR, parseSpriteFileName } from '../core/sprite-files.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TICK_MS = 4000;
const WINDOW_SIZE = 96;
// 더블클릭 상세 패널을 담기 위해 창을 잠깐 확장할 크기(닫으면 WINDOW_SIZE로 원복).
const DETAIL_WIDTH = 200;
const DETAIL_HEIGHT = 232;
const DRIFT_STEP_BUSY = 6; // 프롬프트 처리중(달리기) — 크게 움직임
const DRIFT_STEP_IDLE = 1; // 평상시 — 가끔 조금만 움직임
const IDLE_MOVE_CHANCE = 0.15;
// 첫 실행 시 몇 달치 세션 로그를 한꺼번에 XP로 소급 반영하지 않도록,
// lastSessionTs가 없으면(0) "최근 24시간"만 소급 범위로 삼는다.
const FIRST_RUN_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const OFFSET_FILE = 'offset';

// 16x16 포켓볼 스타일 트레이 아이콘(외부 에셋 없이 인라인 PNG로 제공).
const TRAY_ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAS0lEQVR4nGNgoDYQERH5jw8TrfmZjQ0KJmgILo24' +
  'DCJLM05DCPmbYHhQxYCvX7+ShAehAaQYgjMQyTaAFEOISo3YDCIrP5CcmcgBACPIn+yKwOQDAAAAAElFTkSuQmCC';

// 수동 드래그와 자동 드리프트가 창을 동시에 잡아당겨 싸우지 않도록,
// 마지막 수동 이동 후 이 시간 동안은 auto-drift를 건너뛴다.
const MANUAL_MOVE_COOLDOWN_MS = 1500;

let mainWindow = null;
let tray = null;
let intervalId = null;
let driftDir = 1;
let state = null;
let lastManualMoveAt = 0;

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
    const { id, kind, ts, sig } = obj;
    if (!verify({ id, kind, ts }, sig)) continue; // 서명 검증 실패 → 위조/조작 간주, 버림
    out.push({ id, kind, ts });
  }
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

function readSessionEvents(sinceTs) {
  const floor = sinceTs > 0 ? sinceTs : Date.now() - FIRST_RUN_SESSION_WINDOW_MS;
  const root = join(homedir(), '.claude', 'projects');
  if (!existsSync(root)) return [];
  const events = [];
  for (const file of listJsonlFilesRecursive(root)) {
    let st;
    try { st = statSync(file); } catch { continue; }
    if (st.mtimeMs < floor) continue; // 이 파일에 floor 이후 새 내용이 없음
    let content;
    try { content = readFileSync(file, 'utf8'); } catch { continue; }
    events.push(...parseSessionLines(content.split('\n'), floor));
  }
  return events;
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

// ---- 커스텀 스프라이트: ~/.pocketmon/sprites/ 의 사용자 PNG → data URL 맵 ----
// 폴더 전체를 매 tick 재전송하면 대용량 IPC가 되므로, 파일목록+mtime+size로
// 만든 시그니처가 바뀔 때만(=최초 1회 포함) 재로드해 payload에 싣는다.
let customSpritesSignature = null;

function spritesDirPath() { return join(dataDir(), SPRITE_DIR); }

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

function runTick() {
  const today = new Date().toISOString().slice(0, 10);
  const result = tick({ state, readEvents, readSessionEvents, today });
  state = result.state;
  saveState(dataDir(), state);
  driftWindow(result.activity);
  const customSprites = refreshCustomSpritesIfChanged();
  if (customSprites) result.customSprites = customSprites; // 최초 1회 + 변경 시에만 포함
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('state', result);
  }
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    x: Math.floor(workArea.x + workArea.width / 2 - WINDOW_SIZE / 2),
    y: workArea.y + workArea.height - WINDOW_SIZE - 24,
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
  state = ensureStarter(loadState(dir), Math.random);
  state = { ...state, busy: false }; // 재시작 잔여 busy 무시
  saveState(dir, state);

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
    const h = open ? DETAIL_HEIGHT : WINDOW_SIZE;
    mainWindow.setBounds({ x, y, width: w, height: h });
  });

  createWindow();
  createTray();

  intervalId = setInterval(runTick, TICK_MS);
});

app.on('window-all-closed', () => {
  // 트레이 상주 앱 — 창이 닫혀도 종료하지 않는다.
});

app.on('before-quit', () => {
  if (intervalId) clearInterval(intervalId);
});
