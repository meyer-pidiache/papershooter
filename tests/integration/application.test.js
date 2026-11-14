// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';
import { TYPES } from '../../src/domain/enemies.js';
import { NavGrid } from '../../src/engine/navigation.js';

let fixture;
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('composed application without the GPU transport', () => {
  it('starts solo, moves, jumps, switches weapons, pauses and resumes', () => {
    fixture = applicationFixture();
    const { app, game, player, input, frame, renderer } = fixture;
    app.controls.begin();
    expect(game).toMatchObject({ state: 'play', mode: 'solo', wave: 1 });
    const start = player.body.pos.clone();
    input.keys.forward = true;
    frame(1 / 60, 40);
    expect(player.body.pos.distanceTo(start)).toBeGreaterThan(1);
    input.keys.jump = true;
    frame();
    expect(player.body.vel.y).toBeGreaterThan(0);
    input.keys.jump = false;
    frame();
    input.keys.jump = true;
    frame();
    expect(player.airJumps).toBe(0);
    input.keys.jump = false;
    input.keys.slot2 = true;
    frame();
    expect(player.weapon.kind).toBe('shotgun');
    input.keys.slot2 = false;
    app.controls.pause();
    expect(game.state).toBe('pause');
    app.controls.resume();
    expect(game.state).toBe('play');
    expect(renderer.render).toHaveBeenCalled();
  });

  it('retains Mexico, collects pickups and rebuilds broken props on reset', () => {
    fixture = applicationFixture('mexico');
    const { app, state, world, player, frame, game } = fixture;
    app.controls.beginAtWave(5);
    expect(state.level.key).toBe('mexico');
    expect(game.queue[0]).toBe('boss');
    player.hp = 10;
    const pickup = app.pickups.spawnPickup(
      'health',
      player.center.clone().add(new Vector3(0, -0.6, 0)),
    );
    app.pickups.updatePickups(0);
    expect(state.pickups).not.toContain(pickup);
    expect(player.hp).toBe(45);
    const prop = state.level.breakables[0];
    const oldLevel = state.level;
    const count = world.boxes.length;
    app.combat.breakProp(prop, new Vector3(1, 0, 0), true);
    expect(prop.alive).toBe(false);
    expect(world.boxes.length).toBe(count - 1);
    app.controls.resetGame();
    expect(state.level).not.toBe(oldLevel);
    expect(state.level.key).toBe('mexico');
    expect(world.boxes.length).toBe(count);
    expect(state.level.breakables.every((item) => item.alive)).toBe(true);
    frame(1 / 60, 2);
  });

  it('advances waves, records rewards and handles solo death/checkpoints', () => {
    fixture = applicationFixture();
    const { app, game, enemies, player, frame, values } = fixture;
    app.controls.begin();
    app.waves.updateWaves(3);
    expect(enemies.alive).toBe(1);
    const enemy = enemies.enemies[0];
    enemies.damage(enemy, 100000, {
      point: enemy.center.clone(),
      dir: new Vector3(0, 1, 0),
      part: 'head',
      source: 'rifle',
      crit: true,
    });
    expect(game.kills).toBe(1);
    expect(game.score).toBeGreaterThan(100);
    game.queue.length = 0;
    app.waves.updateWaves(0.1);
    expect(game.intermission).toBe(8);
    app.waves.updateWaves(9);
    expect(game.wave).toBe(2);
    app.controls.jumpToWave(10);
    expect(values.get('paper_checkpoint')).toBe('10');
    player.takeDamage(1000, null);
    expect(game.state).toBe('dying');
    frame(0.05, 36);
    expect(game.state).toBe('dead');
    expect(document.querySelector('#hud').textContent).toContain('ERASED');
    app.controls.begin();
    expect(player.alive).toBe(true);
  });

  it('executes a focus dash and ends focus for online play', () => {
    fixture = applicationFixture();
    const { app, game, player, enemies, frame } = fixture;
    app.controls.begin();
    const enemy = enemies.spawn('grunt', player.body.pos.clone().add(new Vector3(0, 0, -4)));
    enemy.state = 'hunt';
    enemy.center.copy(enemy.body.pos).add(new Vector3(0, 1, 0));
    player.forward.set(0, 0, -1);
    player.eye.copy(player.body.pos).add(new Vector3(0, 1.6, 0));
    expect(app.focus.focusCandidate()).toBe(enemy);
    app.focus.enterFocus();
    expect(game.focus.active).toBe(true);
    app.focus.startFocusDash(enemy);
    frame(0.05, 8);
    expect(enemy.alive).toBe(false);
    game.mode = 'ffa';
    app.focus.updateFocus(3);
    app.focus.endFocus();
    expect(game.focus.active).toBe(false);
    expect(player.dashLock).toBe(false);
  });

  it('runs every enemy archetype through AI, projectiles, hits and cleanup', () => {
    fixture = applicationFixture();
    const { app, player, enemies, world, state, frame } = fixture;
    app.controls.begin();
    // Use a simple collision arena to exercise AI independently from randomly chosen map spawns.
    world.clear();
    world.addBox({ x: -60, y: -1, z: -60 }, { x: 60, y: 0, z: 60 });
    world.finalize();
    state.nav = new NavGrid(world, { minX: -20, maxX: 20, minZ: -20, maxZ: 20 }, 2).build();
    app.runtime.ctx.nav = state.nav;
    player.maxHp = player.hp = 100000;
    player.body.pos.set(0, 0, 0);
    for (const type of Object.keys(TYPES)) {
      const enemy = enemies.spawn(type, new Vector3(0, 0, -8));
      frame(0.05, 65);
      expect(Number.isFinite(enemy.body.pos.x)).toBe(true);
      enemies.damage(enemy, 100000, {
        point: enemy.center.clone(),
        dir: new Vector3(0, 1, 0),
        part: 'torso',
        source: 'katana',
        crit: false,
      });
      frame(0.05, 2);
    }
    expect(app.runtime.game.kills).toBeGreaterThanOrEqual(8);
    enemies.clear();
    expect(enemies.alive).toBe(0);
  });

  it('scores and respawns an FFA match without changing its rules', () => {
    fixture = applicationFixture();
    const { app, game, net, lobby, player, scores } = fixture;
    net.id = 'host';
    net.isHost = true;
    net.connected = true;
    net.peer = { destroy() {} };
    lobby.players.set('host', { name: 'player' });
    lobby.players.set('other', { name: '<img src=x>' });
    app.controls.hostStart();
    expect(game.mode).toBe('ffa');
    expect(player.shieldT).toBe(2);
    expect(scores.size).toBe(2);
    expect(app.match.boardHTML()).not.toContain('<img');
    app.match.tallyDeath('other', 'host');
    expect(scores.get('host').kills).toBe(1);
    player.lastHitBy = 'other';
    app.match.onLocalDeath();
    expect(game.state).toBe('dying');
    app.match.respawnLocal();
    expect(game.state).toBe('play');
    scores.get('host').kills = 20;
    app.match.checkWin();
    expect(game.state).toBe('over');
    app.screens.toLobbyScreen();
    expect(game.state).toBe('lobby');
  });

  it('renders and wires settings, checkpoints, lobby and main menu screens', () => {
    fixture = applicationFixture('mexico');
    const { app, state, values, game, hud, net, lobby } = fixture;
    const sens = document.querySelector('#setSens');
    sens.value = '150';
    sens.dispatchEvent(new Event('input'));
    expect(values.get('paper_sens')).toBe('150');
    document.querySelector('#onlineBtn').click();
    expect(state.screen).toBe('online');
    const name = document.querySelector('#setName');
    name.value = 'new player';
    name.dispatchEvent(new Event('input'));
    expect(values.get('paper_name')).toBe('new player');
    net.id = 'host';
    net.isHost = true;
    lobby.players.set('host', { name: 'new player' });
    lobby.hostId = 'host';
    game.state = 'lobby';
    app.screens.renderLobby();
    expect(hud.el.panel.textContent).toContain('LOBBY');
    app.screens.toMainMenu();
    expect(state.screen).toBe('main');
    app.controls.beginAtWave(5);
    app.controls.pause();
    document.querySelector('#menuBtn').click();
    expect(game.state).toBe('start');
  });

  it('releases input listeners, connections and scene resources exactly once', () => {
    fixture = applicationFixture();
    const { app, input, renderer } = fixture;
    app.dispose();
    app.dispose();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.keys.forward).not.toBe(true);
    expect(renderer.scene.children).toHaveLength(0);
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(window.__game).toBeUndefined();
  });
});
