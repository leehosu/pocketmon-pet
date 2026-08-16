// ============================================================
// 순수 함수 — 사용자 커스텀 스프라이트 파일명 규칙/후보 해석.
// Electron/fs 의존 없음(테스트 대상 — test/sprite-files.test.js).
// 실제 폴더 스캔은 main/index.js가 담당한다.
// ============================================================

export const SPRITE_DIR = 'sprites';

// 매칭 우선순위 키 배열(확장자 없음) — anim 전용이 stage 공용보다 우선.
export function customCandidates(species, stage, anim) {
  return [`${species}_${stage}_${anim}`, `${species}_${stage}`];
}

// 디스크 파일명을 파싱한다. 허용 형식:
//   <species>_<stage>.png  또는  <species>_<stage>_<anim>.png
// species=소문자 영문, stage=0|1|2, anim=idle|walk|run|skill. 안 맞으면 null.
export function parseSpriteFileName(filename) {
  const m = /^([a-z]+)_([0-2])(?:_(idle|walk|run|skill))?\.png$/.exec(filename);
  if (!m) return null;
  const species = m[1];
  const stage = Number(m[2]);
  const anim = m[3] || null;
  const key = anim ? `${species}_${stage}_${anim}` : `${species}_${stage}`;
  return { key, species, stage, anim };
}
