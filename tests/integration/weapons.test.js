// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';
import { Rifle, Shotgun, Sniper, Revolver } from '../../src/gameplay/weapons.js';
import { encodeLocal, RemotePlayer } from '../../src/gameplay/remote-player.js';
import { INK } from '../../src/shared/ink.js';

let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('weapons and multiplayer models', () => {
  it.each([Rifle, Shotgun, Sniper, Revolver])(
    '%s fires, reloads and conserves ammunition',
    (Weapon) => {
      vi.useFakeTimers();
      fixture = applicationFixture();
      const { app, ctx, player, world, enemies } = fixture;
      app.controls.begin();
      world.clear();
      world.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
      world.finalize();
      player.body.pos.set(0, 0, 0);
      player._updateCamera(0.1);
      const gun = new Weapon(ctx);
      const st = player._weaponState(false, false, 0);
      const total = gun.mag + gun.reserve;
      gun.fire(st);
      expect(gun.mag + gun.reserve).toBe(total - 1);
      const remaining = gun.mag + gun.reserve;
      gun.mag = 0;
      gun.reserve = remaining;
      gun.startReload();
      for (let i = 0; i < 100; i++) gun.animate(0.05, st);
      expect(gun.reloading).toBe(false);
      expect(gun.mag).toBe(gun.magSize);
      expect(gun.mag + gun.reserve).toBe(remaining);
      gun.addAmmo(100000);
      expect(gun.reserve).toBe(gun.maxReserve);
      const enemy = enemies.spawn('grunt', new Vector3(0, 0, -6));
      enemies.update(0.8);
      const before = enemy.hp;
      expect(gun.fireRay(player.eye, enemy.center.clone().sub(player.eye).normalize())).toBe(true);
      expect(enemy.hp).toBeLessThan(before);
      gun.fireRay(player.eye, new Vector3(0, -1, 0));
      gun.fireRay(player.eye, new Vector3(0, 1, 0));
      gun.root.traverse((object) => {
        object.geometry?.dispose();
      });
    },
  );

  it('automatically reloads an empty magazine after its owned delay', () => {
    vi.useFakeTimers();
    fixture = applicationFixture();
    fixture.app.controls.begin();
    const gun = fixture.player.weapon;
    gun.mag = 1;
    gun.fire(fixture.player._weaponState(false, false, 0));
    vi.advanceTimersByTime(249);
    expect(gun.reloading).toBe(false);
    vi.advanceTimersByTime(1);
    expect(gun.reloading).toBe(true);
  });
  it('cancels pending automatic reload when the application is disposed', () => {
    vi.useFakeTimers();
    fixture = applicationFixture();
    fixture.app.controls.begin();
    const gun = fixture.player.weapon;
    gun.mag = 1;
    gun.fire(fixture.player._weaponState(false, false, 0));
    const reload = vi.spyOn(gun, 'startReload');
    fixture.app.dispose();
    vi.advanceTimersByTime(300);
    expect(reload).not.toHaveBeenCalled();
    expect(gun.reloading).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not start a melee attack from input after the local player dies', () => {
    vi.useFakeTimers();
    fixture = applicationFixture();
    fixture.app.controls.begin();
    fixture.player.switchTo(3);
    const slash = vi.spyOn(fixture.player.weapon, 'startSlash');
    fixture.player.die();
    fixture.input.keys.melee = true;
    fixture.input.update(0.02);
    fixture.player.update(0.02);
    expect(fixture.player.alive).toBe(false);
    expect(slash).not.toHaveBeenCalled();
  });
  it('slashes, blocks and parries with the katana, and detonates thrown grenades', () => {
    vi.useFakeTimers();
    fixture = applicationFixture();
    const { app, player, input, enemies, frame, world } = fixture;
    app.controls.begin();
    world.clear();
    world.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
    world.finalize();
    player.body.pos.set(0, 0, 0);
    player._updateCamera(0.1);
    player.switchTo(3);
    const blade = player.weapon;
    const st = {
      ...player._weaponState(false, false, 0),
      aim: true,
      fire: false,
      firePressed: false,
    };
    blade.animate(0.1, st);
    expect(blade.blocking).toBe(true);
    blade.onDeflect(true);
    blade.onDeflect(false);
    blade.addBlood(1);
    blade.updateBlood(0.1, st);
    expect(blade.bloodLevel).toBeGreaterThan(0);
    const enemy = enemies.spawn('grunt', player.body.pos.clone().add(new Vector3(0, 0, -2)));
    enemy.state = 'hunt';
    enemies.update(0);
    const before = enemy.hp;
    blade.startSlash({ ...st, grounded: true });
    blade.doHit(st, 1);
    expect(enemy.hp).toBeLessThan(before);
    for (const pickup of [...fixture.state.pickups]) app.pickups.removePickup(pickup);
    const grenades = player.grenades;
    input.keys.grenade = true;
    frame(0.05, 5);
    input.keys.grenade = false;
    frame();
    expect(player.grenades).toBe(grenades - 1);
    expect(player.nades).toHaveLength(1);
    frame(0.05, 40);
    expect(player.nades).toHaveLength(0);
    player.addAmmoAll();
    player.recoil(0.1, 0.1);
    player.lunge(2);
    expect(player.aimDir(0.1).length()).toBeCloseTo(1);
  });

  it('round trips snapshots, animates remote states and reconstructs a respawned model', () => {
    fixture = applicationFixture();
    const { ctx, player } = fixture;
    const remote = new RemotePlayer(ctx, 'other', 'other', 0, INK.RED);
    player.body.pos.set(2, 0, 3);
    player.body.vel.set(2, 1, 0);
    player.grapple.state = 'on';
    player.grapple.hook.set(5, 5, 5);
    let snapshot = encodeLocal(player, 0, { firing: true, idle: true });
    remote.push(snapshot, 1);
    remote.update(0.05, 1.1);
    expect(remote.body.pos.distanceTo(player.body.pos)).toBeLessThan(1);
    expect(remote.grappling).toBe(true);
    expect(remote.idle).toBe(true);
    for (const weapon of [1, 2, 3]) {
      remote.setWeapon(weapon);
      remote.flash();
      remote.update(0.1, 1.2);
    }
    const onDamage = vi.fn();
    remote.onDamage = onDamage;
    remote.takeDamage(10, player.center);
    expect(onDamage).toHaveBeenCalledWith(remote, 10, player.center);
    remote.blocking = true;
    remote.parryWindow = true;
    remote.alive = true;
    expect(remote.isBlocking).toBe(true);
    expect(remote.blockRadius).toBe(0); // The owner's client resolves physical blocking.
    remote.tryBlockMelee({ center: remote.eye.clone().add(remote.forward) });
    expect(remote.tryDeflect()).toBe(false);
    remote.knockback();
    remote.ragdoll(new Vector3(0, 1, 0), true);
    remote.alive = false;
    remote.update(0.1, 2);
    player.grapple.state = 'idle';
    player.crouching = true;
    snapshot = encodeLocal(player, 3, { away: true });
    remote.push(snapshot, 2.1);
    remote.update(0.1, 2.2);
    expect(remote.root.visible).toBe(false);
    remote.push(encodeLocal(player, 3), 2.3);
    remote.update(0.1, 2.4);
    expect(remote.alive).toBe(true);
    remote.push(null, 3);
    remote.dispose();
  });
});
