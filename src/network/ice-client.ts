import { isRecord, parseIceServers } from '../shared/ice';
import type { IceServer } from '../shared/ice';
import type { NetworkConfig } from './config';

interface Options {
  fetch?: typeof fetch;
  now?: () => number;
  warn?: (message: string) => void;
}

/** One cache per client: concurrent lobby probes share requests; failed requests can retry. */
export function createIceClient(config: NetworkConfig, options: Options = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const warn = options.warn ?? console.warn;
  let cachedStun = config.stunServers;
  let stunRequest: Promise<IceServer[]> | null = null;
  let cachedTurn: IceServer[] = [];
  let expiresAt = 0;
  let turnRequest: Promise<IceServer[]> | null = null;

  async function request(url: string): Promise<Record<string, unknown>> {
    const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`ICE endpoint returned ${response.status}`);
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new TypeError('Invalid ICE response');
    return payload;
  }

  async function stun(): Promise<IceServer[]> {
    if (cachedStun !== null) return cachedStun;
    if (!stunRequest) {
      stunRequest = request(config.iceConfigUrl).then((payload) => parseIceServers(payload.iceServers, 'stun'));
    }
    try { cachedStun = await stunRequest; return cachedStun; }
    finally { stunRequest = null; }
  }

  async function turn(): Promise<IceServer[]> {
    if (!config.turnCredentialsUrl) return [];
    if (expiresAt > now() + 60000) return cachedTurn;
    if (!turnRequest) {
      turnRequest = request(config.turnCredentialsUrl).then((payload) => {
        const servers = parseIceServers(payload.iceServers, 'turn');
        if (!servers.length) throw new TypeError('No TURN servers');
        const expiry = Number(payload.expiresAt);
        if (!Number.isFinite(expiry) || expiry <= now()) throw new TypeError('Missing or expired TURN credentials');
        cachedTurn = servers;
        expiresAt = expiry;
        return servers;
      });
    }
    try { return await turnRequest; }
    finally { turnRequest = null; }
  }

  return {
    async peerOptions() {
      const results = await Promise.allSettled([stun(), turn()]);
      const iceServers = results.flatMap((result, index) => {
        if (result.status === 'fulfilled') return result.value;
        warn(`${index === 0 ? 'STUN configuration' : 'TURN credentials'} unavailable; continuing with the available ICE servers.`);
        return [];
      });
      return { ...config.peer, config: { iceServers } };
    },
  };
}
