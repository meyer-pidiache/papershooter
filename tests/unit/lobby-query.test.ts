import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbyQuery } from '../../src/network/lobby-query.js';
import { ControlledPeer, unavailable, welcome } from '../support/discovery-peer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('disposable lobby queries', () => {
  it('installs the session consumer before a following data event can arrive', async () => {
    const peer = new ControlledPeer(),
      session = vi.fn();
    const query = new LobbyQuery(
      peer,
      ['a', 'b'],
      {},
      {
        mode: 'first',
        timeout: 1000,
        gather: 0,
        adopt: (offer) => {
          offer.connection.on('data', session);
        },
      },
    );
    const result = query.run();
    peer.connections.get('a')!.emit('data', welcome());
    peer.connections.get('a')!.emit('data', { t: 'lobby', d: 'next packet' });
    await result;
    expect(session).toHaveBeenCalledWith({ t: 'lobby', d: 'next packet' });
    expect(peer.connections.get('a')!.close).not.toHaveBeenCalled();
    expect(peer.connections.get('b')!.close).toHaveBeenCalledOnce();
    expect(peer.listenerCount('error')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('selects the fuller valid offer and closes other connections', async () => {
    const peer = new ControlledPeer(),
      adopt = vi.fn();
    const result = new LobbyQuery(
      peer,
      ['a', 'b', 'c'],
      {},
      { mode: 'best', timeout: 11000, gather: 1500, adopt },
    ).run();
    peer.connections.get('a')!.emit('data', welcome(2));
    peer.connections.get('b')!.emit('data', { t: 'refused', d: { reason: 'full' } });
    peer.connections.get('c')!.emit('data', welcome(5));
    await result;
    expect(adopt.mock.calls[0][0].hostId).toBe('c');
    expect(peer.connections.get('c')!.close).not.toHaveBeenCalled();
    expect(peer.connections.get('a')!.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('can adopt a late offer when the overall deadline precedes the gathering deadline', async () => {
    const peer = new ControlledPeer(),
      adopt = vi.fn();
    const result = new LobbyQuery(
      peer,
      ['a', 'b'],
      {},
      { mode: 'best', timeout: 11000, gather: 1500, adopt },
    ).run();
    await vi.advanceTimersByTimeAsync(10500);
    peer.connections.get('a')!.emit('data', welcome());
    await vi.advanceTimersByTimeAsync(500);
    await result;
    expect(adopt).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('rejects cancellation, releases listeners/connections and prevents query reuse', async () => {
    const peer = new ControlledPeer(),
      controller = new AbortController();
    const query = new LobbyQuery(
      peer,
      ['a'],
      {},
      { mode: 'first', timeout: 1000, gather: 0, signal: controller.signal, adopt: vi.fn() },
    );
    const result = expect(query.run()).rejects.toThrow('cancelled');
    await expect(query.run()).rejects.toThrow('single-use');
    controller.abort();
    await result;
    expect(peer.connections.get('a')!.close).toHaveBeenCalledOnce();
    expect(peer.connections.get('a')!.listenerCount('data')).toBe(0);
    expect(peer.listenerCount('error')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not adopt a malformed or closed offer', async () => {
    const peer = new ControlledPeer(),
      adopt = vi.fn();
    const result = expect(
      new LobbyQuery(
        peer,
        ['a', 'b'],
        {},
        { mode: 'best', timeout: 1000, gather: 100, adopt },
      ).run(),
    ).rejects.toThrow('closed');
    peer.connections.get('a')!.emit('data', { t: 'welcome', d: null });
    peer.connections.get('a')!.emit('data', welcome());
    peer.connections.get('a')!.close();
    peer.connections.get('b')!.emit('data', { t: 'refused', d: { reason: 'closed' } });
    await result;
    expect(adopt).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('finishes unavailable peers immediately and unanswered peers at the deadline', async () => {
    const peer = new ControlledPeer();
    const failed = expect(
      new LobbyQuery(
        peer,
        ['a'],
        {},
        { mode: 'first', timeout: 1000, gather: 0, adopt: vi.fn() },
      ).run(),
    ).rejects.toThrow('no lobby');
    unavailable(peer, 'a');
    await failed;
    const timed = expect(
      new LobbyQuery(
        peer,
        ['b'],
        {},
        { mode: 'first', timeout: 1000, gather: 0, adopt: vi.fn() },
      ).run(),
    ).rejects.toThrow('no answer');
    await vi.advanceTimersByTimeAsync(1000);
    await timed;
    expect(peer.listenerCount('error')).toBe(0);
    peer.connect.mockReturnValue(undefined);
    await expect(
      new LobbyQuery(
        peer,
        ['disconnected'],
        {},
        {
          mode: 'first',
          timeout: 1000,
          gather: 0,
          adopt: vi.fn(),
        },
      ).run(),
    ).rejects.toThrow('no lobby');
    expect(vi.getTimerCount()).toBe(0);
  });
});
