import { isRecord } from '../shared/ice.js';

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
