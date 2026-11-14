import { rand } from '../../engine/math.js';
import type { SynthesisPort, SoundPosition } from './contracts.js';
export function winded(synth: SynthesisPort) {
  synth.tone({ freq: 220, freqEnd: 140, dur: 0.14, gain: 0.1, type: 'triangle' });
}
export function grappleFire(synth: SynthesisPort) {
  synth.noise({ dur: 0.1, gain: 0.4, type: 'highpass', freq: 1500 });
  synth.tone({ freq: 500, freqEnd: 1500, dur: 0.18, gain: 0.18, type: 'sawtooth' });
}
export function grappleHit(synth: SynthesisPort) {
  synth.noise({ dur: 0.04, gain: 0.45, type: 'highpass', freq: 2000 });
  synth.tone({ freq: 300, freqEnd: 200, dur: 0.08, gain: 0.25, type: 'square' });
}
export function grappleRelease(synth: SynthesisPort) {
  synth.tone({ freq: 900, freqEnd: 300, dur: 0.12, gain: 0.12, type: 'sawtooth' });
}
export function footstep(synth: SynthesisPort, speedFrac = 1) {
  synth.noise({ dur: 0.07, gain: 0.12 * speedFrac, type: 'lowpass', freq: rand(400, 800) });
}
export function jump(synth: SynthesisPort) {
  synth.tone({ freq: 260, freqEnd: 480, dur: 0.1, gain: 0.1, type: 'triangle' });
  synth.noise({ dur: 0.05, gain: 0.1, type: 'lowpass', freq: 600 });
}
export function land(synth: SynthesisPort, hard = 0.5) {
  synth.noise({ dur: 0.14, gain: 0.15 + 0.35 * hard, type: 'lowpass', freq: 350 });
}
export function slide(synth: SynthesisPort) {
  synth.noise({ dur: 0.45, gain: 0.18, type: 'lowpass', freq: 1200, freqEnd: 300 });
}
export function wallJump(synth: SynthesisPort) {
  synth.noise({ dur: 0.08, gain: 0.25, type: 'lowpass', freq: 700 });
  synth.tone({ freq: 300, freqEnd: 600, dur: 0.12, gain: 0.12, type: 'triangle' });
}
export function mantle(synth: SynthesisPort) {
  synth.noise({ dur: 0.2, gain: 0.2, type: 'lowpass', freq: 900, freqEnd: 300 });
}
export function dash(synth: SynthesisPort) {
  synth.noise({ dur: 0.25, gain: 0.3, type: 'bandpass', freq: 800, freqEnd: 2500, q: 1 });
}
export function lunge(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: 200, freqEnd: 700, dur: 0.3, gain: 0.25, type: 'sawtooth', pos });
}
