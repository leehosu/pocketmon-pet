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
