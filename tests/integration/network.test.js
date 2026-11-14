import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Net, makeCode } from '../../src/network/peer-transport.js';
import { isWireMessage } from '../../src/network/protocol.js';
import { flushMessages, peerNetwork } from '../support/peer-network.js';

const clients = [];
afterEach(() => {
  for (const client of clients) client.leave();
  clients.length = 0;
  vi.useRealTimers();
});
function setup() {
  const network = peerNetwork();
  const client = () => {
    // Isolate generic routing behavior from the gameplay validators tested through composed sessions.
    const net = new Net({
      PeerClass: network.Peer,
      options: async () => ({}),
      namespace: 'test-',
      validatePayload: () => true,
    });
    clients.push(net);
    return net;
  };
  return { ...network, client };
}

describe('PeerJS lobby transport', () => {
  it('drops malformed payloads before dispatch or forwarding to another peer', async () => {
    const { Peer } = setup();
    const make = () => {
      const net = new Net({ PeerClass: Peer, options: async () => ({}), namespace: 'validated-' });
      clients.push(net);
      return net;
    };
    const host = make(),
      a = make(),
      b = make();
    await host.host({ code: 'ABCDE' });
    await a.join('ABCDE');
    await b.join('ABCDE');
    const local = vi.fn(),
      forwarded = vi.fn();
    host.on('pdmg', local);
    b.on('pdmg', forwarded);
    const connection = a.conns.get(host.id);
    for (const d of [null, { amount: -25 }, { amount: 1, from: [0, Infinity, 0] }])
      connection.send({ t: 'pdmg', d, to: b.id, relay: true });
    await flushMessages();
    expect(local).not.toHaveBeenCalled();
    expect(forwarded).not.toHaveBeenCalled();
    a.sendTo(b.id, 'pdmg', { amount: 25 });
    await flushMessages();
    expect(forwarded).toHaveBeenCalledWith({ amount: 25 }, a.id);
  });
  it('accepts canonical host authority when a late join targets its reclaimed alias', async () => {
    vi.useFakeTimers();
    const { client } = setup();
    const host = client(),
      guest = client();
    await host.host({ code: 'ABCDE-1' });
    host.claimAlias('ABCDE');
    await vi.advanceTimersByTimeAsync(1501);
    await guest.join('ABCDE');
    await flushMessages();
    expect(guest.hostId).toBe('test-ABCDE');
    expect(guest.authorityId).toBe(host.id);
    const end = vi.fn();
    guest.onHost('end', end);
    host.send('end', { id: host.id });
    await flushMessages();
    expect(end).toHaveBeenCalledOnce();
  });
  it('cancels a lobby whose configuration resolves after leaving', async () => {
    const { Peer, peers } = peerNetwork();
    let release;
    const options = new Promise((resolve) => {
      release = resolve;
    });
    const net = new Net({ PeerClass: Peer, options: () => options });
    clients.push(net);
    const hosting = net.host({ code: 'ABCDE' });
    net.leave();
    release({});
    await expect(hosting).rejects.toThrow('cancelled');
    expect(peers.size).toBe(0);
  });
  it('hosts, joins, relays, sends direct messages and notifies disconnections', async () => {
    const { client } = setup();
    const host = client(),
      a = client(),
      b = client();
    const joined = vi.fn();
    host.onPeerJoin = joined;
    expect(await host.host({ code: 'abcde' })).toBe('ABCDE');
    await a.join('abcde', { name: 'a' });
    await b.join('ABCDE', { name: 'b' });
    expect(host.peerIds).toHaveLength(2);
    expect(joined).toHaveBeenCalledTimes(2);
    expect(a.active).toBe(true);
    const handler = vi.fn();
    b.on('test', handler);
    a.broadcast('test', { value: 1 });
    await flushMessages();
    expect(handler).toHaveBeenCalledWith({ value: 1 }, a.id);
    a.sendTo(b.id, 'test', { value: 2 });
    await flushMessages();
    expect(handler).toHaveBeenLastCalledWith({ value: 2 }, a.id);
    host.sendTo(b.id, 'test', { value: 3 });
    await flushMessages();
    expect(handler).toHaveBeenLastCalledWith({ value: 3 }, host.id);
    const left = vi.fn();
    host.onPeerLeave = left;
    const oldId = a.id;
    a.leave();
    await flushMessages();
    expect(left).toHaveBeenCalledWith(oldId);
    const disconnected = vi.fn();
    b.onDisconnect = disconnected;
    host.leave();
    await flushMessages();
    expect(disconnected).toHaveBeenCalledOnce();
    expect(b.connected).toBe(false);
  });

  it('finds public lobbies without joining and lets quick play seat a player', async () => {
    vi.useFakeTimers();
    const { client } = setup();
    const host = client(),
      other = client(),
      guest = client();
    await host.host({ isPublic: true });
    await other.host({ isPublic: true });
    expect([host.code, other.code]).toEqual(['PUB0', 'PUB1']);
    const list = guest.listLobbies();
    await vi.runAllTimersAsync();
    const lobbies = await list;
    expect(lobbies.map((lobby) => lobby.code)).toEqual(['PUB0', 'PUB1']);
    expect(host.conns.size).toBe(0);
    const joined = guest.quickJoin({}, vi.fn());
    await vi.runAllTimersAsync();
    expect(await joined).toBe('PUB0');
    await flushMessages();
    expect(host.conns.size).toBe(1);
    await expect(guest.listLobbies()).rejects.toThrow('leave the lobby');
  });

  it('refuses full/closed lobbies and reports unavailable codes', async () => {
    const { client } = setup();
    const host = client(),
      guest = client();
    await host.host({ code: 'ABCDE' });
    host.accepting = false;
    await expect(guest.join('ABCDE')).rejects.toThrow('closed');
    host.accepting = true;
    host.maxPlayers = 1;
    await expect(guest.join('ABCDE')).rejects.toThrow('full');
    await expect(guest.join('XXXXX')).rejects.toThrow('no lobby');
    await expect(guest.join('')).rejects.toThrow('enter a lobby code');
    expect(makeCode()).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
  });

  it('accepts authority messages only from the host and prevents sender impersonation', async () => {
    const { client } = setup();
    const host = client(),
      a = client(),
      b = client();
    await host.host({ code: 'ABCDE' });
    await a.join('ABCDE');
    await b.join('ABCDE');
    const authority = vi.fn();
    b.onHost('end', authority);
    a.broadcast('end', { winner: a.id });
    await flushMessages();
    expect(authority).not.toHaveBeenCalled();
    host.send('end', { winner: b.id });
    await flushMessages();
    expect(authority).toHaveBeenCalledOnce();
    const handler = vi.fn();
    b.on('test', handler);
    a.conns.get(host.id).send({ t: 'test', d: {}, to: b.id, from: 'impersonator' });
    await flushMessages();
    expect(handler).toHaveBeenCalledWith({}, a.id);
    for (const value of [
      null,
      [],
      {},
      { t: 1 },
      { t: 'x', relay: 'yes' },
      { t: 'x', to: 4 },
      { t: 'x', from: 4 },
    ])
      expect(isWireMessage(value)).toBe(false);
    expect(isWireMessage({ t: 'x', d: [] })).toBe(true);
  });

  it('ignores a stale connection close and malformed incoming packets', () => {
    const { client } = setup();
    const host = client();
    const old = new EventEmitter();
    old.peer = 'guest';
    const current = new EventEmitter();
    current.peer = 'guest';
    host.conns.set('guest', current);
    host._wire(old);
    old.emit('close');
    expect(host.conns.get('guest')).toBe(current);
    const handler = vi.fn();
    host.on('test', handler);
    old.emit('data', null);
    old.emit('data', { t: {} });
    expect(handler).not.toHaveBeenCalled();
    host._route(null, 'guest');
  });

  it('times out signaling and destroys the unfinished peer', async () => {
    vi.useFakeTimers();
    const instance = new EventEmitter();
    instance.destroy = vi.fn();
    class SilentPeer {
      constructor() {
        return instance;
      }
    }
    const client = new Net({ PeerClass: SilentPeer, options: async () => ({}) });
    clients.push(client);
    const promise = client._newPeer(null);
    const failure = expect(promise).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(12001);
    await failure;
    expect(instance.destroy).toHaveBeenCalledOnce();
  });
});
