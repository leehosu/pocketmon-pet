// AI-GENERATED: 야생 포켓몬 위치를 중심으로 컴팩트 배틀 창을 배치하고 작업영역을 벗어나지 않게 한다.
export function battleWindowBounds(workArea, anchor, size) {
  const width = Math.min(size.width, workArea.width);
  const height = Math.min(size.height, workArea.height);
  const centerX = anchor
    ? anchor.x + anchor.width / 2
    : workArea.x + workArea.width / 2;
  const centerY = anchor
    ? anchor.y + anchor.height / 2
    : workArea.y + workArea.height / 2;
  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;

  return {
    x: Math.round(Math.min(Math.max(centerX - width / 2, workArea.x), maxX)),
    y: Math.round(Math.min(Math.max(centerY - height / 2, workArea.y), maxY)),
    width,
    height,
  };
}
