import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compactEventsFile, EVENTS_COMPACT_BYTES } from '../src/core/events-log.js';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pkmn-events-')); });

function writeLog(lines) {
  const file = join(dir, 'events.jsonl');
  writeFileSync(file, lines.map((l) => JSON.stringify(l) + '\n').join(''));
  return file;
}

describe('compactEventsFile', () => {
  it('does nothing below the threshold', () => {
    const file = writeLog([{ id: 'a', kind: 'toolUse', ts: 1 }]);
    const before = readFileSync(file, 'utf8');
    expect(compactEventsFile(file, 10)).toBe(10);
    expect(readFileSync(file, 'utf8')).toBe(before);
  });

  it('drops the consumed prefix and keeps the unconsumed tail', () => {
    const consumed = JSON.stringify({ id: 'old', kind: 'toolUse', ts: 1 }) + '\n';
    const pad = consumed.repeat(Math.ceil(20 / consumed.length) * 1); // 앞부분(소비분)
    const tail = JSON.stringify({ id: 'new', kind: 'sessionStart', ts: 2 }) + '\n';
    const file = join(dir, 'events.jsonl');
    writeFileSync(file, pad + tail);

    const next = compactEventsFile(file, pad.length, /* threshold */ 1);
    expect(next).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(tail);
    expect(existsSync(file + '.compact')).toBe(false); // tmp는 rename으로 사라짐
  });

  it('leaves an empty file when everything was consumed', () => {
    const body = JSON.stringify({ id: 'a', kind: 'toolUse', ts: 1 }) + '\n';
    const file = join(dir, 'events.jsonl');
    writeFileSync(file, body);
    expect(compactEventsFile(file, body.length, 1)).toBe(0);
    expect(statSync(file).size).toBe(0);
  });

  it('keeps the offset when the file already shrank (rotation)', () => {
    const file = writeLog([{ id: 'a', kind: 'toolUse', ts: 1 }]);
    const offset = statSync(file).size + 500; // 파일이 offset보다 작아진 상황
    expect(compactEventsFile(file, offset, 1)).toBe(offset);
  });

  it('keeps the offset when the file is missing', () => {
    expect(compactEventsFile(join(dir, 'nope.jsonl'), 5000, 1)).toBe(5000);
  });

  it('actually bounds a log that grew past the real threshold', () => {
    const line = JSON.stringify({ id: 'x', kind: 'toolUse', ts: 1 }) + '\n';
    const times = Math.ceil((EVENTS_COMPACT_BYTES + 1000) / line.length);
    const file = join(dir, 'events.jsonl');
    writeFileSync(file, line.repeat(times));
    const grown = statSync(file).size;
    expect(grown).toBeGreaterThan(EVENTS_COMPACT_BYTES);

    // 마지막 한 줄만 아직 소비되지 않은 상태
    expect(compactEventsFile(file, grown - line.length)).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe(line);
  });
});
