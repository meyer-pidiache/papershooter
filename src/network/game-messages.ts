import { isRecord } from '../shared/ice.js';
import { FFA_TIME, MAX_PLAYERS, parseScoreRows } from '../domain/match.js';
import { LEVELS } from '../domain/maps.js';
import { isWireMessage } from './protocol.js';
import type { GameMessage, WireVector } from './game-message-types.js';

type Validator = (value: unknown) => boolean;
const number: Validator = (value) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1_000_000;
const integer: Validator = (value) =>
  number(value) && Number.isSafeInteger(value) && (value as number) >= 0;
const text =
  (max: number): Validator =>
  (value) =>
    typeof value === 'string' && value.length <= max;
const id: Validator = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 128;
const boolean: Validator = (value) => typeof value === 'boolean';
const optional =
  (check: Validator): Validator =>
  (value) =>
    value === undefined || check(value);
const nullable =
  (check: Validator): Validator =>
  (value) =>
    value === null || check(value);
const array =
  (check: Validator, max: number): Validator =>
  (value) =>
    Array.isArray(value) && value.length <= max && value.every(check);
const code: Validator = (value) => typeof value === 'string' && /^[A-Z0-9_-]{1,64}$/.test(value);
const map: Validator = (value) => LEVELS.some((level) => level.key === value);
const count: Validator = (value) =>
  integer(value) && (value as number) >= 1 && (value as number) <= MAX_PLAYERS;
const index: Validator = (value) => integer(value) && (value as number) <= 65535;
const vector: Validator = (value): value is WireVector =>
  Array.isArray(value) && value.length === 3 && value.every(number);

function record(fields: Record<string, Validator>): Validator {
  const entries = Object.entries(fields);
  return (value) => isRecord(value) && entries.every(([key, check]) => check(value[key]));
}
const empty: Validator = (value) =>
  value === undefined || (isRecord(value) && Object.keys(value).length === 0);
const reference = record({ id: integer });
const offerFields = {
  hostId: id,
  code,
  isPublic: boolean,
  players: count,
  max: count,
  inMatch: boolean,
  hostName: text(128),
};
const player = record({ id, name: text(128) });

const rosterShape = record({
  players: array(player, MAX_PLAYERS),
  hostId: id,
  isPublic: boolean,
  map: optional(map),
  shown: optional(code),
});
function roster(value: unknown): boolean {
  if (!rosterShape(value)) return false;
  const data = value as { players: Array<{ id: string }>; hostId: string };
  const ids = data.players.map((entry) => entry.id);
  return ids.length > 0 && new Set(ids).size === ids.length && ids.includes(data.hostId);
}
function spawnTable(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.keys(value).length <= MAX_PLAYERS &&
    Object.entries(value).every(([key, entry]) => id(key) && index(entry))
  );
}
const startShape = record({
  map: optional(map),
  late: optional(boolean),
  spawn: optional(index),
  spawns: optional(spawnTable),
  broken: optional(array(integer, 2048)),
});
function start(value: unknown): boolean {
  return (
    startShape(value) &&
    isRecord(value) &&
    (value.spawn !== undefined || value.spawns !== undefined)
  );
}
function snapshot(value: unknown): boolean {
  if (!Array.isArray(value) || (value.length !== 11 && value.length !== 14) || !value.every(number))
    return false;
  return (
    index(value[5]) &&
    value[5] < 4 &&
    integer(value[6]) &&
    value[6] <= 4095 &&
    integer(value[7]) &&
    ((value[6] & 128) === 0 || value.length === 14)
  );
}
const shotsShape = record({ k: text(32), e: array(number, 768) });
function shots(value: unknown): boolean {
  return shotsShape(value) && isRecord(value) && Array.isArray(value.e) && value.e.length % 3 === 0;
}
const scoreShape = array(record({ name: text(128) }), MAX_PLAYERS);
function score(value: unknown): boolean {
  return scoreShape(value) && parseScoreRows(value) !== null;
}

// Preserve the established wire representation; reject malformed values before routing/forwarding.
const validators: Record<keyof import('./game-message-types.js').GamePayloads, Validator> = {
  welcome: record(offerFields),
  refused: record({
    reason: text(512),
    ...Object.fromEntries(
      Object.entries(offerFields).map(([key, check]) => [key, optional(check)]),
    ),
  }),
  stay: empty,
  lobby: roster,
  leave: record({ id }),
  start,
  startreq: empty,
  end: record({ id, name: text(128) }),
  backtolobby: empty,
  pickup: record({
    id: integer,
    kind: (value) => value === 'ammo' || value === 'health',
    pos: vector,
  }),
  taken: reference,
  take: reference,
  ps: snapshot,
  pdmg: record({
    amount: (value) => number(value) && (value as number) >= 0 && (value as number) <= 10000,
    from: optional(nullable(vector)),
    by: optional(id),
    crit: optional(boolean),
    src: optional(text(32)),
  }),
  pdead: record({
    killer: optional(nullable(id)),
    dir: optional(nullable(vector)),
    over: optional(boolean),
    how: optional(nullable(text(64))),
    crit: optional(boolean),
  }),
  nade: record({ pos: vector, vel: vector }),
  brk: reference,
  parry: record({ ret: optional(boolean), by: optional(id) }),
  shots,
  cut: empty,
  score,
  fell: empty,
  feed: record({ text: text(512) }),
  clock: record({
    left: (value) => number(value) && (value as number) >= 0 && (value as number) <= FFA_TIME,
    on: boolean,
  }),
  kick: record({ reason: text(512) }),
};

export function isGamePayload(type: string, value: unknown): boolean {
  return Object.hasOwn(validators, type) && validators[type as keyof typeof validators](value);
}

export function decodeGameMessage(value: unknown): GameMessage | null {
  return isWireMessage(value) && isGamePayload(value.t, value.d) ? (value as GameMessage) : null;
}
