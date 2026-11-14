import { isRecord } from '../shared/ice.js';
import { MAX_PLAYERS } from '../domain/match.js';

export function lobbyCount(value: unknown, fallback = 0, min = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value)
    ? Math.min(MAX_PLAYERS, Math.max(min, value))
    : fallback;
}

export function lobbyCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Z0-9_-]{1,64}$/.test(value) ? value : fallback;
}

export interface WireMessage {
  t: string;
  d?: unknown;
  from?: string;
  to?: string;
  relay?: boolean;
}

export function isWireMessage(value: unknown): value is WireMessage {
  if (!isRecord(value) || typeof value.t !== 'string' || !value.t || value.t.length > 32)
    return false;
  if (value.to !== undefined && (typeof value.to !== 'string' || value.to.length > 128))
    return false;
  if (value.from !== undefined && (typeof value.from !== 'string' || value.from.length > 128))
    return false;
  return value.relay === undefined || typeof value.relay === 'boolean';
}
