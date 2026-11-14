import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

export class ControlledConnection extends EventEmitter {
  open = true;
  send = vi.fn();
  constructor(readonly peer: string) {
    super();
  }
  close = vi.fn(() => {
    this.open = false;
    this.emit('close');
  });
}
export class ControlledPeer extends EventEmitter {
  id = 'query-peer';
  connections = new Map<string, ControlledConnection>();
  connect = vi.fn((id: string): ControlledConnection | undefined => {
    const connection = new ControlledConnection(id);
    this.connections.set(id, connection);
    return connection;
  });
  destroy = vi.fn();
}
export const welcome = (players = 1) => ({
  t: 'welcome',
  d: {
    hostId: 'host',
    code: 'PUB0',
    isPublic: true,
    players,
    max: 10,
    inMatch: false,
    hostName: 'paper',
  },
});
export function unavailable(peer: ControlledPeer, id: string) {
  peer.emit('error', { type: 'peer-unavailable', message: `Could not connect to peer ${id}` });
}
