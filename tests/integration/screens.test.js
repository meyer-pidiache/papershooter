// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicationFixture } from '../support/application.js';
import { peerNetwork, flushMessages } from '../support/peer-network.js';
import { Net } from '../../src/network/peer-transport.js';

let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('screens and network failure feedback', () => {
  it('keeps malformed network counters and lobby codes out of scoreboard markup', () => {
    fixture = applicationFixture();
    const { app, scores, net, game, lobby } = fixture;
    scores.set('host', { name: 'paper', kills: 1, deaths: 0 });
    app.match.applyScores([{ id: 'host', name: 'paper', kills: '<img src=x>', deaths: 0 }]);
    expect(scores.get('host').kills).toBe(1);
    net.code = '<img src=x>';
    expect(app.match.boardHTML()).not.toContain('<img');
    game.state = 'lobby';
    lobby.shown = '<img src=x>';
    app.screens.showStart();
    expect(document.querySelector('#hud img')).toBeNull();
  });
  it('explains signaling, lobby and connectivity errors without injecting markup', () => {
    fixture = applicationFixture();
    const { app, hud } = fixture;
    const cases = [
      ['networking library did not load', 'could not load'],
      ['signalling timed out', 'matchmaking server'],
      ['no lobby with that code', 'check it with your friend'],
      ['no answer', 'network that blocks'],
      ['lobby full', 'try another code'],
      ['leave the lobby', 'leave your lobby first'],
      ['custom error', 'custom error'],
    ];
    for (const [error, message] of cases)
      expect(app.multiplayer.friendlyError(new Error(error))).toContain(message);
    expect(app.multiplayer.friendlyError(null)).toContain('something went wrong');
    app.multiplayer.setStatus('<img src=x>');
    expect(hud.el.panel.querySelector('img')).toBeNull();
  });

  it('recovers from failed creation/join and opens a public lobby when quick play finds none', async () => {
    vi.useFakeTimers();
    fixture = applicationFixture();
    const { app, net, lobby, state } = fixture;
    vi.spyOn(net, 'host')
      .mockRejectedValueOnce(new Error('signalling timed out'))
      .mockImplementation(async () => {
        net.id = 'host';
        net.code = 'PUB0';
        net.isHost = true;
        return 'PUB0';
      });
    vi.spyOn(net, 'join').mockRejectedValue(new Error('no lobby with that code'));
    vi.spyOn(net, 'quickJoin')
      .mockRejectedValueOnce(new Error('signalling timed out'))
      .mockRejectedValueOnce(new Error('no open public lobbies'))
      .mockResolvedValueOnce('PUB0');
    await app.multiplayer.createLobby(false);
    expect(lobby.status).toContain('matchmaking server');
    await app.multiplayer.joinLobby('XXXXX');
    expect(lobby.status).toContain('check it with your friend');
    await app.multiplayer.quickPlay();
    expect(lobby.status).toContain('matchmaking server');
    await app.multiplayer.quickPlay();
    expect(state.screen).toBe('lobby');
    await app.multiplayer.quickPlay();
    expect(lobby.isPublic).toBe(true);
  });

  it('wires browser settings, lobby browsing, public/private creation and menu navigation', async () => {
    vi.useFakeTimers();
    const { Peer } = peerNetwork();
    const net = new Net({ PeerClass: Peer, options: async () => ({}), namespace: 'screen-test-' });
    fixture = applicationFixture('district', { net });
    const { state, values, game } = fixture;
    vi.spyOn(net, 'listLobbies').mockResolvedValue([
      { code: 'ABCDE', hostName: '<img src=x>', players: 2, max: 10, inMatch: true, full: true },
    ]);
    const invert = document.querySelector('#setInv');
    invert.checked = true;
    invert.dispatchEvent(new Event('change'));
    const music = document.querySelector('#setMus');
    music.checked = true;
    music.dispatchEvent(new Event('change'));
    expect(values.get('paper_invert')).toBe('1');
    expect(values.get('paper_music')).toBe('1');
    document.querySelector('#onlineBtn').click();
    await flushMessages();
    expect(document.querySelector('#lobbyRows').textContent).toContain('<img src=x>');
    expect(document.querySelector('#lobbyRows img')).toBeNull();
    document.querySelector('#joinBtn').click();
    expect(document.querySelector('#status').textContent).toContain('type the code');
    document.querySelector('#createBtn').click();
    await flushMessages();
    expect(game.state).toBe('lobby');
    expect(net.isHost).toBe(true);
    document.querySelector('[data-map="mexico"]').click();
    expect(fixture.lobby.map).toBe('mexico');
    document.querySelector('#leaveBtn').click();
    expect(game.state).toBe('start');
    document.querySelector('#backBtn').click();
    expect(state.screen).toBe('main');
  });
});
