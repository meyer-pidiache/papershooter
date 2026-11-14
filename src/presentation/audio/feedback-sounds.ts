import { rand } from '../../engine/math.js';
import type { SynthesisPort, SoundPosition } from './contracts.js';
export function hurt(synth: SynthesisPort) {
  synth.tone({ freq: 200, freqEnd: 90, dur: 0.2, gain: 0.35, type: 'sawtooth' });
  synth.noise({ dur: 0.12, gain: 0.3, type: 'lowpass', freq: 500 });
}
export function death(synth: SynthesisPort) {
  synth.tone({ freq: 220, freqEnd: 30, dur: 1.2, gain: 0.4, type: 'sawtooth' });
  synth.noise({ dur: 0.8, gain: 0.35, type: 'lowpass', freq: 800, freqEnd: 80 });
}
export function hitEnemy(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.06, gain: 0.3, type: 'lowpass', freq: 900, pos });
  synth.tone({ freq: rand(200, 260), freqEnd: 120, dur: 0.1, gain: 0.15, type: 'square', pos });
}
export function headshot(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.05, gain: 0.5, type: 'highpass', freq: 3000, pos });
  synth.tone({ freq: 1500, freqEnd: 500, dur: 0.09, gain: 0.2, type: 'triangle', pos });
}
export function kill(synth: SynthesisPort, strong = false) {
  synth.tone({ freq: 880, freqEnd: 880, dur: 0.07, gain: 0.22, type: 'square' });
  synth.tone({ freq: 1320, freqEnd: 1320, dur: 0.16, gain: 0.2, type: 'square', delay: 0.07 });
  synth.tone({ freq: 140, freqEnd: 50, dur: 0.16, gain: strong ? 0.6 : 0.35, type: 'sine' });
  if (strong) synth.tone({ freq: 1760, dur: 0.22, gain: 0.12, type: 'triangle', delay: 0.14 });
}
export function enemyDie(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: rand(160, 220), freqEnd: 40, dur: 0.4, gain: 0.3, type: 'sawtooth', pos });
  synth.noise({ dur: 0.3, gain: 0.4, type: 'lowpass', freq: 600, freqEnd: 100, pos });
  synth.noise({ dur: 0.12, gain: 0.3, type: 'bandpass', freq: 1400, q: 1, pos, delay: 0.03 });
}
export function gib(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.2, gain: 0.45, type: 'lowpass', freq: 500, freqEnd: 120, pos });
  synth.noise({ dur: 0.1, gain: 0.3, type: 'bandpass', freq: 2000, q: 0.8, pos, delay: 0.02 });
}
export function splat(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.08, gain: 0.15, type: 'lowpass', freq: 700, pos });
}
export function spawn(synth: SynthesisPort, pos?: SoundPosition) {
  for (let i = 0; i < 5; i++)
    synth.noise({
      dur: 0.04,
      gain: 0.25,
      type: 'bandpass',
      freq: rand(2500, 5000),
      q: 2,
      pos,
      delay: i * 0.05,
    });
}
export function bulletImpact(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.05, gain: 0.25, type: 'highpass', freq: 1500, pos });
}
export function ricochet(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: rand(2000, 3500), freqEnd: 800, dur: 0.15, gain: 0.12, type: 'sine', pos });
}
export function pickup(synth: SynthesisPort) {
  synth.tone({ freq: 700, freqEnd: 1100, dur: 0.1, gain: 0.2, type: 'triangle' });
  synth.tone({ freq: 1100, freqEnd: 1500, dur: 0.15, gain: 0.2, type: 'triangle', delay: 0.09 });
}
export function wave(synth: SynthesisPort) {
  const notes = [440, 554, 659, 880];
  notes.forEach((f, i) =>
    synth.tone({ freq: f, dur: 0.22, gain: 0.18, type: 'triangle', delay: i * 0.11 }),
  );
}
export function waveClear(synth: SynthesisPort) {
  const notes = [659, 880, 1108, 1318];
  notes.forEach((f, i) =>
    synth.tone({ freq: f, dur: 0.3, gain: 0.16, type: 'triangle', delay: i * 0.13 }),
  );
}
export function tick(synth: SynthesisPort) {
  synth.noise({ dur: 0.02, gain: 0.2, type: 'highpass', freq: 4000 });
}
export function hitstop(synth: SynthesisPort) {
  synth.tone({ freq: 60, dur: 0.1, gain: 0.3, type: 'sine' });
}
export function switchWeapon(synth: SynthesisPort) {
  synth.noise({ dur: 0.05, gain: 0.25, type: 'bandpass', freq: 1800, q: 1.5 });
}
export function heartbeat(synth: SynthesisPort) {
  synth.tone({ freq: 55, dur: 0.15, gain: 0.35, type: 'sine' });
  synth.tone({ freq: 50, dur: 0.12, gain: 0.25, type: 'sine', delay: 0.18 });
}
export function explosion(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.7, gain: 0.9, type: 'lowpass', freq: 900, freqEnd: 60, pos });
  synth.tone({ freq: 80, freqEnd: 25, dur: 0.6, gain: 0.7, type: 'triangle', pos });
  synth.noise({ dur: 0.15, gain: 0.4, type: 'bandpass', freq: 3000, q: 0.7, pos });
}
export function fuse(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.12, gain: 0.25, type: 'highpass', freq: 5000, pos });
}
export function flyerDive(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: 900, freqEnd: 300, dur: 0.35, gain: 0.2, type: 'sawtooth', pos });
  synth.noise({ dur: 0.3, gain: 0.15, type: 'bandpass', freq: 2500, freqEnd: 800, q: 1, pos });
}
export function flyerBuzz(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: rand(380, 460), dur: 0.14, gain: 0.05, type: 'sawtooth', pos });
}
export function stomp(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.4, gain: 0.8, type: 'lowpass', freq: 400, freqEnd: 60, pos });
  synth.tone({ freq: 60, freqEnd: 25, dur: 0.5, gain: 0.7, type: 'sine', pos });
}
export function bossRoar(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: 90, freqEnd: 60, dur: 0.9, gain: 0.5, type: 'sawtooth', pos });
  synth.noise({ dur: 0.8, gain: 0.4, type: 'bandpass', freq: 500, q: 0.8, pos });
}
export function shieldHit(synth: SynthesisPort, pos?: SoundPosition) {
  synth.tone({ freq: rand(600, 800), freqEnd: 300, dur: 0.12, gain: 0.2, type: 'square', pos });
  synth.noise({ dur: 0.05, gain: 0.3, type: 'highpass', freq: 3000, pos });
}
export function airdrop(synth: SynthesisPort) {
  synth.tone({ freq: 660, dur: 0.15, gain: 0.15, type: 'triangle' });
  synth.tone({ freq: 880, dur: 0.2, gain: 0.15, type: 'triangle', delay: 0.15 });
}
export function crateLand(synth: SynthesisPort, pos?: SoundPosition) {
  synth.noise({ dur: 0.3, gain: 0.6, type: 'lowpass', freq: 500, freqEnd: 80, pos });
}
export function smash(synth: SynthesisPort, pos?: SoundPosition, big = false) {
  synth.noise({
    dur: big ? 0.28 : 0.14,
    gain: big ? 0.7 : 0.45,
    type: 'lowpass',
    freq: big ? 900 : 1600,
    freqEnd: 200,
    pos,
  });
  synth.noise({ dur: 0.05, gain: 0.35, type: 'highpass', freq: 3500, pos });
  synth.tone({ freq: big ? 120 : 220, freqEnd: 60, dur: 0.12, gain: 0.25, type: 'triangle', pos });
}
