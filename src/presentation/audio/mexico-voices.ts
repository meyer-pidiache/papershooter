import type { AudioOutputPort } from './contracts.js';
import { MEXICO as T, thirdBelow } from './scores.js';
import { midi, type MusicStep } from './music-contracts.js';
export function mexicoVoices(synth: AudioOutputPort, frame: MusicStep) {
  const { t, i, bar, step, chord, root, out, intensity: I, subdivision: sb } = frame;
  const n = T.lead[i];
  if (n > 0) {
    const dur = T.len[i] * step * 0.9;
    synth.tone({ freq: midi(n), dur, gain: 0.1, type: 'square', at: t, out });
    synth.tone({
      freq: midi(thirdBelow(n)),
      dur: dur * 0.9,
      gain: 0.055,
      type: 'square',
      at: t,
      out,
    });
    if (T.high[bar])
      synth.tone({ freq: midi(n) * 2, dur: dur * 0.6, gain: 0.02, type: 'square', at: t, out });
  }
  if (sb === 0)
    synth.tone({
      freq: midi(root - 24),
      dur: step * 3.4,
      gain: 0.2,
      type: 'triangle',
      at: t,
      out,
    });
  if (sb === 4 || sb === 8)
    for (const iv of [0, chord[1], 7])
      synth.tone({
        freq: midi(root + iv),
        dur: step * 1.5,
        gain: 0.045,
        type: 'sawtooth',
        at: t,
        out,
      });
  if (sb % 2 === 0)
    synth.noiseAt(t, sb === 0 ? 0.05 : 0.03, sb === 0 ? 0.13 : 0.07, 'highpass', 6500, out);
  if (I > 0.45 && (sb === 6 || sb === 10)) synth.noiseAt(t, 0.07, 0.16, 'bandpass', 1900, out);
  if (bar === T.bars - 1 && sb >= 8)
    synth.noiseAt(t, 0.06, 0.1 + (sb - 8) * 0.04, 'bandpass', 1600 + (sb - 8) * 300, out);
}
