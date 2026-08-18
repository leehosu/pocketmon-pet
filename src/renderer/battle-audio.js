// AI-GENERATED: pret/pokegold의 3채널 야생·트레이너 배틀 악보를 Web Audio로 재생한다.
import { JOHTO_TRAINER_BATTLE, JOHTO_WILD_BATTLE } from './pokegold-battle-music-data.js';

const MASTER_VOLUME = 0.24;
const INTRO_URL = new URL('./assets/audio/johto-wild-battle-intro.wav', import.meta.url).href;
const LOOP_URL = new URL('./assets/audio/johto-wild-battle-loop.wav', import.meta.url).href;
const TRAINER_INTRO_URL = new URL('./assets/audio/johto-trainer-battle-intro.wav', import.meta.url).href;
const TRAINER_LOOP_URL = new URL('./assets/audio/johto-trainer-battle-loop.wav', import.meta.url).href;
const RUN_URL = new URL('./assets/audio/battle-run.wav', import.meta.url).href;

export function midiToFrequency(note) {
  return 440 * Math.pow(2, (Number(note) - 69) / 12);
}

export function battleMusicInfo(kind = 'wild') {
  const score = kind === 'trainer' ? JOHTO_TRAINER_BATTLE : JOHTO_WILD_BATTLE;
  return {
    source: score.source,
    tempo: score.tempo,
    introFrames: score.channels.map((channel) => channel.introFrames),
    loopFrames: score.channels.map((channel) => channel.loopFrames),
  };
}

export function createBattleMusic({
  AudioClass = globalThis.Audio,
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  let context = null;
  let master = null;
  let introAudio = null;
  let loopAudio = null;
  let runAudio = null;
  let running = false;
  let muted = false;
  let victoryPlayed = false;
  let musicKind = null;

  function ensureContext() {
    if (context || !AudioContextClass) return Boolean(context);
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(context.destination);
    return true;
  }

  function ensurePlayers(kind = 'wild') {
    if (introAudio && loopAudio && runAudio) return true;
    if (!AudioClass) return false;
    musicKind = kind === 'trainer' ? 'trainer' : 'wild';
    introAudio = new AudioClass(musicKind === 'trainer' ? TRAINER_INTRO_URL : INTRO_URL);
    loopAudio = new AudioClass(musicKind === 'trainer' ? TRAINER_LOOP_URL : LOOP_URL);
    runAudio = new AudioClass(RUN_URL);
    introAudio.preload = 'auto';
    loopAudio.preload = 'auto';
    runAudio.preload = 'auto';
    introAudio.volume = 0.8;
    loopAudio.volume = 0.8;
    runAudio.volume = 0.9;
    loopAudio.loop = true;
    introAudio.muted = muted;
    loopAudio.muted = muted;
    introAudio.addEventListener('ended', () => {
      if (!running) return;
      loopAudio.currentTime = 0;
      loopAudio.play().catch(() => { running = false; });
    });
    return true;
  }

  function pulse(note, at, duration, volume, type = 'square') {
    if (note == null || !context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(midiToFrequency(note), at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.015);
  }

  async function start(kind = 'wild') {
    if (!ensurePlayers(kind) || victoryPlayed) return false;
    if (running && (!introAudio.paused || !loopAudio.paused)) return true;
    running = true;
    introAudio.currentTime = 0;
    loopAudio.pause();
    loopAudio.currentTime = 0;
    try {
      await introAudio.play();
      return true;
    } catch {
      running = false;
      return false;
    }
  }

  function stopLoop() {
    running = false;
    for (const audio of [introAudio, loopAudio]) {
      if (!audio) continue;
      audio.pause();
      audio.currentTime = 0;
    }
  }

  async function playRun() {
    stopLoop();
    if (!ensurePlayers()) return false;
    runAudio.currentTime = 0;
    runAudio.muted = false;
    try {
      await runAudio.play();
      return true;
    } catch {
      return false;
    }
  }

  async function playVictory() {
    if (victoryPlayed || !ensureContext()) return;
    victoryPlayed = true;
    stopLoop();
    try { await context.resume(); } catch { return; }
    const at = context.currentTime + 0.04;
    [72, 76, 79, 84].forEach((note, index) => {
      pulse(note, at + index * 0.12, 0.18, 0.065);
    });
    pulse(72, at + 0.5, 0.5, 0.045, 'triangle');
    pulse(76, at + 0.5, 0.5, 0.04, 'triangle');
    pulse(79, at + 0.5, 0.5, 0.04, 'triangle');
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (introAudio) introAudio.muted = muted;
    if (loopAudio) loopAudio.muted = muted;
    if (master && context) {
      master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, context.currentTime, 0.02);
    }
  }

  function stop() {
    stopLoop();
    if (runAudio) {
      runAudio.pause();
      runAudio.currentTime = 0;
    }
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }

  return {
    start, stopLoop, playVictory, playRun, setMuted, stop,
    isMuted: () => muted,
    isPlaying: () => running,
    kind: () => musicKind,
  };
}
