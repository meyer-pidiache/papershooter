import type { IncomingMessage, ServerResponse } from 'node:http';
import { isIP } from 'node:net';
import type { ServerConfig } from './config.js';
import { cachedCredentials, createProvider } from './providers.js';
import type { TurnProvider } from './providers.js';
import { RateLimiter } from './rate-limit.js';

export type HttpHandler = (req: IncomingMessage, res: ServerResponse, next?: () => void) => void;
interface Dependencies {
  provider?: TurnProvider | null;
  limiter?: RateLimiter;
  now?: () => number;
  log?: (message: string) => void;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

export function clientIp(req: IncomingMessage, trustProxy: boolean, header = 'x-real-ip'): string {
  // Enable only when the origin is private and the immediate proxy overwrites the selected header.
  const forwarded = req.headers[header];
  if (trustProxy && typeof forwarded === 'string' && isIP(forwarded.trim()))
    return forwarded.trim();
  return req.socket.remoteAddress || 'unknown';
}

export function createApiHandler(
  config: ServerConfig,
  dependencies: Dependencies = {},
): HttpHandler {
  const provider =
    dependencies.provider === undefined ? createProvider(config.provider) : dependencies.provider;
  const credentials = provider ? cachedCredentials(provider, dependencies.now) : null;
  const limiter = dependencies.limiter ?? new RateLimiter();
  const log = dependencies.log ?? console.error;

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
    next?: () => void,
  ): Promise<void> {
    const path = (req.url || '/').split('?')[0];
    if (!['/healthz', '/api/ice-servers', '/api/turn-credentials'].includes(path)) {
      if (next) next();
      else sendJson(res, 404, { error: 'not_found' });
      return;
    }
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
    }
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET');
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }
    if (path === '/healthz') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }
    if (path === '/api/ice-servers') {
      sendJson(res, 200, { iceServers: config.stunServers });
      return;
    }
    if (!limiter.allow(clientIp(req, config.trustProxy, config.proxyHeader))) {
      res.setHeader('retry-after', '60');
      sendJson(res, 429, { error: 'rate_limited' });
      return;
    }
    if (!credentials) {
      sendJson(res, 503, { error: 'turn_not_configured' });
      return;
    }
    try {
      sendJson(res, 200, await credentials());
    } catch {
      // Provider errors may contain credentials or request headers. Never expose those details.
      log('TURN credential provider failed');
      sendJson(res, 502, { error: 'turn_credentials_unavailable' });
    }
  }

  return (req, res, next) => {
    void handle(req, res, next).catch(() => {
      log('Credential request failed');
      sendJson(res, 500, { error: 'internal_error' });
    });
  };
}
