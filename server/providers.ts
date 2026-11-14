import { createHmac, randomUUID } from 'node:crypto';
import { isRecord, parseIceServers } from '../src/shared/ice.js';
import type { IceServer } from '../src/shared/ice.js';
import type { ProviderConfig } from './config.js';

export interface TurnCredentials {
  iceServers: IceServer[];
  expiresAt: number;
}
export interface TurnProvider {
  issue(signal: AbortSignal): Promise<TurnCredentials>;
}
interface Dependencies {
  fetch?: typeof fetch;
  now?: () => number;
  identifier?: () => string;
}

export function createProvider(
  config: ProviderConfig,
  dependencies: Dependencies = {},
): TurnProvider | null {
  if (config.kind === 'none') return null;
  const now = dependencies.now ?? Date.now;
  if (config.kind === 'coturn') {
    return {
      async issue() {
        const expiry = Math.floor(now() / 1000) + config.ttl;
        const username = `${expiry}:${(dependencies.identifier ?? randomUUID)()}`;
        const credential = createHmac('sha1', config.secret).update(username).digest('base64');
        return {
          iceServers: config.servers.map((server) => ({ ...server, username, credential })),
          expiresAt: expiry * 1000,
        };
      },
    };
  }
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  return {
    async issue(signal) {
      const response = await fetcher(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(config.keyId)}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.apiToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ ttl: config.ttl }),
          signal,
        },
      );
      if (!response.ok) throw new Error(`TURN provider returned HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new TypeError('Invalid TURN provider response');
      const entries = parseIceServers(payload.iceServers)
        .map((server) => ({
          ...server,
          urls: (server.urls as string[]).filter((url) => /^turns?:/i.test(url)),
        }))
        .filter((server) => server.urls.length > 0);
      const iceServers = parseIceServers(entries, 'turn');
      if (!iceServers.length) throw new TypeError('TURN provider returned no servers');
      return { iceServers, expiresAt: now() + config.ttl * 1000 };
    },
  };
}

export function cachedCredentials(provider: TurnProvider, now: () => number = Date.now) {
  let cached: TurnCredentials | null = null;
  let pending: Promise<TurnCredentials> | null = null;
  return async (): Promise<TurnCredentials> => {
    if (cached && cached.expiresAt > now() + 60000) return cached;
    if (!pending) pending = provider.issue(AbortSignal.timeout(10000));
    try {
      cached = await pending;
      return cached;
    } finally {
      pending = null;
    }
  };
}
