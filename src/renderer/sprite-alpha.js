// AI-GENERATED: 골드판 스프라이트의 외부 배경과 대각선으로 열린 틈만 투명 처리한다.
export function clearConnectedNearWhite(rgba, width, height, threshold = 248) {
  if (rgba.length !== width * height * 4) throw new RangeError('invalid RGBA buffer size');
  if (width <= 0 || height <= 0) return rgba;

  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x += 1) stack.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y += 1) stack.push(y * width, y * width + width - 1);

  while (stack.length) {
    const pixel = stack.pop();
    if (seen[pixel]) continue;
    seen[pixel] = 1;
    const offset = pixel * 4;
    const transparent = rgba[offset + 3] === 0;
    const nearWhite = rgba[offset] >= threshold
      && rgba[offset + 1] >= threshold
      && rgba[offset + 2] >= threshold;
    if (!transparent && !nearWhite) continue;

    rgba[offset + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) stack.push(ny * width + nx);
      }
    }
  }

  const interiorSeen = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4;
    const isWhite = rgba[offset + 3] > 0
      && rgba[offset] >= threshold
      && rgba[offset + 1] >= threshold
      && rgba[offset + 2] >= threshold;
    if (!isWhite || interiorSeen[pixel]) continue;

    const component = [];
    const pending = [pixel];
    let darkBoundary = 0;
    let colorBoundary = 0;
    while (pending.length) {
      const current = pending.pop();
      if (interiorSeen[current]) continue;
      const currentOffset = current * 4;
      const currentIsWhite = rgba[currentOffset + 3] > 0
        && rgba[currentOffset] >= threshold
        && rgba[currentOffset + 1] >= threshold
        && rgba[currentOffset + 2] >= threshold;
      if (!currentIsWhite) continue;
      interiorSeen[current] = 1;
      component.push(current);

      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const neighbor = ny * width + nx;
          const neighborOffset = neighbor * 4;
          const neighborIsWhite = rgba[neighborOffset + 3] > 0
            && rgba[neighborOffset] >= threshold
            && rgba[neighborOffset + 1] >= threshold
            && rgba[neighborOffset + 2] >= threshold;
          if (neighborIsWhite) {
            if (!interiorSeen[neighbor]) pending.push(neighbor);
          } else if (rgba[neighborOffset + 3] > 0) {
            const dark = rgba[neighborOffset] < 80
              && rgba[neighborOffset + 1] < 80
              && rgba[neighborOffset + 2] < 80;
            if (dark) darkBoundary += 1;
            else colorBoundary += 1;
          }
        }
      }
    }

    if (component.length >= 32 && darkBoundary > colorBoundary) {
      for (const current of component) rgba[current * 4 + 3] = 0;
    }
  }
  return rgba;
}

const cutoutCache = new Map();

export function loadSpriteCutout(src) {
  if (cutoutCache.has(src)) return cutoutCache.get(src);
  const result = new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        clearConnectedNearWhite(pixels.data, canvas.width, canvas.height);
        context.putImageData(pixels, 0, 0);
        resolve(canvas);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error(`failed to load sprite: ${src}`));
    image.src = src;
  });
  cutoutCache.set(src, result);
  return result;
}
