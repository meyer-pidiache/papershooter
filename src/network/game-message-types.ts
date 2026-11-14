import type { ScoreRow } from '../domain/match.js';
import type { MapKey } from '../domain/maps.js';

export type WireVector = [number, number, number];
export interface LobbyOffer {
  hostId: string;
  code: string;
  isPublic: boolean;
  players: number;
  max: number;
  inMatch: boolean;
  hostName: string;
}
export interface LobbyRoster {
  players: Array<{ id: string; name: string }>;
  hostId: string;
  isPublic: boolean;
  map?: MapKey;
  shown?: string;
}
export interface MatchStart {
  map?: MapKey;
  late?: boolean;
  spawn?: number;
  spawns?: Record<string, number>;
  broken?: number[];
}
export interface PlayerDamage {
  amount: number;
  from?: WireVector | null;
  by?: string;
  crit?: boolean;
  src?: string;
}
export interface PlayerDeath {
  killer?: string | null;
  dir?: WireVector | null;
  over?: boolean;
  how?: string | null;
  crit?: boolean;
}
export type EmptyPayload = Record<string, never> | undefined;
export interface GamePayloads {
  welcome: LobbyOffer;
  refused: { reason: string } & Partial<LobbyOffer>;
  stay: EmptyPayload;
  lobby: LobbyRoster;
  leave: { id: string };
  start: MatchStart;
  startreq: EmptyPayload;
  end: { id: string; name: string };
  backtolobby: EmptyPayload;
  pickup: { id: number; kind: 'ammo' | 'health'; pos: WireVector };
  taken: { id: number };
  take: { id: number };
  ps: number[];
  pdmg: PlayerDamage;
  pdead: PlayerDeath;
  nade: { pos: WireVector; vel: WireVector };
  brk: { id: number };
  parry: { ret?: boolean; by?: string };
  shots: { k: string; e: number[] };
  cut: EmptyPayload;
  score: ScoreRow[];
  fell: EmptyPayload;
  feed: { text: string };
  clock: { left: number; on: boolean };
  kick: { reason: string };
}
export type GameMessage = {
  [Kind in keyof GamePayloads]: {
    t: Kind;
    d: GamePayloads[Kind];
    from?: string;
    to?: string;
    relay?: boolean;
  };
}[keyof GamePayloads];
