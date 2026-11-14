import { Peer } from 'peerjs';
import { networkConfig } from './config.js';
import { createIceClient } from './ice-client.js';
import { isWireMessage, lobbyCode } from './protocol.js';
import { MAX_PLAYERS } from '../domain/match.js';
import { isGamePayload } from './game-messages.js';
import { LobbyDiscovery, PUBLIC_SLOT_COUNT } from './lobby-discovery.js';
import { LobbyQuery } from './lobby-query.js';

// Peer-to-peer networking over WebRTC, using the public PeerJS signalling service.
// The host player's browser is authoritative. A small same-origin endpoint obtains temporary
// Cloudflare TURN credentials so WebRTC can relay traffic when a direct connection is blocked.
//
// Lobby codes are just peer ids. A private lobby takes a random 5 letter code; a public lobby
// claims one of a handful of well-known ids (PUB0..PUB15) so quick play can find it by knocking on
// every slot at once - a directory with no directory server. A connection only counts once the
// host has answered with a welcome, so a full or closed lobby can be skipped for the next one.

const MAX_PUBLIC_SLOT_NETWORK_RETRIES = 5;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeCode = () =>
  Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const JOIN_TIMEOUT = 14000,
  SIGNAL_TIMEOUT = 12000;
const defaults = networkConfig(
  import.meta.env,
  typeof location === 'undefined' ? 'localhost' : location.hostname,
);
const ice = createIceClient(defaults);

export class Net {
  constructor({
    PeerClass = Peer,
    options = () => ice.peerOptions(),
    namespace = defaults.namespace,
    validatePayload = isGamePayload,
  } = {}) {
    this.PeerClass = PeerClass;
    this.validatePayload = validatePayload;
    this.generation = 0;
    this.options = options;
    this.prefix = namespace;
    this.peer = null;
    this.conns = new Map();
    this.isHost = false;
    this.id = null;
    this.code = null;
    this.hostId = null;
    this.authorityId = null;
    this.handlers = new Map();
    this.connected = false;
    this.onPeerJoin = null;
    this.onPeerLeave = null;
    this.onDisconnect = null;
    this.maxPlayers = MAX_PLAYERS;
    this.accepting = true;
    this.hostName = '';
    this.stats = { sent: 0, recv: 0 };
    this.isPublic = false;
    this.sessionAbort = new AbortController();
    this.discovery = new LobbyDiscovery(() => this._newPeer(null), this.prefix);
  }
  get active() {
    return !!this.peer && this.connected;
  }
  get peerIds() {
    return [...this.conns.keys()];
  }
  on(type, fn) {
    this.handlers.set(type, fn);
  }
  onHost(type, fn) {
    this.on(type, (data, from) => {
      if (!this.isHost && from === this.authorityId) fn(data, from);
    });
  }
  _emit(type, data, from) {
    const h = this.handlers.get(type);
    if (h) h(data, from);
  }

  async _newPeer(id) {
    const generation = this.generation;
    const opts = await this.options();
    if (generation !== this.generation) throw new Error('lobby operation cancelled');
    return new Promise((resolve, reject) => {
      const peer = new this.PeerClass(id, opts);
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          peer.destroy();
          reject(new Error('signalling server timed out'));
        }
      }, SIGNAL_TIMEOUT);
      peer.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (generation !== this.generation) {
          peer.destroy();
          reject(new Error('lobby operation cancelled'));
          return;
        }
        resolve(peer);
      });
      peer.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        reject(err);
      });
    });
  }
  _wire(conn) {
    conn.on('data', (msg) => {
      this.stats.recv++;
      if (!isWireMessage(msg)) return;
      this._route(msg, conn.peer);
    });
    conn.on('close', () => this._drop(conn.peer, conn));
    conn.on('error', () => this._drop(conn.peer, conn));
  }
  _drop(pid, connection) {
    if (this.leaving || !this.conns.has(pid) || this.conns.get(pid) !== connection) return;
    this.conns.delete(pid);
    if (this.isHost) {
      if (this.onPeerLeave) this.onPeerLeave(pid);
      this.broadcast('leave', { id: pid });
    } else if (pid === this.hostId) {
      this.connected = false;
      if (this.onDisconnect) this.onDisconnect();
    }
  }
  _validMessage(msg) {
    return isWireMessage(msg) && this.validatePayload(msg.t, msg.d);
  }
  _route(msg, from) {
    if (!this._validMessage(msg)) return;
    const sender = this.isHost ? from : msg.from || from;
    // clients can address each other; the host forwards those
    if (this.isHost && msg.to && msg.to !== this.id) {
      const c = this.conns.get(msg.to);
      if (c && c.open) c.send({ ...msg, from: sender });
      return;
    }
    if (this.isHost && msg.relay) {
      for (const [pid, c] of this.conns)
        if (pid !== from && c.open) c.send({ t: msg.t, d: msg.d, from });
    }
    this._emit(msg.t, msg.d, sender);
  }
  _keepAlive(peer) {
    peer.on('disconnected', () => {
      if (this.peer === peer && !peer.destroyed) {
        try {
          peer.reconnect();
        } catch (e) {
          /* ignore */
        }
      }
    });
  }

  // ---- lobby creation / joining ----
  async host({ isPublic = false, code = null } = {}) {
    this.leave();
    this.isHost = true;
    this.isPublic = isPublic;
    if (code) {
      this.code = String(code).toUpperCase();
      this.peer = await this._newPeer(this.prefix + this.code);
    } else if (isPublic) {
      let networkRetries = 0;
      for (let slot = 0; slot < PUBLIC_SLOT_COUNT;) {
        const slotCode = 'PUB' + slot;
        try {
          this.peer = await this._newPeer(this.prefix + slotCode);
          this.code = slotCode;
          break;
        } catch (e) {
          const occupied = !!(e && e.type === 'unavailable-id');
          const retryNetwork = !!(
            e &&
            e.type === 'network' &&
            networkRetries < MAX_PUBLIC_SLOT_NETWORK_RETRIES
          );
          if (occupied) {
            slot++;
            continue;
          }
          if (retryNetwork) {
            networkRetries++;
            continue;
          }
          throw e;
        }
      }
      if (!this.peer) throw new Error('all public lobbies are busy - host a private one');
    } else {
      for (let tries = 0; tries < 3 && !this.peer; tries++) {
        this.code = makeCode();
        try {
          this.peer = await this._newPeer(this.prefix + this.code);
        } catch (e) {
          if (!(e && e.type === 'unavailable-id') || tries === 2) throw e;
        }
      }
    }
    this.id = this.peer.id;
    this.hostId = this.id;
    this.authorityId = this.id;
    this.connected = true;
    this.accepting = true;
    this.peer.on('connection', (conn) => this._incoming(conn));
    this._keepAlive(this.peer);
    return this.code;
  }
  // someone knocking: a quick-play probe is told how full we are and only seated once it says it is staying
  _incoming(conn) {
    conn.on('open', () => {
      // a full lobby still says who it is, so the lobby list can show it
      if (!this.accepting || this.conns.size >= this.maxPlayers - 1) {
        conn.send({
          t: 'refused',
          d: {
            reason: this.accepting ? 'that lobby is full' : 'that lobby is closed',
            code: this.aliasCode || this.code,
            players: this.conns.size + 1,
            max: this.maxPlayers,
            inMatch: !!this.inMatch,
            hostName: this.hostName,
          },
        });
        setTimeout(() => {
          try {
            conn.close();
          } catch (e) {
            /* ignore */
          }
        }, 600);
        return;
      }
      const seat = () => {
        if (this.conns.has(conn.peer)) return;
        this.conns.set(conn.peer, conn);
        this._wire(conn);
        if (this.onPeerJoin) this.onPeerJoin(conn.peer, conn.metadata || {});
      };
      const welcome = {
        hostId: this.id,
        code: this.aliasCode || this.code,
        isPublic: this.isPublic,
        players: this.conns.size + 1,
        max: this.maxPlayers,
        inMatch: !!this.inMatch,
        hostName: this.hostName,
      };
      if (conn.metadata && conn.metadata.probe) {
        conn.send({ t: 'welcome', d: welcome, from: this.id });
        const onData = (msg) => {
          if (this._validMessage(msg) && msg.t === 'stay') {
            conn.off('data', onData);
            seat();
          }
        };
        conn.on('data', onData);
      } else {
        conn.send({ t: 'welcome', d: welcome, from: this.id });
        seat();
      }
    });
  }
  // after a host transfer the lobby lives on a generation code; keep trying to open the original code
  // as a second front door so it stays the code people know
  claimAlias(code, tries = 20) {
    if (!this.isHost || this.alias || this._aliasTimer) return;
    const attempt = async () => {
      this._aliasTimer = null;
      if (!this.isHost || this.alias) return;
      try {
        const peer = await this._newPeer(this.prefix + code);
        if (!this.isHost) {
          peer.destroy();
          return;
        }
        this.alias = peer;
        this.aliasCode = code;
        peer.on('connection', (conn) => this._incoming(conn));
        if (this.onAlias) this.onAlias(code);
      } catch (e) {
        if (--tries > 0) this._aliasTimer = setTimeout(attempt, 6000);
      }
    };
    this._aliasTimer = setTimeout(attempt, 1500);
  }
  async join(code, meta = {}, wantId = null) {
    this.leave();
    this.isHost = false;
    code = String(code || '')
      .trim()
      .toUpperCase();
    if (!code) throw new Error('enter a lobby code');
    this.peer = await this._newPeer(null);
    this.id = this.peer.id;
    this._keepAlive(this.peer);
    // a lobby that changed hosts lives on a generation code; the plain code still finds it
    const base = code.replace(/-\d+$/, '');
    const ids = [
      code,
      ...['-1', '-2', '-3'].map((suf) => base + suf).filter((c) => c !== code),
    ].map((c) => this.prefix + c);
    try {
      await new LobbyQuery(this.peer, ids, meta, {
        mode: 'first',
        timeout: JOIN_TIMEOUT,
        gather: 0,
        signal: this.sessionAbort.signal,
        adopt: (offer) => {
          this.code = lobbyCode(offer.details.code, offer.hostId.slice(this.prefix.length));
          this._adopt(offer.hostId, offer.connection, offer.details);
        },
      }).run();
    } catch (error) {
      this.leave();
      throw error;
    }
    return this.code;
  }

  async quickJoin(meta = {}, onStatus = null) {
    this.leave();
    this.isHost = false;
    try {
      await this.discovery.join(
        meta,
        (peer, offer) => {
          this.peer = peer;
          this.id = peer.id;
          this.code = lobbyCode(offer.details.code, offer.hostId.slice(this.prefix.length));
          this._keepAlive(peer);
          this._adopt(offer.hostId, offer.connection, offer.details);
        },
        onStatus,
      );
    } catch (error) {
      this.leave();
      throw error;
    }
    return this.code;
  }

  async listLobbies(meta = {}, onStatus = null) {
    if (this.active) throw new Error('leave the lobby first');
    return this.discovery.browse(meta, onStatus);
  }
  _adopt(hostId, conn, welcome) {
    this.hostId = hostId;
    // The physical connection may target a reclaimed alias after migration. The host broadcasts
    // with its canonical generation id, which is also used by the lobby and score tables.
    this.authorityId = typeof welcome?.hostId === 'string' ? welcome.hostId : hostId;
    this.conns.set(hostId, conn);
    this.connected = true;
    this.isPublic = !!(welcome && welcome.isPublic);
    this._wire(conn);
  }
  leave() {
    this.generation++;
    this.sessionAbort.abort();
    this.sessionAbort = new AbortController();
    this.discovery.cancel();
    // closing our own connections must not look like other people leaving
    this.leaving = true;
    clearTimeout(this._aliasTimer);
    this._aliasTimer = null;
    if (this.alias) {
      try {
        this.alias.destroy();
      } catch (e) {
        /* ignore */
      }
    }
    this.alias = null;
    this.aliasCode = null;
    for (const c of this.conns.values()) {
      try {
        c.close();
      } catch (e) {
        /* ignore */
      }
    }
    this.conns.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        /* ignore */
      }
    }
    this.peer = null;
    this.connected = false;
    this.isHost = false;
    this.id = null;
    this.code = null;
    this.hostId = null;
    this.authorityId = null;
    this.leaving = false;
  }

  // ---- messaging ----
  // host: to everyone; client: to the host (and on to everyone if relay is set)
  send(type, data, relay = false) {
    this.stats.sent++;
    if (this.isHost) {
      const m = { t: type, d: data, from: this.id };
      for (const c of this.conns.values()) if (c.open) c.send(m);
    } else {
      const c = this.conns.get(this.hostId);
      if (c && c.open) c.send({ t: type, d: data, relay });
    }
  }
  broadcast(type, data) {
    this.send(type, data, true);
  }
  sendTo(pid, type, data) {
    this.stats.sent++;
    if (this.isHost) {
      const c = this.conns.get(pid);
      if (c && c.open) c.send({ t: type, d: data, from: this.id });
    } else {
      const c = this.conns.get(this.hostId);
      if (c && c.open) c.send({ t: type, d: data, to: pid, from: this.id });
    }
  }
}
