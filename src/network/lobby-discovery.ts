import { MAX_PLAYERS } from '../domain/match.js';
import { lobbyCode, lobbyCount } from './protocol.js';
import { LobbyQuery, LobbyQueryError } from './lobby-query.js';
import type { LobbyOffer, WelcomeOffer } from './lobby-query.js';
import type { DiscoveryPeerPort } from './peer-ports.js';

export const PUBLIC_SLOT_COUNT = 16;
export interface LobbyListing {
  id: string;
  code: string;
  players: number;
  max: number;
  inMatch: boolean;
  hostName: string;
  full: boolean;
}
type Status = (message: string) => void;
type Adopt = (peer: DiscoveryPeerPort, offer: WelcomeOffer) => void;

function publicIds(prefix: string): string[] {
  return Array.from({ length: PUBLIC_SLOT_COUNT }, (_, slot) =>
    ['', '-1', '-2', '-3'].map((suffix) => `${prefix}PUB${slot}${suffix}`),
  ).flat();
}
function listings(offers: LobbyOffer[], prefix: string): LobbyListing[] {
  const byCode = new Map<string, LobbyListing>();
  for (const offer of offers) {
    const details = offer.details;
    const code = lobbyCode(details.code, offer.hostId.slice(prefix.length)).replace(/-\d+$/, '');
    const row = {
      id: offer.hostId.slice(prefix.length),
      code,
      players: lobbyCount(details.players),
      max: lobbyCount(details.max, MAX_PLAYERS, 1),
      inMatch: !!details.inMatch,
      hostName: details.hostName ?? '',
      full: offer.kind === 'refused',
    };
    if (row.players > (byCode.get(code)?.players ?? -1)) byCode.set(code, row);
  }
  return [...byCode.values()].sort((a, b) => b.players - a.players);
}
function destroy(peer?: DiscoveryPeerPort): void {
  try {
    peer?.destroy();
  } catch {
    /* Failed signaling endpoints may already be destroyed. */
  }
}

/** Owns temporary signaling peers; only an explicit successful adoption transfers one to a session. */
export class LobbyDiscovery {
  private readonly operations = new Set<AbortController>();
  constructor(
    private openPeer: () => Promise<DiscoveryPeerPort>,
    private prefix: string,
  ) {}

  cancel(): void {
    for (const operation of this.operations) operation.abort();
  }
  private begin(): AbortController {
    this.cancel();
    const operation = new AbortController();
    this.operations.add(operation);
    return operation;
  }
  private async open(operation: AbortController): Promise<DiscoveryPeerPort> {
    const peer = await this.openPeer();
    if (operation.signal.aborted) {
      destroy(peer);
      throw new LobbyQueryError('cancelled', 'lobby operation cancelled');
    }
    return peer;
  }

  async browse(metadata: object, onStatus?: Status): Promise<LobbyListing[]> {
    const operation = this.begin();
    let peer: DiscoveryPeerPort | undefined;
    try {
      peer = await this.open(operation);
      const offers = await new LobbyQuery(
        peer,
        publicIds(this.prefix),
        { ...metadata, probe: true },
        {
          mode: 'all',
          timeout: 11000,
          gather: 2200,
          signal: operation.signal,
          onOffer: (count) => onStatus?.(`found ${count}…`),
        },
      ).run();
      return listings(offers, this.prefix);
    } finally {
      destroy(peer);
      this.operations.delete(operation);
    }
  }

  async join(metadata: object, adopt: Adopt, onStatus?: Status): Promise<void> {
    const operation = this.begin();
    let peer: DiscoveryPeerPort | undefined;
    let transferred = false;
    try {
      peer = await this.open(operation);
      const endpoint = peer;
      onStatus?.('looking for an open lobby…');
      await new LobbyQuery(
        peer,
        publicIds(this.prefix),
        { ...metadata, probe: true },
        {
          mode: 'best',
          timeout: 11000,
          gather: 1500,
          signal: operation.signal,
          onOffer: (count) =>
            onStatus?.(`found ${count} open ${count === 1 ? 'lobby' : 'lobbies'}…`),
          adopt: (offer) => {
            adopt(endpoint, offer);
            transferred = true;
            offer.connection.send({ t: 'stay' });
          },
        },
      ).run();
    } catch (error) {
      if (error instanceof LobbyQueryError && error.reason !== 'cancelled')
        throw new Error('no open public lobbies', { cause: error });
      throw error;
    } finally {
      if (!transferred) destroy(peer);
      this.operations.delete(operation);
    }
  }
}
