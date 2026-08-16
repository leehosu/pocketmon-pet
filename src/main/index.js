import { app, BrowserWindow, Tray, Menu, screen, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  existsSync, statSync, openSync, readSync, closeSync, readdirSync, readFileSync,
} from 'node:fs';
import { homedir } from 'node:os';

import { dataDir, EVENTS_FILE } from '../core/paths.js';
import { verify } from '../core/integrity.js';
import { loadState, saveState } from '../core/store.js';
import { parseSessionLines } from '../core/session-parser.js';
import { tick, ensureStarter } from './orchestrator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TICK_MS = 4000;
const WINDOW_SIZE = 96;
const DRIFT_STEP_BUSY = 6; // 프롬프트 처리중(달리기) — 크게 움직임
const DRIFT_STEP_IDLE = 1; // 평상시 — 가끔 조금만 움직임
const IDLE_MOVE_CHANCE = 0.15;
// 첫 실행 시 몇 달치 세션 로그를 한꺼번에 XP로 소급 반영하지 않도록,
// lastSessionTs가 없으면(0) "최근 24시간"만 소급 범위로 삼는다.
const FIRST_RUN_SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

// 16x16 포켓볼 스타일 트레이 아이콘(외부 에셋 없이 인라인 PNG로 제공).
const TRAY_ICON_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAS0lEQVR4nGNgoDYQERH5jw8TrfmZjQ0KJmgILo24' +
  'DCJLM05DCPmbYHhQxYCvX7+ShAehAaQYgjMQyTaAFEOISo3YDCIrP5CcmcgBACPIn+yKwOQDAAAAAElFTkSuQmCC';

let mainWindow = null;
let tray = null;
let intervalId = null;
let driftDir = 1;
let state = null;

// ---- readEvents(): hook이 append하는 서명된 events.jsonl을 증분 읽기 + 검증 ----
// 서명(sig)이 없거나 위조된 이벤트는 조용히 버린다(치팅 방지) — 앱이 XP의 유일한 권위.
let eventsOffset = 0;

function readEvents() {
  const file = join(dataDir(), EVENTS_FILE);
  if (!existsSync(file)) return [];
  let stat;
  try { stat = statSync(file); } catch { return []; }
  if (stat.size < eventsOffset) eventsOffset = 0; // 파일이 회전/축소됨 → 처음부터 재시작
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

function runTick() {
  const today = new Date().toISOString().slice(0, 10);
  const result = tick({ state, readEvents, readSessionEvents, today });
  state = result.state;
  saveState(dataDir(), state);
  driftWindow(result.activity);
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
  state = ensureStarter(loadState(dir), Math.random);
  state = { ...state, busy: false }; // 재시작 잔여 busy 무시
  saveState(dir, state);

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
