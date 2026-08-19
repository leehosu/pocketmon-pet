// AI-GENERATED: 앱에 이미 쓰는 16×16 포켓볼 트레이 아이콘을 패키징용 PNG로 만든다.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(repoRoot, 'build');
const outputPng = join(outputDir, 'icon.png');
const sourceBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAS0lEQVR4nGNgoDYQERH5jw8TrfmZjQ0KJmgILo24DCJLM05DCPmbYHhQxYCvX7+ShAehAaQYgjMQyTaAFEOISo3YDCIrP5CcmcgBACPIn+yKwOQDAAAAAElFTkSuQmCC';
const tempRoot = mkdtempSync(join(tmpdir(), 'pocketmon-pet-icon-'));
const source = join(tempRoot, 'source.png');

try {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(source, Buffer.from(sourceBase64, 'base64'));
  execFileSync('/usr/bin/sips', ['-z', '1024', '1024', source, '--out', outputPng], { stdio: 'ignore' });
  console.log(`Generated ${outputPng}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
