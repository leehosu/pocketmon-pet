import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';

// hook은 events.jsonl에 append만 하고 앱은 offset만 전진시키므로, 소비가 끝난 앞부분을
// 아무도 지우지 않으면 파일이 영구히 커진다. 소비분이 이 크기를 넘으면 미소비 tail만
// 남기고 재작성한다(tmp→rename).
export const EVENTS_COMPACT_BYTES = 1024 * 1024;

// 소비가 끝난 앞부분을 잘라내고 미소비 tail만 남긴다.
// 새 오프셋을 반환한다(압축을 안 했거나 실패하면 받은 오프셋 그대로 — 다음 tick 재시도).
//
// 재작성과 hook의 append가 겹치면 이벤트 1건이 유실될 수 있다. 이벤트는 XP 가산분일 뿐이고
// 압축은 수개월에 한 번 일어나므로 감수한다.
export function compactEventsFile(file, offset, threshold = EVENTS_COMPACT_BYTES) {
  if (!Number.isFinite(offset) || offset < threshold) return offset;
  try {
    const { size } = statSync(file);
    if (size < offset) return offset; // 이미 회전/축소됨 — 호출자가 다음 읽기에서 리셋한다
    const tail = readFileSync(file).subarray(offset);
    const tmp = `${file}.compact`;
    writeFileSync(tmp, tail);
    renameSync(tmp, file);
    return 0;
  } catch {
    return offset; // 압축 실패는 치명적 아님
  }
}
