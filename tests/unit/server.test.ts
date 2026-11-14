import { createHmac } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import type { ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { clientIp, createApiHandler } from '../../server/app';
import type { HttpHandler } from '../../server/app';
import { loadServerConfig } from '../../server/config';
import { cachedCredentials, createProvider } from '../../server/providers';
import { RateLimiter } from '../../server/rate-limit';

function request(
  handler: HttpHandler,
  path: string,
  method = 'GET',
  headers: Record<string, string> = {},
) {
  const req = new IncomingMessage(new Socket());
  req.url = path;
  req.method = method;
  req.headers = headers;
  return new Promise<{
    status: number;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }>((resolve) => {
    const response = {
      status: 0,
      headers: {} as Record<string, string>,
      destroyed: false,
      writableEnded: false,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      writeHead(status: number, headers: Record<string, string>) {
        this.status = status;
        Object.assign(this.headers, headers);
      },
      end(body: string) {
        resolve({ status: this.status, headers: this.headers, body: JSON.parse(body) });
      },
    };
    handler(req, response as unknown as ServerResponse);
  });
}

describe('credential service', () => {
  it('validates configuration and requires secrets only for the chosen provider', () => {
    expect(loadServerConfig({})).toMatchObject({
      provider: { kind: 'none' },
      host: '127.0.0.1',
      port: 3000,
    });
    expect(
      loadServerConfig({ CF_TURN_KEY_ID: 'key', CF_TURN_API_TOKEN: 'secret' }).provider.kind,
    ).toBe('cloudflare');
    expect(
      loadServerConfig({
        TURN_PROVIDER: 'coturn',
        TURN_URLS: 'turn:relay:3478,turns:relay:5349',
        TURN_SHARED_SECRET: 'secret',
        TURN_TTL_SECONDS: '600',
      }).provider.kind,
    ).toBe('coturn');
    for (const env of [
      { TURN_PROVIDER: 'invalid' },
      { TURN_PROVIDER: 'cloudflare' },
      { TURN_TTL_SECONDS: '1' },
      { PORT: 'oops' },
      { ALLOWED_ORIGINS: 'https://host/path' },
      { TURN_PROVIDER: 'coturn', TURN_SHARED_SECRET: 'x', TURN_URLS: 'stun:host' },
    ])
      expect(() => loadServerConfig(env)).toThrow();
    expect(loadServerConfig({ ALLOWED_ORIGINS: 'https://game.example' }).allowedOrigins).toEqual([
      'https://game.example',
    ]);
  });
  it('generates coturn-compatible HMAC credentials without a network request', async () => {
    const provider = createProvider(
      { kind: 'coturn', ttl: 600, secret: 'private', servers: [{ urls: ['turn:relay:3478'] }] },
      { now: () => 1000000, identifier: () => 'player' },
    );
    const result = await provider!.issue(new AbortController().signal);
    expect(result.expiresAt).toBe(1600000);
    expect(result.iceServers[0].username).toBe('1600:player');
    expect(result.iceServers[0].credential).toBe(
      createHmac('sha1', 'private').update('1600:player').digest('base64'),
    );
    expect(createProvider({ kind: 'none' })).toBeNull();
  });
  it('validates Cloudflare output and uses the configured key/TTL', async () => {
    const server = {
      urls: 'turn:custom-relay:3478',
      username: 'temporary',
      credential: 'temporary',
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ iceServers: [{ urls: 'stun:provider:3478' }, server] })),
      );
    const provider = createProvider(
      { kind: 'cloudflare', keyId: 'key/id', apiToken: 'private', ttl: 600 },
      { fetch: fetcher, now: () => 0 },
    )!;
    expect((await provider.issue(new AbortController().signal)).expiresAt).toBe(600000);
    expect(fetcher.mock.calls[0][0]).toContain('key%2Fid');
    expect(fetcher.mock.calls[0][1]?.body).toBe('{"ttl":600}');
    for (const response of [
      new Response('', { status: 401 }),
      new Response('null'),
      new Response('{"iceServers":[]}'),
    ]) {
      fetcher.mockResolvedValueOnce(response);
      await expect(provider.issue(new AbortController().signal)).rejects.toThrow();
    }
  });
  it('coalesces provider calls, refreshes credentials and recovers from failure', async () => {
    let now = 0;
    const issue = vi
      .fn()
      .mockImplementation(async () => ({ iceServers: [], expiresAt: now + 120000 }));
    const get = cachedCredentials({ issue }, () => now);
    await Promise.all([get(), get()]);
    await get();
    expect(issue).toHaveBeenCalledOnce();
    now = 70000;
    issue.mockRejectedValueOnce(new Error('upstream failure'));
    await expect(get()).rejects.toThrow();
    await get();
    expect(issue).toHaveBeenCalledTimes(3);
  });
  it('bounds memory and recovers fixed windows', () => {
    let now = 0;
    const limit = new RateLimiter(2, 1000, 2, () => now);
    expect([limit.allow('a'), limit.allow('a'), limit.allow('a')]).toEqual([true, true, false]);
    expect(limit.allow('b')).toBe(true);
    expect(limit.allow('c')).toBe(false);
    expect(limit.size).toBe(2);
    now = 1000;
    expect(limit.allow('c')).toBe(true);
    expect(limit.size).toBe(1);
    now = 2000;
    expect(limit.allow('c')).toBe(true);
  });
  it('serves health/configuration, methods, CORS, missing configuration and rate limits', async () => {
    const config = loadServerConfig({
      PAPERSHOOT_STUN_SERVERS: 'stun:mine:3478',
      ALLOWED_ORIGINS: 'https://game.example',
    });
    const handler = createApiHandler(config, { limiter: new RateLimiter(1) });
    expect((await request(handler, '/healthz')).body).toEqual({ status: 'ok' });
    const ice = await request(handler, '/api/ice-servers?cache=0', 'GET', {
      origin: 'https://game.example',
    });
    expect(ice.status).toBe(200);
    expect(ice.headers['access-control-allow-origin']).toBe('https://game.example');
    expect(ice.headers['cache-control']).toBe('no-store');
    expect((await request(handler, '/api/turn-credentials', 'POST')).status).toBe(405);
    expect((await request(handler, '/other')).status).toBe(404);
    expect((await request(handler, '/api/turn-credentials')).status).toBe(503);
    expect((await request(handler, '/api/turn-credentials')).status).toBe(429);
  });
  it('returns credentials and redacts provider errors', async () => {
    const issue = vi.fn().mockResolvedValue({ iceServers: [], expiresAt: 120000 });
    const log = vi.fn();
    const handler = createApiHandler(loadServerConfig({}), {
      provider: { issue },
      now: () => 0,
      log,
    });
    expect((await request(handler, '/api/turn-credentials')).status).toBe(200);
    const broken = createApiHandler(loadServerConfig({}), {
      provider: {
        issue: async () => {
          throw new Error('secret token');
        },
      },
      log,
    });
    expect((await request(broken, '/api/turn-credentials')).body).toEqual({
      error: 'turn_credentials_unavailable',
    });
    expect(log.mock.calls.flat().join('')).not.toContain('secret token');
    const req = new IncomingMessage(new Socket());
    req.headers = { 'x-real-ip': '1.2.3.4' };
    expect(clientIp(req, false)).toBe('unknown');
    expect(clientIp(req, true)).toBe('1.2.3.4');
  });
});
