import { Vector3 } from 'three';
import { clamp } from '../../engine/math.js';
import type { NoiseOptions, ToneOptions, SoundPosition } from './contracts.js';
export class SoundSynth {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  comp: DynamicsCompressorNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  volume = 0.55;
  listenerPos = new Vector3();
  listenerRight = new Vector3(1, 0, 0);
  init() {
    if (this.ctx) return;
    const AC =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.ratio.value = 5;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.comp);
    this.comp.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended')
      void this.ctx.resume().catch(() => {
        // Autoplay policy may still require another user gesture; keep the context for retry.
      });
  }
  setListener(pos: SoundPosition, right: SoundPosition) {
    this.listenerPos.copy(pos);
    this.listenerRight.copy(right);
  }
  _out(pos?: SoundPosition | null, base = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.master) throw new Error('Audio is not initialized');
    const g = ctx.createGain();
    let vol = base;
    if (pos) {
      const dx = pos.x - this.listenerPos.x,
        dy = pos.y - this.listenerPos.y,
        dz = pos.z - this.listenerPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      vol *= 1 / (1 + dist * 0.09);
      if (dist > 0.5 && ctx.createStereoPanner) {
        const pan =
          clamp((dx * this.listenerRight.x + dz * this.listenerRight.z) / dist, -1, 1) * 0.75;
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        g.gain.value = vol;
        g.connect(p);
        p.connect(this.master);
        return g;
      }
    }
    g.gain.value = vol;
    g.connect(this.master);
    return g;
  }
  noise({
    dur = 0.1,
    gain = 0.5,
    type = 'lowpass',
    freq = 1000,
    freqEnd = null,
    q = 1,
    attack = 0.002,
    pos = null,
    delay = 0,
    hp = 0,
    at,
  }: NoiseOptions) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = at !== undefined ? at : ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.loopEnd = 2;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    let last = f;
    if (hp > 0) {
      const h = ctx.createBiquadFilter();
      h.type = 'highpass';
      h.frequency.value = hp;
      last.connect(h);
      last = h;
    }
    last.connect(env);
    env.connect(this._out(pos));
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }
  tone({
    freq = 440,
    freqEnd = null,
    dur = 0.2,
    gain = 0.3,
    type = 'sine',
    attack = 0.005,
    pos = null,
    delay = 0,
    at,
    out,
  }: ToneOptions) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = at !== undefined ? at : ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(env);
    env.connect(out || this._out(pos));
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  noiseAt(
    t0: number,
    dur: number,
    gain: number,
    type: BiquadFilterType,
    freq: number,
    out: AudioNode,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.loopEnd = 2;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(gain, t0 + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(env);
    env.connect(out);
    src.start(t0, Math.random() * 1.5);
    src.stop(t0 + dur + 0.05);
  }
  dispose() {
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
    this.noiseBuf = null;
    this.master = null;
    this.comp = null;
  }
}
