// AI-GENERATED: 관장 창을 펫 옆에 붙이고 현재 디스플레이 작업 영역 안에 유지한다.
export function gymLeaderWindowBounds(workArea, petBounds, size, gap = 8) {
  const width = Math.min(size.width, workArea.width);
  const height = Math.min(size.height, workArea.height);
  const right = petBounds.x + petBounds.width + gap;
  const left = petBounds.x - width - gap;
  const x = right + width <= workArea.x + workArea.width ? right : left;
  const centeredY = petBounds.y + petBounds.height / 2 - height / 2;
  return {
    x: Math.round(Math.min(Math.max(x, workArea.x), workArea.x + workArea.width - width)),
    y: Math.round(Math.min(Math.max(centeredY, workArea.y), workArea.y + workArea.height - height)),
    width,
    height,
  };
}
