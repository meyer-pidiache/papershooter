export interface SoundPosition {
  x: number;
  y: number;
  z: number;
}
interface EnvelopeOptions {
  dur?: number;
  gain?: number;
  freq?: number;
  freqEnd?: number | null;
  attack?: number;
  pos?: SoundPosition | null;
  delay?: number;
  at?: number;
}
export interface NoiseOptions extends EnvelopeOptions {
  type?: BiquadFilterType;
  q?: number;
  hp?: number;
}
export interface ToneOptions extends EnvelopeOptions {
  type?: OscillatorType;
  out?: AudioNode;
}
export interface SynthesisPort {
  noise(options: NoiseOptions): void;
  tone(options: ToneOptions): void;
}
export interface AudioOutputPort extends SynthesisPort {
  readonly ctx: AudioContext | null;
  readonly master: GainNode | null;
  readonly noiseBuf: AudioBuffer | null;
  noiseAt(
    time: number,
    duration: number,
    gain: number,
    type: BiquadFilterType,
    frequency: number,
    out: AudioNode,
  ): void;
}
