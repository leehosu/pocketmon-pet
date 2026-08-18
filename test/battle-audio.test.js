// AI-GENERATED: 원본 포켓몬 골드 배틀 음악과 도주음 변환을 회귀 검증한다.
import { describe, expect, it } from 'vitest';
import {
  battleMusicInfo, createBattleMusic, midiToFrequency,
} from '../src/renderer/battle-audio.js';
import { JOHTO_WILD_BATTLE } from '../src/renderer/pokegold-battle-music-data.js';

describe('battle chiptune sequence', () => {
  it('converts MIDI A4 to 440 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 8);
  });

  it('uses the Pokemon Gold Johto wild battle score', () => {
    expect(battleMusicInfo()).toEqual({
      source: 'pret/pokegold audio/music/johtowildbattle.asm',
      tempo: 104,
      introFrames: [780, 780, 780],
      loopFrames: [2184, 2184, 2184],
    });
  });

  it('uses the original Johto trainer score for trainer battles', () => {
    expect(battleMusicInfo('trainer')).toEqual({
      source: 'pret/pokegold audio/music/johtotrainerbattle.asm',
      tempo: 102,
      introFrames: [765, 765, 765],
      loopFrames: [5928, 5928, 5928],
    });
  });

  it('keeps the original three-channel opening notes', () => {
    expect(JOHTO_WILD_BATTLE.channels.map((channel) => (
      channel.intro.slice(0, 4).map(([note]) => note)
    ))).toEqual([
      [60, 59, 58, 57],
      [65, 66, 67, 79],
      [67, 74, 67, 73],
    ]);
  });

  it('keeps the original Pokemon Gold run sound effect', () => {
    expect(JOHTO_WILD_BATTLE.runSfx).toEqual({
      source: 'pret/pokegold audio/sfx.asm Sfx_Run_Ch8',
      channel: 8,
      noiseNotes: [
        [2, 6, 1, 35], [2, 10, 1, 51], [2, 12, 1, 51], [2, 5, 1, 17],
        [2, 15, 1, 51], [2, 4, 1, 17], [2, 12, 1, 51], [2, 3, 1, 17],
        [2, 8, 1, 51], [2, 3, 1, 17], [8, 4, 1, 51],
      ],
    });
  });

  it('plays the rendered intro and continues with the looping track', async () => {
    const players = [];
    class FakeAudio {
      constructor(src) {
        this.src = src;
        this.paused = true;
        this.currentTime = 0;
        this.listeners = {};
        players.push(this);
      }
      addEventListener(name, callback) { this.listeners[name] = callback; }
      async play() { this.paused = false; }
      pause() { this.paused = true; }
    }
    const music = createBattleMusic({ AudioClass: FakeAudio, AudioContextClass: null });
    expect(await music.start()).toBe(true);
    expect(players).toHaveLength(3);
    expect(players[0].src).toContain('johto-wild-battle-intro.wav');
    expect(players[1].loop).toBe(true);
    expect(players[2].src).toContain('battle-run.wav');
    players[0].paused = true;
    players[0].listeners.ended();
    await Promise.resolve();
    expect(players[1].paused).toBe(false);
    expect(await music.playRun()).toBe(true);
    expect(players[1].paused).toBe(true);
    expect(players[2].paused).toBe(false);

    const trainerPlayers = [];
    class TrainerAudio extends FakeAudio {
      constructor(src) {
        super(src);
        trainerPlayers.push(this);
      }
    }
    const trainerMusic = createBattleMusic({ AudioClass: TrainerAudio, AudioContextClass: null });
    expect(await trainerMusic.start('trainer')).toBe(true);
    expect(trainerPlayers[0].src).toContain('johto-trainer-battle-intro.wav');
    expect(trainerPlayers[1].src).toContain('johto-trainer-battle-loop.wav');
    expect(trainerMusic.kind()).toBe('trainer');
  });
});
