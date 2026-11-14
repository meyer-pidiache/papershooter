import { credentialEndpoint, parseIceServers, parseStunUrls } from '../src/shared/ice.js';
import type { IceServer } from '../src/shared/ice.js';

export type ServerEnvironment = Record<string, string | undefined>;
export type ProviderConfig =
  | { kind: 'none' }
  | { kind: 'cloudflare'; keyId: string; apiToken: string; ttl: number }
  | { kind: 'coturn'; secret: string; servers: IceServer[]; ttl: number };

function integer(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max)
    throw new TypeError(`Expected integer from ${min} to ${max}`);
  return number;
}

function required(env: ServerEnvironment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new TypeError(`${key} is required for the selected TURN provider`);
  return value;
}

export function loadServerConfig(env: ServerEnvironment) {
  const proxyHeader = (env.TRUST_PROXY_HEADER || 'x-real-ip').toLowerCase();
  if (!/^[a-z0-9-]{1,64}$/.test(proxyHeader)) throw new TypeError('Invalid TRUST_PROXY_HEADER');
  const ttl = integer(env.TURN_TTL_SECONDS ?? env.CF_TURN_TTL_SECONDS, 3600, 300, 172800);
  const kind =
    env.TURN_PROVIDER || (env.CF_TURN_KEY_ID && env.CF_TURN_API_TOKEN ? 'cloudflare' : 'none');
  let provider: ProviderConfig;
  switch (kind) {
    case 'none':
      provider = { kind };
      break;
    case 'cloudflare':
      provider = {
        kind,
        keyId: required(env, 'CF_TURN_KEY_ID'),
        apiToken: required(env, 'CF_TURN_API_TOKEN'),
        ttl,
      };
      break;
    case 'coturn': {
      const urls = required(env, 'TURN_URLS')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);
      const servers = parseIceServers(
        urls.map((url) => ({ urls: url })),
        'any',
      );
      if (servers.some((server) => (server.urls as string[]).some((url) => !/^turns?:/i.test(url))))
        throw new TypeError('TURN_URLS must contain TURN URLs');
      provider = { kind, secret: required(env, 'TURN_SHARED_SECRET'), servers, ttl };
      break;
    }
    default:
      throw new TypeError('TURN_PROVIDER must be none, cloudflare or coturn');
  }
  const allowedOrigins = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      const url = new URL(credentialEndpoint(origin));
      if (url.origin !== origin)
        throw new TypeError('ALLOWED_ORIGINS must contain HTTPS origins without paths');
      return origin;
    });
  return {
    provider,
    stunServers: parseStunUrls(env.PAPERSHOOT_STUN_SERVERS ?? env.VITE_STUN_SERVERS ?? ''),
    port: integer(env.PORT, 3000, 0, 65535),
    host: env.HOST || '127.0.0.1',
    trustProxy: env.TRUST_PROXY === 'true',
    proxyHeader,
    allowedOrigins,
  };
}

export type ServerConfig = ReturnType<typeof loadServerConfig>;
