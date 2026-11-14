import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { NavGrid } from '../../src/engine/navigation.js';
import { World } from '../../src/engine/physics.js';
import { disposeObjects } from '../../src/engine/resources.js';
import {
  angleLerp,
  approach,
  choose,
  clamp,
  Cooldown,
  damp,
  lerp,
  quatFromYTo,
  rand,
  randDir,
  randInt,
  smoothstep,
  Spring,
  Spring3,
  v3,
  wrapAngle,
  alignYAxis,
} from '../../src/engine/math.js';

describe('reusable engine primitives', () => {
  it('bounds interpolation, angles and random choices', () => {
    expect([clamp(-1, 0, 1), clamp(2, 0, 1), clamp(0.5, 0, 1)]).toEqual([0, 1, 0.5]);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(damp(0, 10, 1, 1)).toBeGreaterThan(0);
    expect([smoothstep(0, 1, -1), smoothstep(0, 1, 2)]).toEqual([0, 1]);
    expect([approach(0, 10, 2), approach(10, 0, 2)]).toEqual([2, 8]);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(angleLerp(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4);
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    expect(rand(2, 6)).toBe(3);
    expect(randInt(1, 4)).toBe(2);
    expect(choose(['a', 'b'])).toBe('a');
    expect(randDir().length()).toBeCloseTo(1);
    spy.mockRestore();
    expect(v3()).toEqual(new Vector3());
  });

  it('converges damped springs and expires cooldowns', () => {
    const spring = new Spring();
    spring.set(2);
    spring.kick(1);
    spring.target = 10;
    const vector = new Spring3();
    vector.target.set(1, 2, 3);
    vector.kick(1, 1, 1);
    for (let i = 0; i < 300; i++) {
      spring.update(0.03);
      vector.update(0.03);
    }
    expect(spring.value).toBeCloseTo(10);
    expect(vector.value.distanceTo(vector.target)).toBeLessThan(0.01);
    spring.update(0.01);
    vector.update(0.01);
    const cooldown = new Cooldown(2);
    expect(cooldown.ready()).toBe(true);
    cooldown.start();
    cooldown.update(1);
    expect(cooldown.frac).toBe(0.5);
    cooldown.update(2);
    cooldown.update(1);
    expect(cooldown.ready()).toBe(true);
    expect(new Cooldown().frac).toBe(0);
  });

  it('aligns reusable geometry and disposes shared GPU resources once', () => {
    const root = new Group();
    const scene = new Scene();
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    root.add(new Mesh(geometry, material), new Mesh(geometry, [material]));
    scene.add(root);
    alignYAxis(root, new Vector3(), new Vector3(0, 4, 0), 2);
    expect(root.position.y).toBe(2);
    expect(root.scale.y).toBe(4);
    expect(new Vector3(0, 1, 0).applyQuaternion(quatFromYTo(new Vector3(1, 0, 0))).x).toBeCloseTo(
      1,
    );
    alignYAxis(root, new Vector3(), new Vector3());
    expect(root.visible).toBe(false);
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    disposeObjects([root], scene);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });

  it('builds navigation from collisions and routes around obstacles', () => {
    const world = new World();
    world.addBox({ x: -5, y: -1, z: -5 }, { x: 5, y: 0, z: 5 });
    world.addBox({ x: -0.5, y: 0, z: -2 }, { x: 0.5, y: 3, z: 2 });
    world.finalize();
    const nav = new NavGrid(world, { minX: -5, minZ: -5, maxX: 5, maxZ: 5 }).build();
    const route = nav.findPath(new Vector3(-3, 0, 0), new Vector3(3, 0, 0));
    expect(route?.complete).toBe(true);
    expect(route!.some((node: Vector3) => Math.abs(node.z) > 2)).toBe(true);
    expect(nav.findPath(new Vector3(-3, 0, 0), new Vector3(3, 0, 0), 1)?.complete).toBe(false);
    expect(nav.nearestNode(new Vector3(1000, 0, 1000))).toBe(-1);
    expect(nav.randomNode()).toBeDefined();
    const empty = new NavGrid(new World(), { minX: 0, minZ: 0, maxX: 1, maxZ: 1 }).build();
    expect(empty.findPath(new Vector3(), new Vector3(1, 0, 1))).toBeNull();
  });
});
