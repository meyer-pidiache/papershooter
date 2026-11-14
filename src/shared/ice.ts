export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const ICE_URL = /^(stun|stuns|turn|turns):[^\s,/?#]+(?::\d+)?(?:\?transport=(?:udp|tcp))?$/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseIceServers(
  value: unknown,
  kind: 'stun' | 'turn' | 'any' = 'any',
): IceServer[] {
  if (!Array.isArray(value)) throw new TypeError('ICE servers must be an array');
  return value.map((entry: unknown) => {
    if (!isRecord(entry)) throw new TypeError('Invalid ICE server');
    const urls = Array.isArray(entry.urls) ? entry.urls : [entry.urls];
    if (
      !urls.length ||
      urls.some(
        (url: unknown) =>
          typeof url !== 'string' ||
          !ICE_URL.test(url) ||
          (kind !== 'any' && !url.toLowerCase().startsWith(kind)),
      )
    ) {
      throw new TypeError(`Invalid ${kind} ICE URL`);
    }
    const server: IceServer = { urls: urls as string[] };
    if (entry.username !== undefined) {
      if (typeof entry.username !== 'string' || !entry.username)
        throw new TypeError('Invalid ICE username');
      server.username = entry.username;
    }
    if (entry.credential !== undefined) {
      if (typeof entry.credential !== 'string' || !entry.credential)
        throw new TypeError('Invalid ICE credential');
      server.credential = entry.credential;
    }
    if (kind === 'turn' && (!server.username || !server.credential))
      throw new TypeError('TURN credentials are required');
    return server;
  });
}

export function parseStunUrls(value: string): IceServer[] {
  return parseIceServers(
    value
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map((urls) => ({ urls })),
    'stun',
  );
}

export function credentialEndpoint(value: string): string {
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new TypeError('Credentials endpoint must use HTTPS or a same-origin path');
  return url.href;
}
