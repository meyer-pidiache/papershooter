import type { AudioOutputPort } from './contracts.js';
import { SONG } from './scores.js';
import { midi, type DistrictStep } from './music-contracts.js';
export function districtLead(synth: AudioOutputPort, frame: DistrictStep) {
  const { t, i, step, sec, out } = frame;
  // lead: a pulse with a slightly detuned twin for width, an optional octave shadow, and a dotted-eighth echo in the airy sections
  const n = SONG.lead[i];
  if (n > 0) {
    const dur = SONG.len[i] * step * 0.9,
      f = midi(n);
    synth.tone({ freq: f, dur, gain: 0.1, type: 'square', at: t, out });
    synth.tone({ freq: f * 1.004, dur, gain: 0.04, type: 'square', at: t, out });
    if (sec.shadow)
      synth.tone({ freq: f * 2, dur: dur * 0.7, gain: sec.shadow, type: 'square', at: t, out });
    if (sec.echo) {
      synth.tone({
        freq: f,
        dur: dur * 0.8,
        gain: 0.035,
        type: 'square',
        at: t + step * 3,
        out,
      });
      synth.tone({
        freq: f,
        dur: dur * 0.6,
        gain: 0.012,
        type: 'square',
        at: t + step * 6,
        out,
      });
    }
  }
}
export function districtBass(synth: AudioOutputPort, frame: DistrictStep) {
  const { t, step, sec, out, root, bar, s16 } = frame;
  // bass: each section has its own feel; 'drive' and 'pump' walk toward the next chord on the last eighth
  const b = root - 12;
  let nb = SONG.chord[(bar + 1) % SONG.bars][0] - 12;
  if (nb - b > 6) nb -= 12;
  else if (b - nb > 6) nb += 12;
  const approach = nb === b ? b + 7 : nb + (nb > b ? -1 : 1);
  const bass = (note: number, len: number, gain = 0.16) =>
    synth.tone({ freq: midi(note), dur: step * len, gain, type: 'triangle', at: t, out });
  if (sec.bass === 'bounce') {
    if (s16 % 2 === 0) bass(b + [0, 0, 12, 0, 0, 7, 0, 12][s16 / 2], 1.6);
  } else if (sec.bass === 'drive') {
    if (s16 % 2 === 0)
      bass(s16 === 14 ? approach : s16 === 6 ? b + 12 : s16 === 12 ? b + 7 : b, 1.4, 0.17);
  } else if (sec.bass === 'sparse') {
    if (s16 === 0) bass(b, 6, 0.14);
    else if (s16 === 8) bass(b + 7, 4, 0.12);
  } else if (sec.bass === 'pump') {
    if (s16 === 0 || s16 === 8) bass(b, 2.5);
    else if (s16 === 4) bass(b + 7, 2.5);
    else if (s16 === 12) bass(b + 12, 1.6);
    else if (s16 === 14) bass(approach, 1.4);
  }
}
export function districtArpeggio(synth: AudioOutputPort, frame: DistrictStep) {
  const { t, step, sec, out, root, chord, s16, intensity: I } = frame;
  // arpeggio: chord tones on every sixteenth, quiet
  if (sec.arp) {
    const tones = [root, root + chord[1], root + 7, root + 12];
    synth.tone({
      freq: midi(tones[s16 % 4] + 12),
      dur: step * 0.8,
      gain: 0.03 + I * 0.02,
      type: 'square',
      at: t,
      out,
    });
  }
}
export function districtCounter(synth: AudioOutputPort, frame: DistrictStep) {
  const { t, step, sec, out, root, chord, s16 } = frame;
  // counter voice: a soft triangle answering on the off-beats
  if (sec.counter && s16 % 4 === 2) {
    const tones = [root + 12, root + chord[1] + 12, root + 19, root + chord[1] + 12];
    synth.tone({
      freq: midi(tones[(s16 - 2) / 4]),
      dur: step * 1.5,
      gain: 0.06,
      type: 'triangle',
      at: t,
      out,
    });
  }
}
export function districtDrums(synth: AudioOutputPort, frame: DistrictStep) {
  const { t, sec, out, firstBar, lastBar, s16, bar, intensity: I } = frame;
  // drums: a splash on each new section, a rising snare fill into the next one, otherwise the section's own groove
  const D = sec.drums;
  if (firstBar && s16 === 0) synth.noiseAt(t, 0.4, 0.14, 'highpass', 5000, out);
  if (lastBar && s16 >= 12)
    synth.noiseAt(t, 0.08, 0.12 + (s16 - 12) * 0.05, 'bandpass', 1800 + (s16 - 12) * 350, out);
  else {
    const kick =
      D === 'driving'
        ? s16 % 4 === 0
        : D === 'sparse'
          ? s16 === 0
          : s16 === 0 ||
            s16 === 8 ||
            (I > 0.5 && s16 === 10) ||
            (s16 === 14 && D === 'full' && bar % 2 === 1);
    if (kick)
      synth.tone({
        freq: 160,
        freqEnd: 45,
        dur: 0.12,
        gain: D === 'sparse' ? 0.3 : 0.45,
        type: 'sine',
        at: t,
        out,
      });
    if (D !== 'sparse' && (s16 === 4 || s16 === 12))
      synth.noiseAt(t, 0.11, D === 'light' ? 0.14 : 0.22, 'bandpass', 2200, out);
    const hat =
      D === 'driving'
        ? true
        : D === 'full'
          ? s16 % 2 === 0 || I > 0.4
          : D === 'light'
            ? s16 % 4 === 2
            : s16 === 8;
    if (hat) {
      const open = s16 % 4 === 2;
      synth.noiseAt(
        t,
        open ? 0.05 : 0.025,
        (open ? 0.1 : 0.06) * (s16 % 2 ? 0.5 : 1) * (D === 'sparse' ? 0.6 : 1),
        'highpass',
        8000,
        out,
      );
    }
  }
}
