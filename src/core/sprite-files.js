// ============================================================
// 순수 함수 — 앱이 다운로드한 PokéAPI 스프라이트 파일명 규칙 해석.
// Electron/fs 의존 없음(테스트 대상 — test/sprite-files.test.js).
// 실제 폴더 스캔은 main/index.js가 담당한다.
//
// 다운로드 스프라이트는 앱 전용 캐시 폴더(SPRITE_DIR)에만 저장/로드하며,
// 사용자가 임의 PNG를 넣어 교체하는 "커스텀 스프라이트" 기능은 제공하지 않는다.
// ============================================================

// 앱 전용 다운로드 스프라이트 캐시 폴더(dataDir 하위). 사용자 폴더가 아니다.
export const SPRITE_DIR = 'dex';

// 렌더 키(확장자 없음). 다운로드는 stage 공용 파일(<species>_<stage>)만 쓴다.
export function spriteKey(species, stage) {
  return `${species}_${stage}`;
}

// 디스크 파일명을 파싱한다. 허용 형식: <species>_<stage>.png
// species=소문자 영문, stage=0|1|2. 안 맞으면 null.
export function parseSpriteFileName(filename) {
  const m = /^([a-z]+)_([0-2])\.png$/.exec(filename);
  if (!m) return null;
  const species = m[1];
  const stage = Number(m[2]);
  return { key: `${species}_${stage}`, species, stage };
}
