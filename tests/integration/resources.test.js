// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';

let fixture;
afterEach(() => {
  fixture?.app.dispose();
  fixture = null;
});
const geometrySpies = (root) => {
  const geometries = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
  });
  return [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
};

describe('gameplay resource lifetimes', () => {
  it('releases evicted debris immediately when the retained-fragment cap is exceeded', () => {
    fixture = applicationFixture();
    const { effects } = fixture;
    let first;
    for (let i = 0; i < 71; i++) {
      const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
      if (i === 0) first = vi.spyOn(mesh.geometry, 'dispose');
      effects.debris(mesh, new Vector3(0, 10, 0), new Vector3(), new Vector3(), { blood: true });
    }
    expect(effects.debrisList).toHaveLength(70);
    expect(first).toHaveBeenCalledOnce();
    effects.clear();
    expect(effects.gibsAlive).toBe(0);
  });
  it('releases grenade meshes at fuse expiry and reset', () => {
    fixture = applicationFixture();
    const { player } = fixture;
    player.throwGrenade({ pos: [30, 10, 30], vel: [0, 0, 0] });
    const expired = geometrySpies(player.nades[0].mesh);
    player.nades[0].fuse = 0;
    player.updateNades(0.01);
    expect(expired.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    player.throwGrenade({ pos: [30, 10, 30], vel: [0, 0, 0] });
    const reset = geometrySpies(player.nades[0].mesh);
    player.clearNades();
    player.clearNades();
    expect(reset.every((spy) => spy.mock.calls.length === 1)).toBe(true);
  });
  it('keeps an enemy material alive until its detached fragments expire', () => {
    fixture = applicationFixture();
    const { enemies, effects } = fixture;
    const enemy = enemies.spawn('grunt', new Vector3(0, 1, 0));
    const geometry = geometrySpies(enemy.root);
    const material = vi.spyOn(enemy.mat, 'dispose');
    enemies.kill(enemy, { source: 'sniper', crit: true, dir: new Vector3(0, 1, 0) });
    expect(effects.debrisList.length).toBeGreaterThan(0);
    enemies.clear();
    expect(material).not.toHaveBeenCalled();
    effects.clear();
    expect(material).toHaveBeenCalledOnce();
    expect(geometry.every((spy) => spy.mock.calls.length === 1)).toBe(true);
  });
  it('releases replaced remote weapons and transfers corpse ownership to effects', () => {
    fixture = applicationFixture();
    const { app, effects } = fixture;
    const remote = app.multiplayer.addRemote('guest', 'paper');
    const weapon = geometrySpies(remote.J.gun);
    const material = vi.spyOn(remote.mat, 'dispose');
    remote.setWeapon(1);
    expect(weapon.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    remote.ragdoll(new Vector3(0, 1, 0), true);
    app.multiplayer.removeRemote('guest');
    expect(material).not.toHaveBeenCalled();
    effects.clear();
    expect(material).toHaveBeenCalledOnce();
  });
  it('releases retired debris and bounds retained pickup resources across repeated collections', () => {
    fixture = applicationFixture();
    const { effects, app, resources } = fixture;
    const baseline = resources.resourceCount;
    for (let i = 0; i < 20; i++) {
      const pickup = app.pickups.spawnPickup('ammo', new Vector3(30, 1, 30));
      app.pickups.removePickup(pickup);
    }
    expect(resources.resourceCount).toBe(baseline);
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    const geometry = vi.spyOn(mesh.geometry, 'dispose');
    effects.debris(mesh, new Vector3(0, 20, 0), new Vector3(), new Vector3(), { life: 0.01 });
    effects.update(0.02);
    expect(geometry).toHaveBeenCalledOnce();
    app.dispose();
    expect(resources.resourceCount).toBe(0);
    expect(resources.size).toBe(0);
  });
});
