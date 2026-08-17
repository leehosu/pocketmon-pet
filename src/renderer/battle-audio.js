// AI-GENERATED: 저작권 음원 없이 Web Audio로 재생하는 오리지널 8비트 전투 루프.
export const BATTLE_BPM = 156;

const LEAD = Object.freeze([
  76, null, 79, 81, 79, 76, 74, null,
  72, 74, 76, 79, 76, 74, 71, null,
  76, 79, 83, 81, 79, 76, 74, 76,
  72, 74, 71, 69, 71, 74, 76, null,
]);

const BASS = Object.freeze([
  40, null, 40, null, 43, null, 43, null,
  36, null, 36, null, 38, null, 38, null,
  40, null, 40, null, 43, null, 45, null,
  36, null, 38, null, 35, null, 38, null,
]);

export function midiToFrequency(note) {
  return 440 * Math.pow(2, (Number(note) - 69) / 12);
}

export function battleStepAt(index) {
  const step = ((Math.floor(Number(index) || 0) % LEAD.length) + LEAD.length) % LEAD.length;
  return {
    lead: LEAD[step],
    bass: BASS[step],
    kick: step % 4 === 0,
    hat: step % 2 === 1,
  };
}

export function createBattleMusic({
  AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext,
} = {}) {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let timer = null;
  let running = false;
  let muted = false;
  let victoryPlayed = false;
  let nextStepAt = 0;
  let stepIndex = 0;
  const stepDuration = 60 / BATTLE_BPM / 4;

  function ensureContext() {
    if (context || !AudioContextClass) return Boolean(context);
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.14;
    master.connect(context.destination);
    noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.08), context.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i += 1) noise[i] = Math.random() * 2 - 1;
    return true;
  }

  function pulse(note, at, duration, volume, type = 'square') {
    if (note == null || !context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(midiToFrequency(note), at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  function kick(at) {
    if (!context || !master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(105, at);
    oscillator.frequency.exponentialRampToValueAtTime(42, at + 0.09);
    gain.gain.setValueAtTime(0.12, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.1);
    oscillator.connect(gain).connect(master);
    oscillator.start(at);
    oscillator.stop(at + 0.11);
  }

  function hat(at) {
    if (!context || !master || !noiseBuffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 5000;
    gain.gain.setValueAtTime(0.025, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    source.connect(filter).connect(gain).connect(master);
    source.start(at);
    source.stop(at + 0.04);
  }

  function schedule() {
    if (!running || !context) return;
    while (nextStepAt < context.currentTime + 0.12) {
      const step = battleStepAt(stepIndex);
      pulse(step.lead, nextStepAt, stepDuration * 0.78, 0.052);
      pulse(step.bass, nextStepAt, stepDuration * 0.9, 0.042, 'triangle');
      if (step.kick) kick(nextStepAt);
      if (step.hat) hat(nextStepAt);
      nextStepAt += stepDuration;
      stepIndex += 1;
    }
  }

  async function start() {
    if (!ensureContext() || victoryPlayed) return false;
    try { await context.resume(); } catch { return false; }
    if (running) return true;
    running = true;
    nextStepAt = context.currentTime + 0.04;
    stepIndex = 0;
    schedule();
    timer = setInterval(schedule, 25);
    return true;
  }

  function stopLoop() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
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
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.14, context.currentTime, 0.02);
  }

  function stop() {
    stopLoop();
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }

  return { start, stopLoop, playVictory, setMuted, stop, isMuted: () => muted };
}
