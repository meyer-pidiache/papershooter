import { rand } from '../../engine/math.js';
import type { SynthesisPort, SoundPosition } from './contracts.js';
export function shot(synth: SynthesisPort) {
  synth.noise({ dur: 0.17, gain: 0.7, type: 'bandpass', freq: 1200, freqEnd: 250, q: 0.7 });
  synth.noise({ dur: 0.06, gain: 0.45, type: 'highpass', freq: 2800 });
  synth.tone({ freq: 160, freqEnd: 40, dur: 0.15, gain: 0.6, type: 'triangle' });
}
export function remoteShot(synth: SynthesisPort, kind: string, pos?: SoundPosition) {
  if (kind === 'shotgun') {
    synth.noise({ dur: 0.32, gain: 1.0, type: 'lowpass', freq: 1600, freqEnd: 150, pos });
    synth.tone({ freq: 95, freqEnd: 30, dur: 0.26, gain: 0.7, type: 'triangle', pos });
  } else if (kind === 'sniper') {
    synth.noise({ dur: 0.4, gain: 1.0, type: 'bandpass', freq: 750, freqEnd: 120, q: 0.5, pos });
    synth.tone({ freq: 420, freqEnd: 50, dur: 0.32, gain: 0.5, type: 'sawtooth', pos });
  } else {
    synth.noise({
      dur: 0.16,
      gain: 0.85,
      type: 'bandpass',
      freq: rand(1000, 1500),
      freqEnd: 220,
      q: 0.8,
      pos,
    });
    synth.noise({ dur: 0.05, gain: 0.4, type: 'highpass', freq: 2600, pos });
    synth.tone({ freq: 200, freqEnd: 50, dur: 0.12, gain: 0.45, type: 'square', pos });
  }
}
export function enemyShot(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({
    dur: 0.14,
    gain: 0.5,
    type: 'bandpass',
    freq: rand(900, 1500),
    freqEnd: 200,
    q: 0.8,
    pos,
  });
  synth.tone({ freq: 220, freqEnd: 60, dur: 0.1, gain: 0.3, type: 'square', pos });
}
export function shotgun(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.3, gain: 0.7, type: 'lowpass', freq: 1500, freqEnd: 150, pos });
  synth.tone({ freq: 90, freqEnd: 30, dur: 0.25, gain: 0.5, type: 'triangle', pos });
}
export function sniperShot(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.35, gain: 0.7, type: 'bandpass', freq: 700, freqEnd: 120, q: 0.5, pos });
  synth.tone({ freq: 400, freqEnd: 50, dur: 0.3, gain: 0.35, type: 'sawtooth', pos });
}
export function sniperAim(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: 1800, dur: 0.12, gain: 0.12, type: 'sine', pos });
}
export function empty(synth: SynthesisPort) {
  synth.noise({ dur: 0.03, gain: 0.3, type: 'highpass', freq: 3000 });
}
export function reload(synth: SynthesisPort) {
  synth.noise({ dur: 0.04, gain: 0.35, type: 'highpass', freq: 2500 });
  synth.noise({ dur: 0.12, gain: 0.2, type: 'bandpass', freq: 600, q: 2, delay: 0.25 });
  synth.noise({ dur: 0.05, gain: 0.4, type: 'highpass', freq: 2000, delay: 0.9 });
  synth.tone({ freq: 900, freqEnd: 500, dur: 0.06, gain: 0.15, type: 'square', delay: 1.25 });
}
export function katanaSwing(synth: SynthesisPort) {
  synth.noise({ dur: 0.2, gain: 0.35, type: 'bandpass', freq: 500, freqEnd: 3000, q: 1.5 });
}
export function katanaHit(synth: SynthesisPort) {
  synth.noise({ dur: 0.14, gain: 0.6, type: 'lowpass', freq: 900, freqEnd: 200 });
  synth.noise({ dur: 0.1, gain: 0.35, type: 'bandpass', freq: 2500, q: 0.6 });
  synth.tone({ freq: 180, freqEnd: 70, dur: 0.12, gain: 0.4, type: 'triangle' });
}
export function parry(synth: SynthesisPort) {
  for (const f of [2200, 3300, 4700])
    synth.tone({ freq: f, freqEnd: f * 0.92, dur: 0.35, gain: 0.16, type: 'sine' });
  synth.noise({ dur: 0.05, gain: 0.5, type: 'highpass', freq: 4000 });
}
export function perfectParry(synth: SynthesisPort) {
  parry(synth);
  synth.tone({ freq: 880, freqEnd: 1760, dur: 0.25, gain: 0.2, type: 'triangle', delay: 0.03 });
}
export function shotgunFire(synth: SynthesisPort) {
  synth.noise({ dur: 0.32, gain: 0.9, type: 'lowpass', freq: 1800, freqEnd: 120 });
  synth.noise({ dur: 0.08, gain: 0.5, type: 'highpass', freq: 2500 });
  synth.tone({ freq: 110, freqEnd: 30, dur: 0.28, gain: 0.7, type: 'triangle' });
}
export function revolver(synth: SynthesisPort) {
  synth.noise({ dur: 0.22, gain: 0.85, type: 'bandpass', freq: 900, freqEnd: 180, q: 0.6 });
  synth.noise({ dur: 0.05, gain: 0.6, type: 'highpass', freq: 3000 });
  synth.tone({ freq: 200, freqEnd: 35, dur: 0.22, gain: 0.7, type: 'sawtooth' });
  synth.tone({ freq: 2600, freqEnd: 900, dur: 0.12, gain: 0.12, type: 'sine' });
}
export function sniperFire(synth: SynthesisPort) {
  synth.noise({ dur: 0.45, gain: 0.95, type: 'bandpass', freq: 1400, freqEnd: 90, q: 0.5 });
  synth.noise({ dur: 0.07, gain: 0.7, type: 'highpass', freq: 3500 });
  synth.tone({ freq: 260, freqEnd: 30, dur: 0.4, gain: 0.8, type: 'sawtooth' });
  synth.tone({ freq: 1800, freqEnd: 400, dur: 0.5, gain: 0.16, type: 'sine', delay: 0.05 });
}
export function focusIn(synth: SynthesisPort) {
  synth.tone({ freq: 1200, freqEnd: 420, dur: 0.45, gain: 0.3, type: 'sine' });
  synth.noise({ dur: 0.35, gain: 0.2, type: 'bandpass', freq: 2400, freqEnd: 500, q: 1.2 });
}
export function focusSlash(synth: SynthesisPort) {
  synth.noise({ dur: 0.3, gain: 0.55, type: 'bandpass', freq: 600, freqEnd: 4000, q: 1.2 });
  synth.tone({ freq: 180, freqEnd: 60, dur: 0.3, gain: 0.55, type: 'triangle' });
  for (const f of [1600, 2400])
    synth.tone({ freq: f, freqEnd: f * 0.6, dur: 0.35, gain: 0.14, type: 'sine', delay: 0.04 });
}
export function pump(synth: SynthesisPort) {
  synth.noise({ dur: 0.05, gain: 0.35, type: 'bandpass', freq: 1500, q: 1.5 });
  synth.noise({ dur: 0.06, gain: 0.35, type: 'bandpass', freq: 900, q: 1.5, delay: 0.09 });
}
export function shell(synth: SynthesisPort) {
  synth.noise({ dur: 0.04, gain: 0.3, type: 'highpass', freq: 2500 });
  synth.tone({ freq: 1400, freqEnd: 900, dur: 0.05, gain: 0.08, type: 'square' });
}
export function cylinder(synth: SynthesisPort) {
  synth.noise({ dur: 0.05, gain: 0.3, type: 'highpass', freq: 2000 });
  synth.tone({ freq: 700, freqEnd: 400, dur: 0.12, gain: 0.1, type: 'square', delay: 0.05 });
  synth.noise({ dur: 0.06, gain: 0.35, type: 'highpass', freq: 1800, delay: 1.6 });
}
