// AI-GENERATED: pret/pokegold의 야생·트레이너 배틀 악보를 브라우저용 음표 시퀀스로 변환한다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.argv[2] || '/tmp/pokegold');
const wildSourcePath = join(sourceRoot, 'audio/music/johtowildbattle.asm');
const trainerSourcePath = join(sourceRoot, 'audio/music/johtotrainerbattle.asm');
const sfxPath = join(sourceRoot, 'audio/sfx.asm');
const outputPath = join(repoRoot, 'src/renderer/pokegold-battle-music-data.js');
const audioDir = join(repoRoot, 'src/renderer/assets/audio');
const wildSource = readFileSync(wildSourcePath, 'utf8');
const trainerSource = readFileSync(trainerSourcePath, 'utf8');
const sfxSource = readFileSync(sfxPath, 'utf8');

const PITCH = Object.freeze({
  C_: 0, 'C#': 1, D_: 2, 'D#': 3, E_: 4, F_: 5,
  'F#': 6, G_: 7, 'G#': 8, A_: 9, 'A#': 10, B_: 11,
});
const SUPPORTED = new Set([
  'duty_cycle', 'note', 'note_type', 'octave', 'pitch_offset', 'rest',
  'sound_call', 'sound_loop', 'sound_ret', 'tempo', 'vibrato', 'volume',
  'volume_envelope',
]);

function splitArgs(value = '') {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function number(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`숫자가 아닌 악보 값: ${value}`);
  return parsed;
}

function parseInstructions(source) {
  const labels = new Map();
  const instructions = [];
  let scope = null;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const label = line.match(/^([A-Za-z_][A-Za-z0-9_]*|\.[A-Za-z0-9_]+):$/);
    if (label) {
      if (!label[1].startsWith('.')) scope = label[1];
      if (!scope) throw new Error(`범위 없는 로컬 라벨: ${label[1]}`);
      labels.set(label[1].startsWith('.') ? `${scope}${label[1]}` : label[1], instructions.length);
      continue;
    }
    const command = line.match(/^([a-z_]+)(?:\s+(.*))?$/i);
    if (!command || !SUPPORTED.has(command[1])) continue;
    instructions.push({ op: command[1], args: splitArgs(command[2]), scope });
  }
  return { labels, instructions };
}

function parseRunSfx() {
  const body = sfxSource.match(/Sfx_Run_Ch8:\s*([\s\S]*?)\bsound_ret\b/)?.[1];
  if (!body) throw new Error('Sfx_Run_Ch8을 찾을 수 없습니다');
  const noiseNotes = [...body.matchAll(
    /noise_note\s+(\d+)\s*,\s*(\d+)\s*,\s*(-?\d+)\s*,\s*(\d+)/g,
  )].map((match) => match.slice(1).map(number));
  if (!noiseNotes.length) throw new Error('Sfx_Run_Ch8에 noise_note가 없습니다');
  return {
    source: 'pret/pokegold audio/sfx.asm Sfx_Run_Ch8',
    channel: 8,
    noiseNotes,
  };
}

function targetIndex(instruction, target, labels) {
  const name = target.startsWith('.') ? `${instruction.scope}${target}` : target;
  const index = labels.get(name);
  if (index == null) throw new Error(`찾을 수 없는 악보 라벨: ${name}`);
  return index;
}

function compileChannel(name, wave, parsed, initialTempo) {
  const { labels, instructions } = parsed;
  let pc = labels.get(name);
  if (pc == null) throw new Error(`채널이 없습니다: ${name}`);
  const mainLoop = labels.get(`${name}.mainloop`);
  const calls = [];
  const loopCounts = new Map();
  const events = [];
  let loopEventIndex = null;
  let tempo = initialTempo;
  let noteLength = 12;
  let octave = 4;
  let volume = wave === 'triangle' ? 1 : 12;
  let duty = 3;
  let durationRemainder = 0;
  let guard = 0;

  while (guard < 20_000) {
    guard += 1;
    if (pc === mainLoop && loopEventIndex == null && calls.length === 0) loopEventIndex = events.length;
    const instruction = instructions[pc];
    if (!instruction) throw new Error(`${name}: 악보가 예기치 않게 끝났습니다`);
    const { op, args } = instruction;

    if (op === 'note_type') {
      noteLength = number(args[0]);
      if (args[1] != null) volume = number(args[1]);
    } else if (op === 'octave') {
      octave = number(args[0]);
    } else if (op === 'volume_envelope') {
      volume = number(args[0]);
    } else if (op === 'duty_cycle') {
      duty = number(args[0]);
    } else if (op === 'tempo') {
      tempo = number(args[0]);
    } else if (op === 'note' || op === 'rest') {
      const length = number(op === 'rest' ? args[0] : args[1]);
      const rawFrames = durationRemainder + noteLength * length * tempo;
      const frames = Math.max(1, Math.floor(rawFrames / 256));
      durationRemainder = rawFrames % 256;
      const midi = op === 'rest' ? null : 12 * (octave + 1) + PITCH[args[0]];
      if (op === 'note' && !Number.isFinite(midi)) throw new Error(`${name}: 알 수 없는 음 ${args[0]}`);
      events.push([midi, frames, volume, duty]);
    } else if (op === 'sound_call') {
      calls.push(pc + 1);
      pc = targetIndex(instruction, args[0], labels);
      continue;
    } else if (op === 'sound_ret') {
      if (!calls.length) break;
      pc = calls.pop();
      continue;
    } else if (op === 'sound_loop') {
      const count = number(args[0]);
      if (count === 0) {
        if (loopEventIndex == null) throw new Error(`${name}: 메인 루프 시작점을 찾지 못했습니다`);
        break;
      }
      const remaining = loopCounts.has(pc) ? loopCounts.get(pc) : count - 1;
      if (remaining > 0) {
        loopCounts.set(pc, remaining - 1);
        pc = targetIndex(instruction, args[1], labels);
        continue;
      }
      loopCounts.delete(pc);
    }
    pc += 1;
  }

  if (guard >= 20_000) throw new Error(`${name}: 악보 해석 한도를 초과했습니다`);
  const intro = events.slice(0, loopEventIndex);
  const loop = events.slice(loopEventIndex);
  const sumFrames = (items) => items.reduce((sum, event) => sum + event[1], 0);
  return {
    wave,
    intro,
    loop,
    introFrames: sumFrames(intro),
    loopFrames: sumFrames(loop),
  };
}

function compileMusic(source, fileName, label, tempo) {
  const parsed = parseInstructions(source);
  return {
    source: `pret/pokegold audio/music/${fileName}`,
    tempo,
    framesPerSecond: 59.7275,
    runSfx: parseRunSfx(),
    channels: [
      compileChannel(`${label}_Ch1`, 'square', parsed, tempo),
      compileChannel(`${label}_Ch2`, 'square', parsed, tempo),
      compileChannel(`${label}_Ch3`, 'triangle', parsed, tempo),
    ],
  };
}

const music = compileMusic(wildSource, 'johtowildbattle.asm', 'Music_JohtoWildBattle', 104);
const trainerMusic = compileMusic(trainerSource, 'johtotrainerbattle.asm', 'Music_JohtoTrainerBattle', 102);

function waveform(type, phase) {
  if (type === 'triangle') return 1 - 4 * Math.abs(Math.round(phase) - phase);
  return (phase % 1) < 0.25 ? 1 : -1;
}

function renderWav(score, fileName, sequenceKey) {
  const sampleRate = 22_050;
  const totalFrames = score.channels[0][`${sequenceKey}Frames`];
  const sampleCount = Math.ceil(totalFrames / score.framesPerSecond * sampleRate);
  const mix = new Float64Array(sampleCount);

  for (const channel of score.channels) {
    let startsAt = 0;
    for (const [note, frames, envelope] of channel[sequenceKey]) {
      const duration = frames / score.framesPerSecond;
      const startSample = Math.round(startsAt * sampleRate);
      const endSample = Math.min(sampleCount, Math.round((startsAt + duration) * sampleRate));
      if (note != null) {
        const frequency = 440 * 2 ** ((note - 69) / 12);
        const baseVolume = channel.wave === 'triangle'
          ? 0.13
          : 0.18 * Math.max(0.25, Math.min(1, envelope / 15));
        for (let sample = startSample; sample < endSample; sample += 1) {
          const localTime = (sample - startSample) / sampleRate;
          const remaining = (endSample - sample) / sampleRate;
          const edge = Math.min(1, localTime / 0.004, remaining / 0.012);
          mix[sample] += waveform(channel.wave, localTime * frequency) * baseVolume * edge;
        }
      }
      startsAt += duration;
    }
  }

  let peak = 0;
  for (const sample of mix) peak = Math.max(peak, Math.abs(sample));
  const scale = peak > 0 ? 0.88 / peak : 1;
  const wav = Buffer.alloc(44 + sampleCount * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + sampleCount * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(sampleCount * 2, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const value = Math.max(-1, Math.min(1, mix[index] * scale));
    wav.writeInt16LE(Math.round(value * 32_767), 44 + index * 2);
  }
  writeFileSync(join(audioDir, fileName), wav);
}

function renderRunWav() {
  const sampleRate = 44_100;
  const oversample = 16;
  const frameSeconds = 1 / music.framesPerSecond;
  const totalFrames = music.runSfx.noiseNotes.reduce((sum, note) => sum + note[0] + 1, 0);
  const sampleCount = Math.ceil(totalFrames * frameSeconds * sampleRate);
  const wav = Buffer.alloc(44 + sampleCount * 2);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + sampleCount * 2, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(sampleCount * 2, 40);
  let outputSample = 0;
  for (const [length, initialVolume, envelope, register] of music.runSfx.noiseNotes) {
    const noteSamples = Math.round((length + 1) * frameSeconds * sampleRate);
    const divisorCode = register & 0b111;
    const divisor = divisorCode === 0 ? 0.5 : divisorCode;
    const shift = register >> 4;
    const width7 = Boolean(register & 0b1000);
    const noiseClock = 262_144 / divisor / 2 ** shift;
    let lfsr = 0x7fff;
    let clockPhase = 0;

    for (let noteSample = 0; noteSample < noteSamples && outputSample < sampleCount; noteSample += 1) {
      let value = 0;
      for (let subSample = 0; subSample < oversample; subSample += 1) {
        clockPhase += noiseClock / (sampleRate * oversample);
        while (clockPhase >= 1) {
          const feedback = (lfsr ^ (lfsr >> 1)) & 1;
          lfsr = (lfsr >> 1) | (feedback << 14);
          if (width7) lfsr = (lfsr & ~(1 << 6)) | (feedback << 6);
          clockPhase -= 1;
        }
        value += (lfsr & 1) === 0 ? 1 : -1;
      }
      const localTime = noteSample / sampleRate;
      const envelopeSteps = envelope === 0 ? 0 : Math.floor(localTime * 64 / Math.abs(envelope));
      const volume = Math.max(0, Math.min(15,
        initialVolume + (envelope < 0 ? envelopeSteps : -envelopeSteps),
      ));
      const edge = Math.min(1, localTime / 0.0015);
      const sampleValue = value / oversample * volume / 15 * 0.88 * edge;
      wav.writeInt16LE(Math.round(sampleValue * 32_767), 44 + outputSample * 2);
      outputSample += 1;
    }
  }
  writeFileSync(join(audioDir, 'battle-run.wav'), wav);
}

const output = `// AI-GENERATED: pret/pokegold 배틀 음악과 SFX에서 생성. 직접 수정하지 않는다.\n`
  + `export const JOHTO_WILD_BATTLE = ${JSON.stringify(music)};\n`
  + `export const JOHTO_TRAINER_BATTLE = ${JSON.stringify(trainerMusic)};\n`;
writeFileSync(outputPath, output);
mkdirSync(audioDir, { recursive: true });
renderWav(music, 'johto-wild-battle-intro.wav', 'intro');
renderWav(music, 'johto-wild-battle-loop.wav', 'loop');
renderWav(trainerMusic, 'johto-trainer-battle-intro.wav', 'intro');
renderWav(trainerMusic, 'johto-trainer-battle-loop.wav', 'loop');
renderRunWav();
console.log(`Generated ${outputPath}`);
