import { EventEmitter } from 'node:events';

// Model the signaling/connection boundary. Real lobby discovery and routing run unchanged.
export function peerNetwork() {
  const peers = new Map();
  let serial = 0;
  class Connection extends EventEmitter {
    constructor(peer, metadata) {
      super();
      this.peer = peer;
      this.metadata = metadata;
      this.open = false;
      this.outbox = [];
      this.scheduled = false;
    }
    send(packet) {
      this.outbox.push(structuredClone(packet));
      if (this.scheduled) return;
      this.scheduled = true;
      const deliver = () => {
        const next = this.outbox.shift();
        if (this.other?.open) this.other.emit('data', next);
        // Yield between ordered packets, as separate WebRTC data events do. Promise continuations
        // must be able to adopt a welcomed connection before the following lobby packet arrives.
        if (this.outbox.length) queueMicrotask(deliver);
        else this.scheduled = false;
      };
      queueMicrotask(deliver);
    }
    close() {
      if (!this.open) return;
      this.open = false;
      this.emit('close');
      if (this.other?.open) {
        this.other.open = false;
        this.other.emit('close');
      }
    }
  }
  class Peer extends EventEmitter {
    constructor(id) {
      super();
      this.id = id || `guest-${++serial}`;
      this.destroyed = false;
      queueMicrotask(() => {
        if (peers.has(this.id)) this.emit('error', { type: 'unavailable-id' });
        else {
          peers.set(this.id, this);
          this.emit('open', this.id);
        }
      });
    }
    connect(id, options) {
      const outgoing = new Connection(id, options.metadata);
      const remote = peers.get(id);
      if (!remote) {
        queueMicrotask(() =>
          this.emit('error', {
            type: 'peer-unavailable',
            message: `Could not connect to peer ${id}`,
          }),
        );
        return outgoing;
      }
      const incoming = new Connection(this.id, options.metadata);
      outgoing.other = incoming;
      incoming.other = outgoing;
      queueMicrotask(() => {
        remote.emit('connection', incoming);
        incoming.open = outgoing.open = true;
        incoming.emit('open');
        outgoing.emit('open');
      });
      return outgoing;
    }
    reconnect() {
      this.emit('open');
    }
    destroy() {
      if (peers.get(this.id) === this) peers.delete(this.id);
      this.destroyed = true;
    }
  }
  return { Peer, peers };
}

export async function flushMessages() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
