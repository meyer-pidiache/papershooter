import { isRecord } from '../shared/ice.js';
import { decodeGameMessage } from './game-messages.js';
import type { GamePayloads } from './game-message-types.js';
import type { ConnectionPort, DiscoveryPeerPort } from './peer-ports.js';

interface OfferConnection {
  hostId: string;
  connection: ConnectionPort;
}
export type WelcomeOffer = OfferConnection & { kind: 'welcome'; details: GamePayloads['welcome'] };
export type LobbyOffer =
  WelcomeOffer | (OfferConnection & { kind: 'refused'; details: GamePayloads['refused'] });
interface Attempt {
  hostId: string;
  connection: ConnectionPort;
  done: boolean;
  data: (value: unknown) => void;
  closed: () => void;
}
type Selection = { mode: 'all' } | { mode: 'first' | 'best'; adopt: (offer: WelcomeOffer) => void };
export type QueryOptions = Selection & {
  timeout: number;
  gather: number;
  signal?: AbortSignal;
  onOffer?: (count: number) => void;
};

export class LobbyQueryError extends Error {
  constructor(
    readonly reason: 'empty' | 'timeout' | 'cancelled',
    message: string,
  ) {
    super(message);
  }
}

function close(connection: ConnectionPort): void {
  try {
    connection.close();
  } catch {
    /* An unfinished/failed connection may already be closed. */
  }
}

/** Owns one query's connections, event subscriptions and deadlines until selection/cancellation. */
export class LobbyQuery {
  private attempts: Attempt[] = [];
  private offers: LobbyOffer[] = [];
  private pending: number;
  private settled = false;
  private started = false;
  private timer?: ReturnType<typeof setTimeout>;
  private gatherTimer?: ReturnType<typeof setTimeout>;
  private lastError: Error | null = null;
  private resolve!: (offers: LobbyOffer[]) => void;
  private reject!: (error: Error) => void;

  constructor(
    private peer: DiscoveryPeerPort,
    private ids: string[],
    private metadata: object,
    private options: QueryOptions,
  ) {
    this.pending = ids.length;
  }

  run(): Promise<LobbyOffer[]> {
    if (this.started) return Promise.reject(new Error('Lobby queries are single-use'));
    this.started = true;
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      if (this.options.signal?.aborted) {
        this.finish(new LobbyQueryError('cancelled', 'lobby operation cancelled'));
        return;
      }
      this.peer.on('error', this.onPeerError);
      this.options.signal?.addEventListener('abort', this.onAbort, { once: true });
      this.timer = setTimeout(
        () =>
          this.finish(
            this.offers.length
              ? undefined
              : new LobbyQueryError('timeout', 'no answer from that lobby'),
          ),
        this.options.timeout,
      );
      for (const id of this.ids) this.probe(id);
      if (this.pending === 0) this.finish();
    });
  }

  private onAbort = (): void => {
    this.finish(new LobbyQueryError('cancelled', 'lobby operation cancelled'));
  };
  private onPeerError = (error: unknown): void => {
    if (!isRecord(error) || error.type !== 'peer-unavailable') return;
    const id = /peer\s+(\S+)/.exec(String(error.message ?? ''))?.[1];
    const attempt = this.attempts.find((candidate) => candidate.hostId === id);
    if (attempt) this.fail(attempt);
  };

  private probe(hostId: string): void {
    let connection: ConnectionPort | undefined;
    try {
      connection = this.peer.connect(hostId, {
        reliable: true,
        serialization: 'json',
        metadata: this.metadata,
      });
    } catch {
      this.pending--;
      return;
    }
    if (!connection) {
      this.pending--;
      return;
    }
    const attempt: Attempt = {
      hostId,
      connection,
      done: false,
      data: (value) => this.receive(attempt, value),
      closed: () => {
        this.offers = this.offers.filter((offer) => offer.connection !== connection);
        this.fail(attempt);
      },
    };
    this.attempts.push(attempt);
    connection.on('data', attempt.data);
    connection.on('close', attempt.closed);
    connection.on('error', attempt.closed);
  }

  private fail(attempt: Attempt): void {
    if (attempt.done || this.settled) return;
    attempt.done = true;
    this.pending--;
    if (this.pending === 0) this.finish();
  }

  private receive(attempt: Attempt, value: unknown): void {
    if (attempt.done || this.settled) return;
    const message = decodeGameMessage(value);
    if (!message || (message.t !== 'welcome' && message.t !== 'refused')) return;
    if (message.t === 'refused' && this.options.mode !== 'all') {
      this.lastError = new Error(message.d.reason);
      this.fail(attempt);
      return;
    }
    attempt.done = true;
    this.pending--;
    const source = { hostId: attempt.hostId, connection: attempt.connection };
    this.offers.push(
      message.t === 'welcome'
        ? { ...source, kind: 'welcome', details: message.d }
        : { ...source, kind: 'refused', details: message.d },
    );
    try {
      this.options.onOffer?.(this.offers.length);
    } catch (failure) {
      this.finish(
        failure instanceof Error
          ? failure
          : new Error('lobby status callback failed', { cause: failure }),
      );
      return;
    }
    if (this.options.mode === 'first' || this.pending === 0) this.finish();
    else this.gatherTimer ??= setTimeout(() => this.finish(), this.options.gather);
  }

  private finish(error?: Error): void {
    if (this.settled) return;
    this.settled = true;
    clearTimeout(this.timer);
    clearTimeout(this.gatherTimer);
    this.peer.off('error', this.onPeerError);
    this.options.signal?.removeEventListener('abort', this.onAbort);
    for (const attempt of this.attempts) {
      attempt.connection.off('data', attempt.data);
      attempt.connection.off('close', attempt.closed);
      attempt.connection.off('error', attempt.closed);
    }
    const winner = this.select();
    let adopted: ConnectionPort | undefined;
    try {
      // Install the session handler in this data-event turn so following packets cannot be lost.
      if (!error && winner && this.options.mode !== 'all') {
        this.options.adopt(winner);
        adopted = winner.connection;
      }
    } catch (failure) {
      error =
        failure instanceof Error
          ? failure
          : new Error('could not adopt the lobby', { cause: failure });
    }
    for (const attempt of this.attempts)
      if (attempt.connection !== adopted) close(attempt.connection);
    if (
      error &&
      !(
        error instanceof LobbyQueryError &&
        error.reason === 'timeout' &&
        this.options.mode === 'all'
      )
    )
      this.reject(error);
    else if (this.options.mode !== 'all' && !adopted)
      this.reject(
        error ?? new LobbyQueryError('empty', this.lastError?.message ?? 'no lobby with that code'),
      );
    else this.resolve(this.offers);
  }

  private select(): WelcomeOffer | undefined {
    const open = this.offers.filter(
      (offer): offer is WelcomeOffer => offer.kind === 'welcome' && offer.connection.open,
    );
    if (this.options.mode === 'best')
      open.sort((a, b) => (b.details.players ?? 0) - (a.details.players ?? 0));
    return open[0];
  }
}
