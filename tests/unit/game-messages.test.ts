import { describe, expect, it } from 'vitest';
import { decodeGameMessage, isGamePayload } from '../../src/network/game-messages.js';
import type { GamePayloads } from '../../src/network/game-message-types.js';

const offer = {
  hostId: 'host',
  code: 'ABCDE',
  isPublic: true,
  players: 1,
  max: 10,
  inMatch: false,
  hostName: 'paper',
};
const valid: GamePayloads = {
  welcome: offer,
  refused: { reason: 'full', ...offer },
  stay: undefined,
  lobby: {
    players: [{ id: 'host', name: 'paper' }],
    hostId: 'host',
    isPublic: true,
    map: 'mexico',
    shown: 'ABCDE',
  },
  leave: { id: 'guest' },
  start: { spawns: { host: 0 }, map: 'district' },
  startreq: {},
  end: { id: 'host', name: 'paper' },
  backtolobby: {},
  pickup: { id: 1, kind: 'health', pos: [1, 2, 3] },
  taken: { id: 1 },
  take: { id: 1 },
  ps: [0, 1, 0, 0, 0, 1, 64, 120, 0, 0, 0],
  pdmg: { amount: 25, from: [1, 2, 3], by: 'host', crit: false, src: 'rifle' },
  pdead: { killer: null, dir: null, over: false, how: null, crit: false },
  nade: { pos: [1, 2, 3], vel: [4, 5, 6] },
  brk: { id: 0 },
  parry: { ret: true, by: 'host' },
  shots: { k: 'rifle', e: [1, 2, 3] },
  cut: {},
  score: [{ id: 'host', name: 'paper', kills: 1, deaths: 0 }],
  fell: {},
  feed: { text: 'left' },
  clock: { left: 600, on: true },
  kick: { reason: 'idle' },
};

describe('gameplay wire contracts', () => {
  it.each(Object.entries(valid))('accepts the established %s representation', (t, d) => {
    expect(decodeGameMessage({ t, d })).toEqual({ t, d });
  });
  it('accepts optional legacy fields and grapple snapshots', () => {
    expect(isGamePayload('start', { spawn: 2, late: true, broken: [0, 1] })).toBe(true);
    expect(isGamePayload('pdmg', { amount: 0 })).toBe(true);
    expect(isGamePayload('pdead', {})).toBe(true);
    expect(isGamePayload('ps', [0, 1, 0, 0, 0, 0, 192, 100, 0, 0, 0, 2, 3, 4])).toBe(true);
    expect(isGamePayload('refused', { reason: 'closed' })).toBe(true);
  });
  it('rejects invalid envelopes, unrecognized kinds and non-record payloads', () => {
    for (const value of [
      null,
      [],
      { t: 'unknown', d: {} },
      { t: '__proto__', d: {} },
      { t: 'pdmg', d: null },
      { t: 'pdmg', d: [] },
      { t: 'pdmg', d: { amount: 1 }, from: 1 },
    ])
      expect(decodeGameMessage(value)).toBeNull();
  });
  it('rejects non-finite, negative, excessive and malformed gameplay values', () => {
    const packets = [
      ['pdmg', { amount: -1 }],
      ['pdmg', { amount: NaN }],
      ['pdmg', { amount: Infinity }],
      ['pdmg', { amount: 10001 }],
      ['pdmg', { amount: 1, from: [1, 2] }],
      ['nade', { pos: [0, 0, 0], vel: [0, null, 0] }],
      ['pickup', { id: 1, kind: 'invalid', pos: [0, 0, 0] }],
      ['take', { id: -1 }],
      ['ps', valid.ps.slice(0, 8)],
      ['ps', [...valid.ps.slice(0, 5), 4, ...valid.ps.slice(6)]],
      ['ps', [...valid.ps.slice(0, 6), 128, ...valid.ps.slice(7)]],
      ['ps', [...valid.ps, 1]],
      ['ps', [...valid.ps.slice(0, 7), -1, ...valid.ps.slice(8)]],
      ['shots', { k: 'rifle', e: [1, 2] }],
      ['shots', { k: 'rifle', e: Array(771).fill(0) }],
      ['clock', { left: 601, on: true }],
      ['clock', { left: 1, on: 'yes' }],
      ['feed', { text: 'x'.repeat(513) }],
      ['score', [{ id: 'host', name: 'paper', kills: -1, deaths: 0 }]],
      ['cut', { extra: true }],
    ];
    for (const [t, d] of packets) expect(decodeGameMessage({ t, d }), String(t)).toBeNull();
  });
  it('bounds rosters and validates every spawn and breakable index', () => {
    const roster = valid.lobby;
    for (const value of [
      { ...roster, players: [] },
      { ...roster, players: [roster.players[0], roster.players[0]] },
      { ...roster, hostId: 'absent' },
      { ...roster, players: Array(11).fill(roster.players[0]) },
      { ...roster, map: 'unknown' },
      { ...roster, shown: '<html>' },
    ])
      expect(isGamePayload('lobby', value)).toBe(false);
    for (const value of [
      {},
      { spawn: -1 },
      { spawns: { host: NaN } },
      { spawn: 0, broken: [-1] },
      { spawns: Array(10) },
      { spawn: 65536 },
    ])
      expect(isGamePayload('start', value)).toBe(false);
    expect(isGamePayload('welcome', { ...offer, players: 11 })).toBe(false);
    expect(isGamePayload('welcome', { ...offer, hostName: 1 })).toBe(false);
  });

  it('rejects sparse vectors, snapshots, rosters and batches rather than skipping empty slots', () => {
    const snapshot = [...valid.ps];
    delete snapshot[0];
    for (const [t, d] of [
      ['ps', snapshot],
      ['pdmg', { amount: 1, from: Array(3) }],
      ['shots', { k: 'rifle', e: Array(3) }],
      ['lobby', { ...valid.lobby, players: Array(1) }],
      ['start', { spawn: 1, broken: Array(1) }],
    ])
      expect(decodeGameMessage({ t, d })).toBeNull();
  });
});
