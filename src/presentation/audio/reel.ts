import type { AudioOutputPort } from './contracts.js';

// Owns the one continuous grapple sound; stopped sources finish their fade in Web Audio.
export class ReelSound {
  private active: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  constructor(private readonly output: AudioOutputPort) {}
  get playing() {
    return this.active !== null;
  }
  setPlaying(on: boolean) {
    const { ctx, master, noiseBuf } = this.output;
    if (!ctx || !master) return;
    if (on && !this.active) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuf;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 380;
      filter.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.12);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
      this.active = source;
      this.gain = gain;
    } else if (!on && this.active) {
      this.gain!.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      this.active.stop(ctx.currentTime + 0.3);
      this.active = null;
      this.gain = null;
    }
  }
  dispose() {
    this.setPlaying(false);
  }
}
