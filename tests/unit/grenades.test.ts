import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scene, Vector3 } from 'three';
import { Grenades, type GrenadeVisualPort } from '../../src/gameplay/player/grenades.js';
import { GrenadeVisuals } from '../../src/presentation/grenades.js';
import { World } from '../../src/engine/physics.js';
import { SceneResources } from '../../src/engine/resources.js';

let resources: SceneResources;
afterEach(() => resources?.dispose());
function fixture() {
  const world = new World();
  world.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
  const scene = new Scene();
  resources = new SceneResources();
  const visuals: GrenadeVisualPort = new GrenadeVisuals(scene, world, resources);
  const feedback = { thrown: vi.fn(), bounce: vi.fn(), fuse: vi.fn() };
  const grenades = new Grenades(world, visuals, feedback);
  const pose = {
    eye: new Vector3(0, 1.6, 0),
    forward: new Vector3(0, 0, -1),
    right: new Vector3(1, 0, 0),
    velocity: new Vector3(),
  };
  return { grenades, feedback, pose, scene };
}

describe('independent grenade ownership', () => {
  it('charges only when equipped to throw and cancels a held throw after death', () => {
    const { grenades, pose, feedback } = fixture();
    grenades.updateInput(0.5, true, true, true, pose);
    expect(grenades.charge).toBe(0);
    grenades.updateInput(2, true, true, false, pose);
    expect(grenades.charge).toBe(1);
    grenades.updateInput(0.01, false, false, false, pose);
    expect(feedback.thrown).not.toHaveBeenCalled();
    expect(grenades.stock).toBe(3);
    expect(grenades.charge).toBe(0);
    grenades.stock = 0;
    grenades.updateInput(0.5, true, true, false, pose);
    expect(grenades.charge).toBe(0);
  });
  it('keeps remote throws outside local inventory and reports their fuse expiry once', () => {
    const { grenades, pose, feedback, scene } = fixture();
    const explosion = vi.fn();
    grenades.onExplosion = explosion;
    grenades.throw({ pos: [10, 10, 10], vel: [0, 0, 0] }, 0, pose);
    expect(grenades.stock).toBe(3);
    expect(feedback.thrown).not.toHaveBeenCalled();
    grenades.projectiles[0].fuse = 0;
    grenades.update(0.02);
    grenades.update(0.02);
    expect(explosion).toHaveBeenCalledOnce();
    expect(explosion.mock.calls[0][1]).toBe(false);
    expect(grenades.projectiles).toHaveLength(0);
    expect(scene.children).toHaveLength(0);
    expect(resources.resourceCount).toBe(0);
  });
  it('clears active projectiles and hides reusable preview geometry on reset', () => {
    const { grenades, pose, scene } = fixture();
    grenades.updateInput(0.5, true, true, false, pose);
    expect(scene.children.some((node) => node.visible)).toBe(true);
    grenades.updateInput(0.01, false, true, false, pose);
    expect(grenades.stock).toBe(2);
    expect(grenades.projectiles).toHaveLength(1);
    grenades.reset();
    expect(grenades.stock).toBe(3);
    expect(grenades.projectiles).toHaveLength(0);
    expect(scene.children.every((node) => !node.visible)).toBe(true);
  });
});
