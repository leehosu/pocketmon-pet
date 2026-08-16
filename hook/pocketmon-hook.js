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
