# 포켓몬 데스크톱 마스콧 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code로 코딩할수록 경험치가 쌓여 레벨업·진화하는 8비트 포켓몬 데스크톱 마스콧 앱을 만든다.

**Architecture:** Electron 앱. 순수 로직(core: xp-engine, roster, store)을 UI/Electron과 분리해 Node에서 단위 테스트한다. Claude Code Hook과 세션 로그 파서가 XP 이벤트를 생성하고, 투명 플로팅 창(renderer)이 canvas로 8비트 스프라이트를 렌더한다. 세이브는 홈 디렉터리(`~/.pocketmon/`)에 두어 앱 재설치와 무관하게 유지한다.

**Tech Stack:** Node.js, Electron, Vitest(테스트), HTML Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-08-16-pocketmon-desktop-design.md`

## Global Constraints

- 세이브·이벤트 파일은 반드시 `~/.pocketmon/`(홈 디렉터리)에 저장 — 앱 번들 내부 금지(재설치 유지 요건).
- core 모듈(`src/core/**`)은 Electron API에 의존하지 않는 순수 Node 모듈 — Vitest로 테스트 가능해야 함.
- 로스터 4종·진화 곡선은 `src/core/roster.js` 상수로 분리 — 하드코딩 산재 금지.
- 스프라이트는 외부 이미지 파일 없이 JS 색상 매트릭스(팔레트 인덱스)로 정의.
- 뽑기는 1회성 영구 지정: 한 번 `locked`되면 재추첨 불가.
- 이벤트 dedup은 이벤트 `id` 기준.
- 진화 레벨 기본값: 풀 16/32, 불 16/36, 물 18/30, 전기 10/25.
- 레벨업 필요 누적 XP 곡선: 레벨 L 도달에 필요한 누적 XP = `floor(100 * L^1.5)`.
- **치팅 방지(tamper-evident)**: 레벨·진화단계는 저장 authority가 아니라 XP에서
  항상 재계산(로드 시에도 재계산해 저장값을 덮어씀). XP를 직접 설정하는 API/메뉴
  없음. save.json은 HMAC 서명(`{data,sig}`), 로드 시 검증 실패면 조작으로 간주해
  안전 초기화. hook 이벤트도 HMAC 서명, 유효 서명 이벤트만 XP·반응에 반영.
- HMAC 비밀키·서명 로직은 `src/core/integrity.js` 한 곳에서 관리(로컬 앱이라 완전
  비밀은 아니고 난독화 수준의 억지력임을 코드 주석에 명시).

---

### Task 1: 프로젝트 스캐폴딩 + 로스터 데이터

**Files:**
- Create: `package.json`
- Create: `src/core/roster.js`
- Create: `.gitignore`
- Test: `test/roster.test.js`

**Interfaces:**
- Produces:
  - `ROSTER`: 배열. 각 원소 `{ key: string, type: '풀'|'불'|'물'|'전기', stages: [{name: string}, {name}, {name}], evolveLevels: [number, number] }`. 4종.
  - `getSpeciesByKey(key: string) -> species | undefined`
  - `stageForLevel(species, level: number) -> number` (0|1|2, 진화 단계 인덱스)

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "pocketmon-desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/main/index.js",
  "scripts": {
    "start": "electron .",
    "test": "vitest run"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: .gitignore 작성**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 3: 의존성 설치**

Run: `cd /Users/ihosu/git/lake/pocketmon-desktop && npm install`
Expected: node_modules 생성, 에러 없음.

- [ ] **Step 4: 실패하는 테스트 작성** (`test/roster.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { ROSTER, getSpeciesByKey, stageForLevel } from '../src/core/roster.js';

describe('roster', () => {
  it('has 4 species with 3 stages each', () => {
    expect(ROSTER).toHaveLength(4);
    for (const s of ROSTER) expect(s.stages).toHaveLength(3);
  });

  it('looks up species by key', () => {
    expect(getSpeciesByKey('electric').stages[0].name).toBe('피츄');
    expect(getSpeciesByKey('nope')).toBeUndefined();
  });

  it('maps level to evolution stage (electric evolves at 10/25)', () => {
    const s = getSpeciesByKey('electric');
    expect(stageForLevel(s, 1)).toBe(0);   // 피츄
    expect(stageForLevel(s, 10)).toBe(1);  // 피카츄
    expect(stageForLevel(s, 25)).toBe(2);  // 라이츄
    expect(stageForLevel(s, 99)).toBe(2);
  });
});
```

- [ ] **Step 5: 테스트 실패 확인**

Run: `npx vitest run test/roster.test.js`
Expected: FAIL — roster.js 모듈 없음.

- [ ] **Step 6: roster.js 구현**

```js
export const ROSTER = [
  { key: 'grass', type: '풀', evolveLevels: [16, 32],
    stages: [{ name: '치코리타' }, { name: '베이리프' }, { name: '메가니움' }] },
  { key: 'fire', type: '불', evolveLevels: [16, 36],
    stages: [{ name: '브케인' }, { name: '마그케인' }, { name: '블레이범' }] },
  { key: 'water', type: '물', evolveLevels: [18, 30],
    stages: [{ name: '리아코' }, { name: '엘리게이' }, { name: '장크로다일' }] },
  { key: 'electric', type: '전기', evolveLevels: [10, 25],
    stages: [{ name: '피츄' }, { name: '피카츄' }, { name: '라이츄' }] },
];

export function getSpeciesByKey(key) {
  return ROSTER.find((s) => s.key === key);
}

export function stageForLevel(species, level) {
  const [e1, e2] = species.evolveLevels;
  if (level >= e2) return 2;
  if (level >= e1) return 1;
  return 0;
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx vitest run test/roster.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git init && git add -A && git commit -m "feat: 프로젝트 스캐폴딩 + 로스터 데이터"
```

---

### Task 2: XP 엔진 (순수 로직)

**Files:**
- Create: `src/core/xp-engine.js`
- Test: `test/xp-engine.test.js`

**Interfaces:**
- Consumes: `roster.js`의 `getSpeciesByKey`, `stageForLevel`.
- Produces:
  - `xpForLevel(level: number) -> number` — 해당 레벨 **도달**에 필요한 누적 XP = `floor(100 * level^1.5)`.
  - `levelForXp(xp: number) -> number` — 누적 XP로 현재 레벨 계산(최소 1).
  - `XP_RULES`: `{ perToolUse: 2, perSessionStart: 5, perTokens: 1, tokensUnit: 1000, dailyCap: 500 }` (상수).
  - `applyEvents(state, events, opts) -> { state, changes }` — 이벤트 배열을 누적. `state`는 `{ species, level, xp, stage, dailyXp, dailyDate, seenIds }`. `changes`는 `{ leveledUp: bool, evolved: bool, xpGained: number, reactions: number }`. `events` 원소: `{ id, kind: 'toolUse'|'sessionStart'|'tokens', tokens?, ts }`. `opts.today`(YYYY-MM-DD)로 일일 상한 리셋 판정. 이미 본 id·dailyCap 초과분은 제외.

- [ ] **Step 1: 실패하는 테스트 작성** (`test/xp-engine.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { xpForLevel, levelForXp, applyEvents, XP_RULES } from '../src/core/xp-engine.js';

const base = () => ({ species: 'electric', level: 1, xp: 0, stage: 0,
  dailyXp: 0, dailyDate: '2026-08-16', seenIds: [] });

describe('xp curve', () => {
  it('xpForLevel grows super-linearly', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(4)).toBe(800);
    expect(xpForLevel(9)).toBe(2700);
  });
  it('levelForXp inverts the curve', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(800)).toBe(4);
    expect(levelForXp(2699)).toBe(8);
  });
});

describe('applyEvents', () => {
  it('adds tool-use xp and reacts', () => {
    const { state, changes } = applyEvents(base(),
      [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' });
    expect(state.xp).toBe(XP_RULES.perToolUse);
    expect(changes.reactions).toBe(1);
  });
  it('dedups seen ids', () => {
    let s = base();
    ({ state: s } = applyEvents(s, [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' }));
    const { state } = applyEvents(s, [{ id: 'a', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' });
    expect(state.xp).toBe(XP_RULES.perToolUse); // unchanged
  });
  it('converts tokens to xp with unit', () => {
    const { state } = applyEvents(base(),
      [{ id: 't', kind: 'tokens', tokens: 3000, ts: 1 }], { today: '2026-08-16' });
    expect(state.xp).toBe(3); // 3000/1000 * 1
  });
  it('enforces daily cap', () => {
    const { state } = applyEvents(base(),
      [{ id: 't', kind: 'tokens', tokens: 9_000_000, ts: 1 }], { today: '2026-08-16' });
    expect(state.dailyXp).toBe(XP_RULES.dailyCap);
  });
  it('resets daily cap on new day', () => {
    const s = { ...base(), dailyXp: XP_RULES.dailyCap, dailyDate: '2026-08-15' };
    const { state } = applyEvents(s,
      [{ id: 'x', kind: 'toolUse', ts: 1 }], { today: '2026-08-16' });
    expect(state.dailyXp).toBe(XP_RULES.perToolUse);
  });
  it('detects level up and evolution', () => {
    const s = { ...base(), xp: xpForLevel(9) };
    const { state, changes } = applyEvents(s,
      [{ id: 'big', kind: 'tokens', tokens: 1000, ts: 1 }], { today: '2026-08-16' });
    expect(state.level).toBe(10);
    expect(changes.leveledUp).toBe(true);
    expect(state.stage).toBe(1);      // 피카츄
    expect(changes.evolved).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/xp-engine.test.js`
Expected: FAIL — xp-engine.js 없음.

- [ ] **Step 3: xp-engine.js 구현**

```js
import { getSpeciesByKey, stageForLevel } from './roster.js';

export const XP_RULES = {
  perToolUse: 2, perSessionStart: 5,
  perTokens: 1, tokensUnit: 1000, dailyCap: 500,
};

export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function levelForXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

function xpForEvent(e) {
  if (e.kind === 'toolUse') return XP_RULES.perToolUse;
  if (e.kind === 'sessionStart') return XP_RULES.perSessionStart;
  if (e.kind === 'tokens') return Math.floor((e.tokens || 0) / XP_RULES.tokensUnit) * XP_RULES.perTokens;
  return 0;
}

export function applyEvents(state, events, opts) {
  const today = opts.today;
  let s = { ...state, seenIds: [...state.seenIds] };
  if (s.dailyDate !== today) { s.dailyDate = today; s.dailyXp = 0; }
  const seen = new Set(s.seenIds);
  const startLevel = s.level;
  const startStage = s.stage;
  let reactions = 0;

  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    s.seenIds.push(e.id);
    let gain = xpForEvent(e);
    const room = Math.max(0, XP_RULES.dailyCap - s.dailyXp);
    gain = Math.min(gain, room);
    if (gain <= 0 && e.kind !== 'toolUse' && e.kind !== 'sessionStart') continue;
    s.xp += gain;
    s.dailyXp += gain;
    if (e.kind === 'toolUse' || e.kind === 'sessionStart') reactions++;
  }

  s.level = levelForXp(s.xp);
  s.stage = stageForLevel(getSpeciesByKey(s.species), s.level);
  const xpGained = s.xp - state.xp;

  return {
    state: s,
    changes: {
      leveledUp: s.level > startLevel,
      evolved: s.stage > startStage,
      xpGained,
      reactions,
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/xp-engine.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: XP 엔진 (레벨 곡선, dedup, 일일 상한, 진화 판정)"
```

---

### Task 3: 세이브 저장소 + 뽑기(1회성 영구 지정) + 무결성 서명

**Files:**
- Create: `src/core/paths.js`
- Create: `src/core/integrity.js`
- Create: `src/core/store.js`
- Test: `test/integrity.test.js`
- Test: `test/store.test.js`

**Interfaces:**
- Consumes: `roster.js`의 `ROSTER`; `xp-engine.js`의 `levelForXp`; `roster.js`의 `stageForLevel`; `store.js`의 `getSpeciesByKey`(로드 시 재계산용).
- Produces (`integrity.js`):
  - `SECRET`: 내장 HMAC 키 상수(주석에 "로컬 앱이라 완전 비밀 아님, 난독화 수준 억지력" 명시).
  - `canonical(obj) -> string` — 키 정렬 안정 직렬화(서명 대상 정규화).
  - `sign(obj, secret = SECRET) -> string` — HMAC-SHA256 hex.
  - `verify(obj, sig, secret = SECRET) -> boolean` — 타이밍-세이프 비교.
- Produces (`store.js`):
  - `defaultState() -> state` (Task 2 state 스키마 + `locked: false`, `rolledAt: null`, `lastActiveAt: null`, `lastSessionTs: 0`).
  - `loadState(dir) -> state` — 파일 없으면 기본값. 파일이 `{data,sig}`이고 서명 검증 통과 시 `data` 반환하되 **level/stage를 XP에서 재계산해 덮어씀**. 서명 불일치·손상·구형식이면 조작/손상으로 간주해 손상 파일을 `.bak`으로 백업하고 안전 기본값 반환(초기화).
  - `saveState(dir, state) -> void` — level/stage 재계산 후 `{ data: state, sig: sign(state) }`로 저장.
  - `rollStarter(state, rng = Math.random) -> state` — `locked`가 false일 때만 랜덤 종 지정 후 `locked: true`, `rolledAt` 세팅. 이미 locked면 그대로 반환(재추첨 불가).
- Produces (`paths.js`):
  - `dataDir() -> string` — `~/.pocketmon` 절대경로.
  - `SAVE_FILE`, `EVENTS_FILE` 상수(파일명).

- [ ] **Step 1: integrity 실패 테스트 작성** (`test/integrity.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { sign, verify, canonical } from '../src/core/integrity.js';

describe('integrity', () => {
  it('canonical is key-order stable', () => {
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
  });
  it('sign/verify round-trips', () => {
    const obj = { xp: 100, species: 'fire' };
    const sig = sign(obj);
    expect(verify(obj, sig)).toBe(true);
  });
  it('rejects a tampered object', () => {
    const sig = sign({ xp: 100 });
    expect(verify({ xp: 999 }, sig)).toBe(false);
  });
  it('rejects a bad signature', () => {
    expect(verify({ xp: 100 }, 'deadbeef')).toBe(false);
  });
});
```

- [ ] **Step 2: integrity 테스트 실패 확인**

Run: `npx vitest run test/integrity.test.js`
Expected: FAIL — integrity.js 없음.

- [ ] **Step 3: integrity.js 구현**

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

// 로컬 데스크톱 앱이라 이 키는 바이너리에서 추출 가능 — 완전 비밀이 아니라
// 수기 편집을 감지하는 "난독화 수준" 억지력이다(서버 권위 계산이 아님).
export const SECRET = 'pkmn-desktop-v1-integrity-key-do-not-rely-as-real-secret';

export function canonical(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

export function sign(obj, secret = SECRET) {
  return createHmac('sha256', secret).update(canonical(obj)).digest('hex');
}

export function verify(obj, sig, secret = SECRET) {
  if (typeof sig !== 'string') return false;
  const expected = sign(obj, secret);
  if (expected.length !== sig.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: store 실패 테스트 작성** (`test/store.test.js`)

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultState, loadState, saveState, rollStarter } from '../src/core/store.js';
import { xpForLevel } from '../src/core/xp-engine.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pkmn-')); });

describe('store', () => {
  it('returns default state when no save file', () => {
    const s = loadState(dir);
    expect(s.locked).toBe(false);
    expect(s.level).toBe(1);
  });

  it('round-trips save/load (signed)', () => {
    const s = { ...defaultState(), species: 'fire', xp: xpForLevel(5), locked: true };
    saveState(dir, s);
    const loaded = loadState(dir);
    expect(loaded.xp).toBe(xpForLevel(5));
    expect(loaded.level).toBe(5); // derived from xp
  });

  it('recovers (resets) from corrupt save file', () => {
    writeFileSync(join(dir, 'save.json'), '{not json');
    const s = loadState(dir);
    expect(s.level).toBe(1);
    expect(existsSync(join(dir, 'save.json.bak'))).toBe(true);
  });

  it('rejects a hand-tampered save and resets (anti-cheat)', () => {
    const s = { ...defaultState(), species: 'electric', xp: 100, locked: true };
    saveState(dir, s);
    // attacker edits xp to 999999 in the data block, keeping old sig
    const raw = JSON.parse(readFileSync(join(dir, 'save.json'), 'utf8'));
    raw.data.xp = 999999;
    writeFileSync(join(dir, 'save.json'), JSON.stringify(raw));
    const loaded = loadState(dir);
    expect(loaded.xp).toBe(0);      // reset, cheat rejected
    expect(loaded.locked).toBe(false);
  });

  it('recomputes level/stage from xp even if stored values are forged', () => {
    // valid signature but we saved via saveState which recomputes anyway;
    // simulate by saving a state whose level field is wrong before signing
    const s = { ...defaultState(), species: 'electric', xp: xpForLevel(10), level: 1, stage: 0, locked: true };
    saveState(dir, s);
    const loaded = loadState(dir);
    expect(loaded.level).toBe(10);
    expect(loaded.stage).toBe(1); // 피카츄 (전기 진화 10)
  });

  it('rolls a starter once and locks it', () => {
    const s1 = rollStarter(defaultState(), () => 0);
    expect(s1.locked).toBe(true);
    expect(s1.species).toBe('grass');
    const s2 = rollStarter(s1, () => 0.99);
    expect(s2.species).toBe('grass'); // re-roll does nothing
  });
});
```

- [ ] **Step 5: store 테스트 실패 확인**

Run: `npx vitest run test/store.test.js`
Expected: FAIL — store.js 없음.

- [ ] **Step 6: paths.js 구현**

```js
import { homedir } from 'node:os';
import { join } from 'node:path';

export const SAVE_FILE = 'save.json';
export const EVENTS_FILE = 'events.jsonl';
export function dataDir() { return join(homedir(), '.pocketmon'); }
```

- [ ] **Step 7: store.js 구현**

```js
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SAVE_FILE } from './paths.js';
import { ROSTER, getSpeciesByKey, stageForLevel } from './roster.js';
import { levelForXp } from './xp-engine.js';
import { sign, verify } from './integrity.js';

export function defaultState() {
  return {
    species: null, level: 1, xp: 0, stage: 0,
    dailyXp: 0, dailyDate: null, seenIds: [],
    locked: false, rolledAt: null, lastActiveAt: null, lastSessionTs: 0,
  };
}

// level/stage는 저장 authority가 아니다 — 항상 xp에서 재계산.
function recompute(state) {
  const level = levelForXp(state.xp || 0);
  const species = getSpeciesByKey(state.species);
  const stage = species ? stageForLevel(species, level) : 0;
  return { ...state, level, stage };
}

export function loadState(dir) {
  const file = join(dir, SAVE_FILE);
  if (!existsSync(file)) return defaultState();
  const backupAndReset = () => {
    try { renameSync(file, file + '.bak'); } catch { /* ignore */ }
    return defaultState();
  };
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch { return backupAndReset(); }
  // 서명 형식이 아니거나 검증 실패 → 조작/손상으로 간주해 초기화
  if (!parsed || typeof parsed !== 'object' || !('data' in parsed) || !('sig' in parsed)) {
    return backupAndReset();
  }
  if (!verify(parsed.data, parsed.sig)) return backupAndReset();
  return recompute({ ...defaultState(), ...parsed.data });
}

export function saveState(dir, state) {
  mkdirSync(dir, { recursive: true });
  const data = recompute(state);
  writeFileSync(join(dir, SAVE_FILE), JSON.stringify({ data, sig: sign(data) }, null, 2));
}

export function rollStarter(state, rng = Math.random) {
  if (state.locked) return state;
  const pick = ROSTER[Math.floor(rng() * ROSTER.length)];
  return { ...state, species: pick.key, locked: true, rolledAt: Date.now() };
}
```

- [ ] **Step 8: 테스트 통과 확인**

Run: `npx vitest run test/integrity.test.js test/store.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: 세이브 저장소 + 1회성 영구 뽑기 + HMAC 무결성(치팅 방지)"
```

---

### Task 4: 세션 로그 파서

**Files:**
- Create: `src/core/session-parser.js`
- Test: `test/session-parser.test.js`

**Interfaces:**
- Produces:
  - `parseSessionLines(lines: string[], sinceTs = 0) -> events[]` — Claude Code 세션 jsonl 라인 배열에서 `tokens` 종류 XP 이벤트를 만든다. 각 라인은 JSON이며 assistant 메시지의 usage(예: `{ type:'assistant', uuid, timestamp, message:{ usage:{ input_tokens, output_tokens } } }`)를 가질 수 있다. 이벤트 `id`는 라인 `uuid`, `tokens`는 input+output 합, `ts`는 timestamp(ms). `sinceTs` 이하·usage 없는 라인·파싱 실패 라인은 제외.

- [ ] **Step 1: 실패하는 테스트 작성** (`test/session-parser.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { parseSessionLines } from '../src/core/session-parser.js';

const line = (uuid, ts, inTok, outTok) => JSON.stringify({
  type: 'assistant', uuid, timestamp: new Date(ts).toISOString(),
  message: { usage: { input_tokens: inTok, output_tokens: outTok } },
});

describe('parseSessionLines', () => {
  it('extracts token events from assistant usage', () => {
    const evs = parseSessionLines([line('u1', 1000, 100, 50)]);
    expect(evs).toEqual([{ id: 'u1', kind: 'tokens', tokens: 150, ts: 1000 }]);
  });
  it('skips lines without usage and broken lines', () => {
    const evs = parseSessionLines([
      JSON.stringify({ type: 'user', uuid: 'x' }),
      '{broken',
      line('u2', 2000, 10, 10),
    ]);
    expect(evs).toEqual([{ id: 'u2', kind: 'tokens', tokens: 20, ts: 2000 }]);
  });
  it('filters events at or before sinceTs', () => {
    const evs = parseSessionLines([line('u1', 1000, 5, 5), line('u2', 3000, 5, 5)], 1000);
    expect(evs.map((e) => e.id)).toEqual(['u2']);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/session-parser.test.js`
Expected: FAIL — session-parser.js 없음.

- [ ] **Step 3: session-parser.js 구현**

```js
export function parseSessionLines(lines, sinceTs = 0) {
  const out = [];
  for (const raw of lines) {
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }
    const usage = obj?.message?.usage;
    if (!usage) continue;
    const ts = Date.parse(obj.timestamp);
    if (!Number.isFinite(ts) || ts <= sinceTs) continue;
    const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
    if (tokens <= 0) continue;
    out.push({ id: obj.uuid, kind: 'tokens', tokens, ts });
  }
  return out;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/session-parser.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 세션 로그 파서 (토큰 usage → XP 이벤트)"
```

---

### Task 5: Hook 스크립트 + 설치 안내

**Files:**
- Create: `hook/pocketmon-hook.js`
- Create: `hook/install.md`
- Test: `test/hook.test.js`

**Interfaces:**
- Consumes: `paths.js`의 `dataDir`, `EVENTS_FILE`.
- Consumes: `paths.js`의 `dataDir`, `EVENTS_FILE`; `integrity.js`의 `sign`.
- Produces:
  - `hook/pocketmon-hook.js` — stdin으로 Claude Code hook JSON을 받아 `~/.pocketmon/events.jsonl`에 한 줄 append. `buildEvent(hookInput, now, rand) -> event|null`를 export해 테스트한다. hook_event_name 매핑(활동 감지 포함): `SessionStart`→`sessionStart`, `PostToolUse`→`toolUse`, `UserPromptSubmit`→`busyStart`(프롬프트 처리 시작=달리기), `Stop`→`busyEnd`(응답 종료=idle 복귀). id는 `session_id` + event 종류 + 카운터/랜덤으로 유일하게. **이벤트에 HMAC `sig` 포함**(치팅 방지: 앱은 유효 서명 이벤트만 반영). `sig`는 `{id,kind,ts}`에 대한 서명. busyStart/busyEnd는 XP를 주지 않는 활동 신호일 뿐(애니메이션용).

- [ ] **Step 1: 실패하는 테스트 작성** (`test/hook.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { buildEvent } from '../hook/pocketmon-hook.js';
import { verify } from '../src/core/integrity.js';

describe('buildEvent', () => {
  it('maps SessionStart to sessionStart event', () => {
    const e = buildEvent({ hook_event_name: 'SessionStart', session_id: 's1' }, 1000, () => 0.5);
    expect(e.kind).toBe('sessionStart');
    expect(e.ts).toBe(1000);
    expect(typeof e.id).toBe('string');
  });
  it('maps PostToolUse to toolUse event', () => {
    const e = buildEvent({ hook_event_name: 'PostToolUse', session_id: 's1' }, 2000, () => 0.5);
    expect(e.kind).toBe('toolUse');
  });
  it('maps activity events (UserPromptSubmit→busyStart, Stop→busyEnd)', () => {
    expect(buildEvent({ hook_event_name: 'UserPromptSubmit', session_id: 's1' }, 3000, () => 0.5).kind).toBe('busyStart');
    expect(buildEvent({ hook_event_name: 'Stop', session_id: 's1' }, 4000, () => 0.5).kind).toBe('busyEnd');
  });
  it('signs the event so the app can verify it (anti-cheat)', () => {
    const e = buildEvent({ hook_event_name: 'PostToolUse', session_id: 's1' }, 2000, () => 0.5);
    expect(typeof e.sig).toBe('string');
    expect(verify({ id: e.id, kind: e.kind, ts: e.ts }, e.sig)).toBe(true);
  });
  it('returns null for irrelevant events', () => {
    expect(buildEvent({ hook_event_name: 'Nope' }, 1, () => 0)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/hook.test.js`
Expected: FAIL — hook 모듈 없음.

- [ ] **Step 3: pocketmon-hook.js 구현**

```js
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, EVENTS_FILE } from '../src/core/paths.js';
import { sign } from '../src/core/integrity.js';

const KIND = {
  SessionStart: 'sessionStart',
  PostToolUse: 'toolUse',
  UserPromptSubmit: 'busyStart', // 프롬프트 처리 시작 → 달리기
  Stop: 'busyEnd',               // 응답 종료 → idle/walk 복귀
};

export function buildEvent(input, now, rand = Math.random) {
  const kind = KIND[input?.hook_event_name];
  if (!kind) return null;
  const id = `${input.session_id || 'nosess'}:${kind}:${now}:${Math.floor(rand() * 1e9)}`;
  const core = { id, kind, ts: now };
  return { ...core, sig: sign(core) }; // 앱이 검증할 서명(치팅 방지)
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    let input = {};
    try { input = JSON.parse(raw); } catch { /* ignore */ }
    const e = buildEvent(input, Date.now());
    if (!e) process.exit(0);
    const dir = dataDir();
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, EVENTS_FILE), JSON.stringify(e) + '\n');
    process.exit(0);
  });
}

// stdin이 연결된 실제 실행일 때만 main 구동 (테스트 import 시 실행 안 됨)
if (process.argv[1] && process.argv[1].endsWith('pocketmon-hook.js')) main();
```

- [ ] **Step 4: install.md 작성**

````markdown
# Hook 설치

`~/.claude/settings.json`의 hooks에 아래를 추가한다(경로는 이 레포 절대경로로):

동일한 command를 4개 이벤트에 등록한다(SessionStart=등장, PostToolUse=기술,
UserPromptSubmit=달리기 시작, Stop=idle 복귀):

```json
{
  "hooks": {
    "SessionStart":     [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ],
    "PostToolUse":      [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ],
    "UserPromptSubmit": [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ],
    "Stop":             [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ]
  }
}
```

훅은 서명된 이벤트를 `~/.pocketmon/events.jsonl`에 append하며, 앱이 이를 감시해
XP·활동 애니메이션(달리기/기술)에 반영한다.
````

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run test/hook.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Claude Code hook 스크립트 + 설치 안내"
```

---

### Task 6: 8비트 스프라이트 데이터 + 렌더러(순수 부분)

**Files:**
- Create: `src/core/sprites/palette.js`
- Create: `src/core/sprites/index.js`
- Create: `src/renderer/canvas-render.js`
- Test: `test/sprites.test.js`

**Interfaces:**
- Produces:
  - `palette.js`: `PALETTE` — 색상 hex 배열(인덱스 0 = 투명 `null`). 게임보이/8비트 톤 제한 세트.
  - `sprites/index.js`:
    - `ANIMS` — 애니메이션 이름 상수 배열 `['idle','walk','run','skill']`.
    - `SPRITES` — `{ [speciesKey]: [stage0, stage1, stage2] }`. 각 stage는 **명명 애니 세트** 객체 `{ idle:[frame..], walk:[frame..], run:[frame..], skill:[frame..] }`. 각 frame은 정사각 2D 숫자 매트릭스(팔레트 인덱스, 예 16×16). 최소 프레임: idle 2, walk 2, run 2, skill 1.
    - `getFrames(species, stage, anim) -> frame[]` — 해당 애니 프레임 배열. 없는 anim은 `idle`로 폴백.
  - `canvas-render.js`: `drawFrame(ctx, frame, palette, scale)` — 매트릭스를 canvas에 픽셀 사각형으로 그림(0/투명은 스킵).

- [ ] **Step 1: 실패하는 테스트 작성** (`test/sprites.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { PALETTE } from '../src/core/sprites/palette.js';
import { SPRITES, ANIMS, getFrames } from '../src/core/sprites/index.js';
import { ROSTER } from '../src/core/roster.js';

const eachFrame = (cb) => {
  for (const key of Object.keys(SPRITES))
    for (const stage of SPRITES[key])
      for (const anim of ANIMS)
        for (const frame of stage[anim]) cb(frame, key, anim);
};

describe('sprites', () => {
  it('every species has 3 stages, each with all named anims', () => {
    for (const s of ROSTER) {
      const stages = SPRITES[s.key];
      expect(stages).toHaveLength(3);
      for (const stage of stages) {
        for (const anim of ANIMS) expect(Array.isArray(stage[anim])).toBe(true);
        expect(stage.idle.length).toBeGreaterThanOrEqual(2);
        expect(stage.walk.length).toBeGreaterThanOrEqual(2);
        expect(stage.run.length).toBeGreaterThanOrEqual(2);
        expect(stage.skill.length).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it('all frames are square and use valid palette indices', () => {
    eachFrame((frame) => {
      const n = frame.length;
      for (const row of frame) {
        expect(row).toHaveLength(n);
        for (const idx of row) {
          expect(idx).toBeGreaterThanOrEqual(0);
          expect(idx).toBeLessThan(PALETTE.length);
        }
      }
    });
  });
  // 실제로 서로 다른 도트인지 강제 (placeholder 동일 스프라이트 금지)
  it('idle base frame differs across all 12 species+stage sprites', () => {
    const seen = new Set();
    for (const key of Object.keys(SPRITES)) {
      for (const stage of SPRITES[key]) {
        const sig = JSON.stringify(stage.idle[0]);
        expect(seen.has(sig)).toBe(false); // 중복 금지
        seen.add(sig);
      }
    }
    expect(seen.size).toBe(12);
  });
  it('getFrames returns frames and falls back to idle for unknown anim', () => {
    expect(getFrames('electric', 0, 'run').length).toBeGreaterThanOrEqual(2);
    expect(getFrames('electric', 0, 'nope')).toEqual(getFrames('electric', 0, 'idle'));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/sprites.test.js`
Expected: FAIL — sprite 모듈 없음.

- [ ] **Step 3: palette.js 구현**

```js
// index 0 = 투명. 나머지는 8비트 톤 제한 팔레트.
export const PALETTE = [
  null,       // 0 transparent
  '#0f0f0f',  // 1 outline (near-black)
  '#ffffff',  // 2 white
  '#f8c838',  // 3 yellow
  '#e08a1e',  // 4 orange
  '#d13b27',  // 5 red
  '#3a9e3a',  // 6 green
  '#1e6bd1',  // 7 blue
  '#7ac6ff',  // 8 light blue
  '#8a5a2b',  // 9 brown
  '#f0a8a8',  // 10 pink
  '#b0b0b0',  // 11 gray
];
```

- [ ] **Step 4: sprites/index.js 구현**

이 태스크의 **실제 산출물은 12개(4종×3단계)의 서로 구분되는 8비트 도트**와 각
스프라이트의 명명 애니(idle/walk/run/skill)다. 구조·헬퍼·애니 파생 규칙은 아래
코드로 고정하고, **각 종·단계의 idle 베이스 프레임(16×16)은 알아볼 수 있게 손수
그린다**(distinguishability 테스트가 12개 전부 다름을 강제). 애니 변형(walk/run/skill)은
베이스에서 transform으로 파생한다.

작업 순서: (1) 아래 헬퍼/transform/`getFrames`/`ANIMS`/`buildStage`를 그대로 두고,
(2) 12개 `IDLE_BASE[key][stage]` 16×16 매트릭스를 종별로 구분되게 채운다. 색 가이드:
풀=초록6/흰2, 불=주황4/빨강5, 물=파랑7/하늘8, 전기=노랑3/피부10, 윤곽=1, 눈=1/흰2.
단계가 오를수록 실루엣을 키우고 디테일(꼬리·귀·뿔) 추가로 형태를 확실히 구분한다.

```js
import { ROSTER } from '../roster.js';

const N = 16;
export const ANIMS = ['idle', 'walk', 'run', 'skill'];
const blank = () => Array.from({ length: N }, () => Array(N).fill(0));
const clone = (f) => f.map((r) => r.slice());

// --- 애니 파생 transform (베이스 idle 프레임 1장에서 프레임들을 만든다) ---
const bob = (f) => { const g = clone(f); g.pop(); g.unshift(Array(N).fill(0)); return g; }; // 1px 위
const shiftLegs = (f) => {                       // 아랫줄만 좌우로 살짝 → 걷는 느낌
  const g = clone(f);
  const row = g[N - 1];
  g[N - 1] = [0, ...row.slice(0, N - 1)];
  return g;
};
const lean = (f) => {                             // 한 칸 앞으로 기울여 달리는 느낌
  const g = clone(f);
  for (let y = 0; y < N; y++) g[y] = [...g[y].slice(1), 0];
  return g;
};
const flash = (f, spark) => {                      // 기술: 몸 반짝 + 스파크 픽셀
  const g = clone(f);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] === 1 ? false : g[y][x]) { /* keep */ }
  // 오른쪽 위에 스파크(spark 색) 몇 점
  g[3][13] = spark; g[4][14] = spark; g[2][14] = spark;
  return g;
};

const SPARK = { grass: 6, fire: 5, water: 8, electric: 3 };

// idle 베이스 → 명명 애니 세트
function buildStage(base, sparkColor) {
  return {
    idle: [base, bob(base)],
    walk: [base, shiftLegs(base)],
    run: [lean(base), lean(bob(base))],
    skill: [flash(base, sparkColor)],
  };
}

// ▼▼▼ 구현자가 채울 부분: 12개 구분되는 16×16 idle 베이스 ▼▼▼
// 각 값은 16행×16열 팔레트 인덱스 매트릭스. 종·단계마다 실루엣/색을 다르게.
const IDLE_BASE = {
  grass:    [ /* 치코리타 */ , /* 베이리프 */ , /* 메가니움 */ ],
  fire:     [ /* 브케인 */ , /* 마그케인 */ , /* 블레이범 */ ],
  water:    [ /* 리아코 */ , /* 엘리게이 */ , /* 장크로다일 */ ],
  electric: [ /* 피츄 */ , /* 피카츄 */ , /* 라이츄 */ ],
};
// ▲▲▲ 위 12칸을 실제 매트릭스로 채운다(빈 칸 금지) ▲▲▲

export const SPRITES = Object.fromEntries(
  ROSTER.map((s) => [s.key,
    IDLE_BASE[s.key].map((base) => buildStage(base, SPARK[s.key])),
  ]),
);

export function getFrames(species, stage, anim) {
  const set = SPRITES[species][stage];
  return set[anim] || set.idle;
}
```

> 구현 노트: `IDLE_BASE`의 12칸을 반드시 **서로 다른 실제 도트**로 채운다
> (distinguishability 테스트가 12개 전부 다름을 검증). 헬퍼/transform은 그대로 사용.
> 하나의 좋은 idle 베이스만 그리면 walk/run/skill은 자동 파생된다. 도트는 게임
> 원본 스프라이트 파일을 복사하지 말고 8비트 스타일로 새로 그린 오리지널이어야 한다.

- [ ] **Step 5: canvas-render.js 구현**

```js
export function drawFrame(ctx, frame, palette, scale) {
  for (let y = 0; y < frame.length; y++) {
    for (let x = 0; x < frame[y].length; x++) {
      const c = palette[frame[y][x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run test/sprites.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: 8비트 팔레트/스프라이트 데이터 + canvas 렌더"
```

---

### Task 7: Electron main 프로세스 (창 + 트레이 + 오케스트레이션)

**Files:**
- Create: `src/main/index.js`
- Create: `src/main/preload.js`
- Create: `src/main/orchestrator.js`
- Test: `test/orchestrator.test.js`

**Interfaces:**
- Consumes: `store.js`, `xp-engine.js`, `session-parser.js`, `paths.js`, `roster.js`.
- Produces:
  - `orchestrator.js`: `tick(deps) -> { state, changes }` — 순수하게 테스트 가능한 조율 함수. `deps = { state, readEvents(): event[], readSessionEvents(sinceTs): event[], today }`. events.jsonl 이벤트 + 세션 이벤트를 합쳐 `applyEvents`에 넘기고, 갱신 state와 changes 반환. 처음 실행(species=null·locked=false)이면 먼저 `rollStarter` 수행하도록 `ensureStarter(state, rng) -> state`도 export.
  - `index.js`: Electron 앱 부트 — 투명·frameless·always-on-top BrowserWindow 생성, Tray 우클릭 메뉴(상태/뽑기연출/종료), 주기 tick으로 IPC push. (테스트 제외 — 수동 확인.)

- [ ] **Step 1: 실패하는 테스트 작성** (`test/orchestrator.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { tick, ensureStarter } from '../src/main/orchestrator.js';
import { defaultState } from '../src/core/store.js';

describe('ensureStarter', () => {
  it('rolls a starter when unlocked', () => {
    const s = ensureStarter(defaultState(), () => 0);
    expect(s.locked).toBe(true);
    expect(s.species).toBe('grass');
  });
  it('keeps existing starter when locked', () => {
    const locked = { ...defaultState(), species: 'fire', locked: true };
    expect(ensureStarter(locked, () => 0).species).toBe('fire');
  });
});

describe('tick', () => {
  it('merges hook and session events and applies xp', () => {
    const state = { ...defaultState(), species: 'electric', locked: true, dailyDate: '2026-08-16' };
    const { state: next, changes } = tick({
      state,
      readEvents: () => [{ id: 'h1', kind: 'toolUse', ts: 1 }],
      readSessionEvents: () => [{ id: 's1', kind: 'tokens', tokens: 2000, ts: 2 }],
      today: '2026-08-16',
    });
    expect(next.xp).toBe(2 + 2); // toolUse 2 + 2000/1000
    expect(changes.reactions).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/orchestrator.test.js`
Expected: FAIL — orchestrator.js 없음.

- [ ] **Step 3: orchestrator.js 구현**

```js
import { applyEvents } from '../core/xp-engine.js';
import { rollStarter } from '../core/store.js';

export function ensureStarter(state, rng = Math.random) {
  return state.locked ? state : rollStarter(state, rng);
}

export function tick(deps) {
  const events = [
    ...deps.readEvents(),
    ...deps.readSessionEvents(deps.state.lastSessionTs || 0),
  ];
  const maxTs = events.reduce((m, e) => Math.max(m, e.ts || 0), deps.state.lastSessionTs || 0);
  const { state, changes } = applyEvents(deps.state, events, { today: deps.today });
  return { state: { ...state, lastSessionTs: maxTs, lastActiveAt: Date.now() }, changes };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run test/orchestrator.test.js`
Expected: PASS.

- [ ] **Step 5: index.js + preload.js 구현 (Electron, 수동 확인)**

`index.js`: `app.whenReady()`에서 `loadState(dataDir())` → `ensureStarter` → `saveState`. 투명 BrowserWindow(`transparent:true, frame:false, alwaysOnTop:true, resizable:false, skipTaskbar:true`) 생성해 `pet-window.html` 로드. `Tray`로 우클릭 메뉴(상태 보기 / 뽑기 연출 / 종료). `setInterval`로 tick 실행: `readEvents`는 events.jsonl을 읽어 각 줄을 JSON 파싱한 뒤 **`integrity.verify({id,kind,ts}, sig)`로 서명을 검증하고 유효한 이벤트만 반환**(가짜 append 무시 — 치팅 방지), 처리한 라인은 offset 기록/잘라냄. `readSessionEvents`는 `~/.claude/projects/**/*.jsonl` 최근 파일 파싱(세션 로그는 Claude Code 자신이 쓴 권위 소스라 서명 불필요). tick 결과를 `webContents.send('state', ...)`로 renderer에 전달하고 `saveState`. preload.js는 `contextBridge`로 `onState(cb)` 노출.

```js
// preload.js
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('pkmn', {
  onState: (cb) => ipcRenderer.on('state', (_e, payload) => cb(payload)),
});
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Electron main + 조율(tick/ensureStarter)"
```

---

### Task 8: 렌더러 펫 창 (표시 + 상호작용 + 연출)

**Files:**
- Create: `src/renderer/pet-window.html`
- Create: `src/renderer/pet-window.js`
- Test: `test/anim.test.js`

**Interfaces:**
- Consumes: `canvas-render.js`의 `drawFrame`, `sprites/index.js`, `palette.js`, `roster.js`.
- Produces:
  - `pet-window.js`:
    - `nextFrameIndex(state) -> number` — 애니메이션 프레임 선택 순수 함수(idle 깜빡, react 중이면 jump).
    - `hudVisible(ui) -> boolean` — HUD(XP바·상태창) 노출 여부 순수 함수. `ui = { hovering, pinned }`. 평상시(둘 다 false)엔 false, hover 중이거나 클릭으로 pin되면 true.
  - 나머지(canvas 루프, `window.pkmn.onState` 구독, 드래그 이동, 레벨업/진화 팝 연출, hover/클릭 → HUD 토글)는 브라우저 동작 — 수동 확인.

**UX 요건:** 평상시에는 포켓몬 스프라이트만 보인다. 마우스를 올리면(hover) XP바+간단 상태(종/레벨)가 페이드인되고, 클릭하면 상세 상태창(누적 XP·다음 레벨까지·진화단계)이 pin되어 유지된다(다시 클릭하면 해제). 레벨업/진화 순간의 팝 연출은 HUD 상태와 무관하게 잠깐 표시된다.

- [ ] **Step 1: 실패하는 테스트 작성** (`test/anim.test.js`)

```js
import { describe, it, expect } from 'vitest';
import { nextFrameIndex, hudVisible } from '../src/renderer/pet-window.js';

describe('nextFrameIndex', () => {
  it('cycles idle frames over time', () => {
    expect(nextFrameIndex({ reacting: false, tickCount: 0, frameCount: 2 })).toBe(0);
    expect(nextFrameIndex({ reacting: false, tickCount: 1, frameCount: 2 })).toBe(1);
    expect(nextFrameIndex({ reacting: false, tickCount: 2, frameCount: 2 })).toBe(0);
  });
  it('shows jump frame (last) while reacting', () => {
    expect(nextFrameIndex({ reacting: true, tickCount: 0, frameCount: 2 })).toBe(1);
  });
});

describe('hudVisible', () => {
  it('hidden by default (sprite only)', () => {
    expect(hudVisible({ hovering: false, pinned: false })).toBe(false);
  });
  it('shown on hover', () => {
    expect(hudVisible({ hovering: true, pinned: false })).toBe(true);
  });
  it('shown when pinned by click even without hover', () => {
    expect(hudVisible({ hovering: false, pinned: true })).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run test/anim.test.js`
Expected: FAIL.

- [ ] **Step 3: pet-window.js의 nextFrameIndex 구현 + 브라우저 로직**

```js
export function nextFrameIndex({ reacting, tickCount, frameCount }) {
  if (reacting) return frameCount - 1; // jump = 마지막 프레임
  return tickCount % frameCount;
}

export function hudVisible({ hovering, pinned }) {
  return Boolean(hovering || pinned);
}
```

브라우저 부분(모듈 하단, `typeof window !== 'undefined'` 가드): canvas 컨텍스트 얻어
`imageSmoothingEnabled=false`, `window.pkmn.onState`로 state 수신 시 현재 종/단계
스프라이트 선택. `requestAnimationFrame`(또는 setInterval)로 `nextFrameIndex`로 프레임
골라 `drawFrame`. changes.leveledUp/evolved면 잠시 `reacting=true` + 텍스트 팝("Lv↑"/"진화!").
빈 영역 드래그로 창 이동(`-webkit-app-region: drag`).

**HUD 노출 로직:** `mouseenter/mouseleave`로 `hovering` 토글, 캔버스 클릭으로 `pinned`
토글. `hudVisible({hovering, pinned})`가 true면 XP바(`xp / xpForLevel(level+1)` 비율)와
상태 텍스트(종·Lv·단계) 오버레이를 `opacity` 트랜지션으로 페이드인, false면 페이드아웃해
평상시엔 스프라이트만 남긴다. HUD DOM은 `pointer-events` 처리로 드래그를 방해하지 않게 한다.

- [ ] **Step 4: pet-window.html 작성**

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent;overflow:hidden;-webkit-app-region:drag;}
  canvas{image-rendering:pixelated;}
  #pop{position:fixed;top:0;left:0;font:bold 12px monospace;color:#fff;
       text-shadow:0 0 2px #000;pointer-events:none;}
</style></head>
<body>
  <canvas id="pet" width="128" height="128"></canvas>
  <div id="pop"></div>
  <script type="module" src="./pet-window.js"></script>
</body>
</html>
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run test/anim.test.js`
Expected: PASS.

- [ ] **Step 6: 전체 테스트 실행**

Run: `npx vitest run`
Expected: 모든 테스트 PASS.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: 렌더러 펫 창 (애니메이션/상호작용/연출)"
```

---

### Task 9: 수동 통합 확인 + README

**Files:**
- Create: `README.md`

**Interfaces:** 없음 (통합/문서).

- [ ] **Step 1: 앱 실행 확인**

Run: `npm start`
Expected: 투명 창에 8비트 포켓몬 1마리 표시(최초 실행 시 랜덤 지정), 트레이 아이콘 등장.

- [ ] **Step 2: XP 유입 확인 (정상 경로)**

수동: hook 스크립트를 직접 여러 번 실행해 서명된 이벤트를 생성한다:
`echo '{"hook_event_name":"PostToolUse","session_id":"manual"}' | node hook/pocketmon-hook.js`
→ 다음 tick에 펫이 반응하고 XP가 오르는지 확인. (Claude Code에서 실제 코딩해도 동일.)

- [ ] **Step 3: 치팅 방지 확인**

수동: (a) `~/.pocketmon/events.jsonl`에 서명 없는 가짜 줄
`{"id":"x","kind":"tokens","tokens":999999,"ts":1}`을 손으로 추가 → 다음 tick에
**무시되어 XP 변화 없음** 확인. (b) `~/.pocketmon/save.json`의 `data.xp`를 큰 값으로
편집 → 앱 재시작 시 **서명 불일치로 초기화**(진행도 리셋)되는지 확인.

- [ ] **Step 4: 재설치 유지 확인**

수동: 앱 종료 후 재실행 → 같은 포켓몬·레벨 유지. `~/.pocketmon/save.json` 존재 확인.

- [ ] **Step 4: README 작성**

설치(`npm install`), 실행(`npm start`), hook 등록(`hook/install.md` 링크), 초기화 방법(`~/.pocketmon/save.json` 삭제), 로스터·XP 규칙 요약을 담는다.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: README + 통합 확인"
```
