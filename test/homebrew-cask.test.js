// AI-GENERATED: 릴리스 DMG와 Homebrew Cask 사이의 버전·체크섬 계약을 검증한다.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Homebrew Cask generator', () => {
  it('uses the release version, immutable checksum, and expected app artifact', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pocketmon-cask-'));
    const dmg = join(dir, 'Pocketmon-Pet-1.2.3-universal.dmg');
    const output = join(dir, 'pocketmon-pet.rb');
    const bytes = Buffer.from('fixture dmg');
    writeFileSync(dmg, bytes);

    execFileSync(process.execPath, [
      'scripts/generate-homebrew-cask.mjs', 'v1.2.3', dmg, output,
    ], { stdio: 'pipe' });

    const cask = readFileSync(output, 'utf8');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    expect(cask).toContain('cask "pocketmon-pet" do');
    expect(cask).toContain('version "1.2.3"');
    expect(cask).toContain(`sha256 "${checksum}"`);
    expect(cask).toContain('Pocketmon-Pet-#{version}-universal.dmg');
    expect(cask).toContain('app "Pocketmon Pet.app"');
  });

  it('rejects a tag that is not a semantic version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pocketmon-cask-invalid-'));
    const dmg = join(dir, 'fixture.dmg');
    writeFileSync(dmg, 'fixture');
    expect(() => execFileSync(process.execPath, [
      'scripts/generate-homebrew-cask.mjs', 'latest', dmg, join(dir, 'cask.rb'),
    ], { stdio: 'pipe' })).toThrow();
  });
});
