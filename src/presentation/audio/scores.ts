// ---------- the theme: seven eight-bar sections (~86s) on a sixteenth grid; 0 is a rest ----------
const N = (...pairs: number[]) => {
  const notes = [],
    lens = [];
  for (let k = 0; k < pairs.length; k += 2) {
    notes.push(pairs[k]);
    lens.push(pairs[k + 1]);
    for (let j = 1; j < pairs[k + 1]; j++) {
      notes.push(0);
      lens.push(0);
    }
  }
  return { notes, lens };
};
const C = [60, 4],
  G = [55, 4],
  Am = [57, 3],
  F = [53, 4],
  Em = [52, 3]; // [root, third] for the arpeggio and counter voice
const HOOK = [
  N(76, 2, 79, 2, 84, 3, 0, 1, 79, 2, 76, 2, 0, 4), // C: the leap, then a breath
  N(74, 3, 79, 3, 83, 2, 81, 2, 79, 4, 0, 2), // G: swung answer
  N(81, 2, 84, 2, 88, 4, 86, 2, 84, 2, 81, 4), // Am: the lift
  N(77, 2, 81, 2, 84, 2, 81, 2, 79, 2, 77, 2, 76, 2, 74, 2), // F: tumbling back down
];
const TAIL_A = [
  N(72, 2, 76, 2, 79, 4, 0, 2, 84, 4, 0, 2), // C
  N(83, 2, 81, 2, 79, 2, 74, 4, 0, 2, 79, 2, 81, 2), // G
  N(81, 3, 77, 3, 84, 3, 81, 3, 79, 4), // F: three-against-four
  N(79, 4, 77, 2, 76, 2, 74, 4, 0, 4), // G: walks back to the top
];
const TAIL_B = [
  N(76, 2, 79, 2, 84, 2, 88, 6, 0, 4), // C: reaches higher
  N(86, 2, 83, 2, 79, 4, 0, 2, 81, 2, 83, 4), // G
  N(84, 2, 81, 2, 77, 4, 81, 2, 84, 2, 86, 4), // F
  N(83, 3, 0, 1, 79, 3, 0, 1, 74, 4, 0, 4), // G: stabs, then hands off
];
const BRIDGE = [
  N(69, 2, 69, 2, 72, 2, 76, 4, 0, 2, 69, 4), // Am: low and punchy
  N(65, 2, 65, 2, 69, 2, 72, 4, 0, 2, 74, 2, 72, 2), // F
  N(76, 2, 76, 2, 74, 2, 72, 4, 0, 2, 67, 4), // C
  N(71, 2, 74, 2, 79, 4, 0, 2, 77, 2, 76, 2, 74, 2), // G
  N(69, 2, 69, 2, 72, 2, 76, 4, 0, 2, 81, 4), // Am: same call, higher answer
  N(77, 3, 0, 1, 77, 2, 81, 2, 84, 8), // F: opens up
  N(83, 2, 81, 2, 79, 4, 74, 4, 79, 4), // G
  N(83, 2, 86, 6, 0, 8), // G: one long note, then silence into the breakdown
];
const BREAK = [
  N(81, 8, 84, 8),
  N(83, 8, 86, 8),
  N(79, 8, 76, 8),
  N(81, 12, 0, 4), // F G Em Am: long floating notes
  N(77, 4, 81, 4, 84, 8),
  N(79, 4, 83, 4, 86, 8),
  N(88, 8, 86, 4, 84, 4),
  N(79, 4, 0, 12), // F G C C: climbs, then drops out for the fill
];
const CHORUS = [
  N(84, 3, 86, 1, 88, 4, 0, 2, 79, 6), // C: bright, dotted
  N(83, 3, 79, 1, 76, 4, 0, 2, 83, 6), // Em
  N(81, 3, 84, 1, 81, 4, 0, 2, 77, 6), // F
  N(79, 2, 81, 2, 83, 4, 86, 4, 0, 4), // G: climbs
  N(84, 3, 86, 1, 88, 4, 0, 2, 86, 3, 84, 3), // C
  N(83, 3, 79, 1, 76, 4, 0, 2, 83, 3, 84, 3), // Em
  N(81, 2, 84, 2, 81, 2, 77, 4, 0, 2, 81, 4), // F
  N(79, 4, 83, 2, 86, 2, 79, 4, 0, 4), // G: back to the hook
];
const PROG_A = [C, G, Am, F, C, G, F, G],
  PROG_B = [Am, F, C, G, Am, F, G, G],
  PROG_C = [F, G, Em, Am, F, G, C, C],
  PROG_D = [C, Em, F, G, C, Em, F, G];
const SECTIONS = [
  { bars: [...HOOK, ...TAIL_A], chords: PROG_A, bass: 'bounce', drums: 'full', arp: true },
  {
    bars: [...HOOK, ...TAIL_B],
    chords: PROG_A,
    bass: 'bounce',
    drums: 'full',
    arp: true,
    shadow: 0.02,
  },
  { bars: BRIDGE, chords: PROG_B, bass: 'drive', drums: 'driving' },
  { bars: BREAK, chords: PROG_C, bass: 'sparse', drums: 'sparse', echo: true },
  { bars: CHORUS, chords: PROG_D, bass: 'pump', drums: 'full', counter: true, shadow: 0.02 },
  {
    bars: [...HOOK, ...TAIL_A],
    chords: PROG_A,
    bass: 'bounce',
    drums: 'full',
    arp: true,
    shadow: 0.045,
  },
  {
    bars: CHORUS,
    chords: PROG_D,
    bass: 'pump',
    drums: 'driving',
    arp: true,
    counter: true,
    shadow: 0.03,
  },
];
interface DistrictScore {
  lead: number[];
  len: number[];
  chord: number[][];
  section: {
    shadow?: number;
    echo?: boolean;
    bass: string;
    arp?: boolean;
    counter?: boolean;
    drums: string;
  }[];
  firstBar: boolean[];
  lastBar: boolean[];
  bars: number;
  length: number;
}
export const SONG: DistrictScore = {
  bars: 0,
  length: 0,
  lead: [],
  len: [],
  chord: [],
  section: [],
  firstBar: [],
  lastBar: [],
};
for (const s of SECTIONS)
  s.bars.forEach((b, k) => {
    SONG.lead.push(...b.notes);
    SONG.len.push(...b.lens);
    SONG.chord.push(s.chords[k]);
    SONG.section.push(s);
    SONG.firstBar.push(k === 0);
    SONG.lastBar.push(k === s.bars.length - 1);
  });
SONG.bars = SONG.chord.length;
SONG.length = SONG.bars * 16;
// ---------- Doodle Mexico: sixteen bars of waltz in G, twelve sixteenths a bar ----------
const Gm = [67, 4],
  D7 = [62, 4],
  Cm = [60, 4],
  Em7 = [64, 3],
  Am7 = [69, 3];
const MEX_BARS = [
  N(74, 2, 79, 2, 83, 2, 86, 4, 83, 2),
  N(84, 2, 83, 2, 81, 2, 78, 4, 81, 2), // G: the call · D7
  N(79, 2, 83, 2, 86, 2, 91, 4, 86, 2),
  N(83, 4, 79, 4, 74, 4), // G: to the top · and down
  N(76, 2, 79, 2, 84, 2, 88, 4, 84, 2),
  N(86, 2, 83, 2, 79, 2, 83, 4, 86, 2), // C · G
  N(81, 2, 84, 2, 78, 2, 81, 4, 84, 2),
  N(83, 2, 81, 2, 79, 8), // D7 · G: hold
  N(79, 4, 83, 4, 86, 4),
  N(88, 2, 86, 2, 83, 2, 79, 4, 0, 2), // G · Em: the second verse sings higher
  N(84, 2, 88, 2, 91, 4, 88, 2, 84, 2),
  N(86, 4, 83, 4, 79, 4), // C · G
  N(81, 2, 84, 2, 88, 2, 86, 4, 84, 2),
  N(83, 2, 86, 2, 91, 4, 88, 2, 86, 2), // Am · D7
  N(84, 2, 83, 2, 81, 2, 79, 4, 78, 2),
  N(79, 6, 0, 2, 74, 4), // C D7 · G: the grito lands
];
export const MEXICO = {
  bars: 0,
  length: 0,
  lead: MEX_BARS.flatMap((b) => b.notes),
  len: MEX_BARS.flatMap((b) => b.lens),
  bpm: 150,
  chord: [Gm, D7, Gm, Gm, Cm, Gm, D7, Gm, Gm, Em7, Cm, Gm, Am7, D7, Cm, Gm],
  high: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
};
MEXICO.bars = MEXICO.chord.length;
MEXICO.length = MEXICO.bars * 12;
// the harmony trumpet sits a diatonic third under the lead (G major)
const G_SCALE = [7, 9, 11, 0, 2, 4, 6];
export function thirdBelow(n: number) {
  const pc = ((n % 12) + 12) % 12;
  let k = G_SCALE.indexOf(pc);
  if (k < 0) return n - 4;
  k = (k + 5) % 7;
  let m = n - 1;
  while (((m % 12) + 12) % 12 !== G_SCALE[k]) m--;
  return m;
}
