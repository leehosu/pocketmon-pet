import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

// 서명키는 코드/레포에 박지 않고, 사용자 기기의 로컬 파일(~/.pocketmon/secret.key)에 둔다.
// 없으면 첫 실행 때 무작위로 생성하고 소유자 전용(0600)으로 저장한다.
// → 레포/코드만 가진 주체(레포에 접근한 AI 포함)는 이 키가 없어 서명(위조)할 수 없다.
//   (단, 이 홈 디렉터리를 읽을 수 있는 주체는 접근 가능 — 완전 차단은 서버 필요.)
const SECRET_FILE = 'secret.key';
const cache = new Map(); // dir -> key

export function getSecret(dir) {
  if (cache.has(dir)) return cache.get(dir);
  const file = join(dir, SECRET_FILE);
  let key;
  try {
    if (existsSync(file)) {
      key = readFileSync(file, 'utf8').trim();
    }
    if (!key) {
      key = randomBytes(32).toString('hex');
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, key, { mode: 0o600 });
    }
  } catch {
    // 파일 접근 실패 시에도 세션 내에서는 일관된 키를 쓰도록 임시 키 생성(메모리 캐시).
    key = key || randomBytes(32).toString('hex');
  }
  cache.set(dir, key);
  return key;
}
