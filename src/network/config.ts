import type { PeerOptions } from 'peerjs';
import { credentialEndpoint, parseStunUrls } from '../shared/ice';

export type NetworkEnvironment = Record<string, string | boolean | undefined>;

export function networkConfig(env: NetworkEnvironment, hostname: string) {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(hostname);
  const namespace = String(env.VITE_LOBBY_NAMESPACE || (local ? 'doodledev-' : 'doodledistrict-'));
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(namespace)) throw new TypeError('Invalid lobby namespace');
  const peer: PeerOptions = { debug: 0 };
  if (env.VITE_PEER_HOST) {
    peer.host = String(env.VITE_PEER_HOST);
    peer.path = String(env.VITE_PEER_PATH || '/');
    peer.secure = env.VITE_PEER_SECURE !== 'false';
    const port = Number(env.VITE_PEER_PORT || (peer.secure ? 443 : 80));
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new TypeError('Invalid signaling port');
    peer.port = port;
  }
  return {
    namespace,
    peer,
    stunServers:
      env.VITE_STUN_SERVERS === undefined ? null : parseStunUrls(String(env.VITE_STUN_SERVERS)),
    iceConfigUrl: credentialEndpoint(String(env.VITE_ICE_CONFIG_URL || '/ice-servers.json')),
    turnCredentialsUrl: env.VITE_TURN_CREDENTIALS_URL
      ? credentialEndpoint(String(env.VITE_TURN_CREDENTIALS_URL))
      : null,
  };
}

export type NetworkConfig = ReturnType<typeof networkConfig>;
