import { clamp } from '../../engine/math.js';
import type { AudioOutputPort } from './contracts.js';
import { SONG, MEXICO } from './scores.js';
import {
  districtLead,
  districtBass,
  districtArpeggio,
  districtCounter,
  districtDrums,
} from './district-voices.js';
import { mexicoVoices } from './mexico-voices.js';

interface Playback {
  step: number;
  next: number;
  timer: ReturnType<typeof setInterval>;
  output: GainNode;
}

// Owns the clock and playback state. Scores/voices have no timer or facade access.
export class MusicScheduler {
  private playback: Playback | null = null;
  private intensity = 0;
  private tune = '';
  constructor(private readonly synth: AudioOutputPort) {}
  get playing() {
    return this.playback !== null;
  }
  setPlaying(on: boolean) {
    const { ctx, master } = this.synth;
    if (!ctx || !master) return;
    if (on && !this.playback) {
      const output = ctx.createGain();
      output.gain.value = 0.05;
      output.connect(master);
      this.playback = {
        step: 0,
        next: ctx.currentTime + 0.1,
        timer: setInterval(() => this.tick(), 100),
        output,
      };
    } else if (!on && this.playback) {
      clearInterval(this.playback.timer);
      this.playback.output.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      this.playback = null;
    }
  }
  setIntensity(value: number) {
    this.intensity = clamp(value, 0, 1);
  }
  setTune(key: string) {
    if (this.tune === key) return;
    this.tune = key;
    if (this.playback && this.synth.ctx) {
      this.playback.step = 0;
      this.playback.next = this.synth.ctx.currentTime + 0.1;
    }
  }
  tick() {
    const { ctx } = this.synth;
    const playback = this.playback;
    if (!ctx || !playback) return;
    const mexico = this.tune === 'mexico';
    const score = mexico ? MEXICO : SONG;
    const divisions = mexico ? 12 : 16;
    const step = 60 / (mexico ? MEXICO.bpm : 156) / 4;
    // Throttled tabs skip missed notes instead of replaying an unbounded backlog.
    if (playback.next < ctx.currentTime - 0.8) playback.next = ctx.currentTime + 0.05;
    while (playback.next < ctx.currentTime + 0.7) {
      const i = playback.step % score.length;
      const bar = Math.floor(i / divisions);
      const frame = {
        t: playback.next,
        i,
        bar,
        subdivision: i % divisions,
        step,
        chord: score.chord[bar],
        root: score.chord[bar][0],
        out: playback.output,
        intensity: this.intensity,
      };
      if (mexico) mexicoVoices(this.synth, frame);
      else {
        const district = {
          ...frame,
          s16: frame.subdivision,
          sec: SONG.section[bar],
          firstBar: SONG.firstBar[bar],
          lastBar: SONG.lastBar[bar],
        };
        districtLead(this.synth, district);
        districtBass(this.synth, district);
        districtArpeggio(this.synth, district);
        districtCounter(this.synth, district);
        districtDrums(this.synth, district);
      }
      playback.next += step;
      playback.step++;
    }
  }
  dispose() {
    this.setPlaying(false);
  }
}
