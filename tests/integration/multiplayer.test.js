// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';
import { flushMessages, peerNetwork } from '../support/peer-network.js';
import { Net } from '../../src/network/peer-transport.js';

const fixtures = [];
afterEach(() => {
  for (const fixture of fixtures) fixture.app.dispose();
  fixtures.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
});
function clients() {
  const { Peer } = peerNetwork();
  return (map = 'district') => {
    const net = new Net({
      PeerClass: Peer,
      options: async () => ({}),
      namespace: 'application-test-',
    });
    const fixture = applicationFixture(map, { net });
    fixtures.push(fixture);
    return fixture;
  };
}

describe('complete multiplayer sessions through an in-memory signaling boundary', () => {
  it('shares the host map, snapshots, damage, pickups, broken props, clock and match result', async () => {
    vi.useFakeTimers();
    const make = clients();
    const host = make('mexico'),
      guest = make();
    await host.app.multiplayer.createLobby(false);
    await guest.app.multiplayer.joinLobby(host.net.code);
    await flushMessages();
    expect(host.lobby.players.size).toBe(2);
    expect(guest.lobby.players.size).toBe(2);
    host.app.controls.hostStart();
    await flushMessages();
    expect(guest.game).toMatchObject({ mode: 'ffa', state: 'play' });
    expect(guest.state.level.key).toBe('mexico');
    host.player.shieldT = 0;
    guest.player.shieldT = 0;
    const hpBeforeInvalid = [host.player.hp, guest.player.hp];
    const guestConnection = guest.net.conns.get(host.net.id);
    for (const d of [null, { amount: -25 }, { amount: NaN }, { amount: 25, from: [0, 1] }]) {
      guestConnection.send({ t: 'pdmg', d });
      guestConnection.send({ t: 'pdmg', d, to: host.net.id, relay: true });
    }
    await flushMessages();
    expect([host.player.hp, guest.player.hp]).toEqual(hpBeforeInvalid);
    host.frame(0.016, 3);
    guest.frame(0.016, 3);
    await flushMessages();
    host.app.multiplayer.netUpdate(0.016);
    guest.app.multiplayer.netUpdate(0.016);
    expect(host.remote.get(guest.net.id).snapB).not.toBeNull();
    const previousSnapshot = host.remote.get(guest.net.id).snapB;
    guestConnection.send({ t: 'ps', d: [NaN], relay: true });
    await flushMessages();
    expect(host.remote.get(guest.net.id).snapB).toBe(previousSnapshot);
    const remote = host.remote.get(guest.net.id);
    guest.player.shieldT = 0;
    const hp = guest.player.hp;
    host.ctx.hitPlayer(remote, 25, {
      part: 'torso',
      source: 'rifle',
      point: remote.center,
      dir: new Vector3(0, 0, -1),
      crit: false,
    });
    await flushMessages();
    expect(guest.player.hp).toBe(hp - 25);
    expect(guest.player.lastHitBy).toBe(host.net.id);
    const pickup = host.app.pickups.spawnPickup('ammo', new Vector3(999, 0, 999));
    await flushMessages();
    expect(guest.state.pickups.some((item) => item.id === pickup.id)).toBe(true);
    guest.net.send('take', { id: pickup.id });
    await flushMessages();
    expect(host.state.pickups.some((item) => item.id === pickup.id)).toBe(false);
    expect(guest.state.pickups.some((item) => item.id === pickup.id)).toBe(false);
    const prop = host.state.level.breakables[0];
    host.app.combat.breakProp(prop, new Vector3(1, 0, 0), true);
    await flushMessages();
    expect(guest.state.level.breakables[prop.id].alive).toBe(false);
    host.app.match.tallyDeath(guest.net.id, host.net.id);
    await flushMessages();
    expect(guest.scores.get(host.net.id).kills).toBe(1);
    host.app.multiplayer.netUpdate(1);
    await flushMessages();
    expect(guest.state.clockRunning).toBe(true);
    host.scores.get(host.net.id).kills = 20;
    host.app.match.checkWin();
    await flushMessages();
    expect(guest.game.state).toBe('over');
    expect(guest.game.over.id).toBe(host.net.id);
    host.net.send('backtolobby', {});
    host.app.screens.toLobbyScreen();
    await flushMessages();
    expect(guest.game.state).toBe('lobby');
    await guest.app.multiplayer.leaveOnline('done');
    expect(guest.game.state).toBe('start');
  });

  it('transfers a running lobby to the remaining player and reclaims its public alias', async () => {
    vi.useFakeTimers();
    const make = clients();
    const host = make(),
      guest = make();
    await host.app.multiplayer.createLobby(true);
    const code = host.net.code;
    await guest.app.multiplayer.joinLobby(code);
    await flushMessages();
    host.app.controls.hostStart();
    await flushMessages();
    host.net.leave();
    await flushMessages();
    await vi.advanceTimersByTimeAsync(1600);
    await flushMessages();
    expect(guest.net.isHost).toBe(true);
    expect(guest.net.code).toBe(`${code}-1`);
    expect(guest.net.aliasCode).toBe(code);
    expect(guest.game.state).toBe('play');
  });
});
