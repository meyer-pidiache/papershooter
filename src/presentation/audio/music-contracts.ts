export const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);

export interface MusicStep {
  t: number;
  i: number;
  bar: number;
  subdivision: number;
  step: number;
  chord: number[];
  root: number;
  out: AudioNode;
  intensity: number;
}
export interface DistrictStep extends MusicStep {
  s16: number;
  firstBar: boolean;
  lastBar: boolean;
  sec: {
    shadow?: number;
    echo?: boolean;
    bass: string;
    arp?: boolean;
    counter?: boolean;
    drums: string;
  };
}
