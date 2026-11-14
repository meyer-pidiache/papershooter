import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { makeBody, SEE_THROUGH, World } from '../../src/engine/physics.js';

const vector = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);

function floorWorld() {
  const world = new World(2);
  world.addBox(vector(-10, -1, -10), vector(10, 0, 10));
  world.finalize();
  return world;
}

describe('collision world', () => {
  it('deduplicates spatial queries and removes/clears colliders', () => {
    const world = floorWorld();
    const queries: unknown[] = [];
    expect(world.query(vector(-2, -2, -2), vector(2, 1, 2), queries)).toHaveLength(1);
    expect(world.overlapsAABB(vector(20, 0, 20), vector(21, 1, 21))).toBe(false);
    world.removeBox({});
    const box = world.boxes[0];
    world.removeBox(box);
    expect(world.boxes).toHaveLength(0);
    world.clear();
    expect(world.grid.size).toBe(0);
  });

  it('finds ray distances, normals, ignored surfaces and unobstructed lines', () => {
    const world = floorWorld();
    expect(world.raycast(vector(0, 3), vector(0, -1))).toMatchObject({ dist: 3 });
    expect(world.raycast(vector(0, 3), vector(0, -1))?.normal.y).toBe(1);
    expect(world.raycast(vector(0, 3), vector(0, 1))).toBeNull();
    expect(world.raycast(vector(30, 3), vector(0, -1))).toBeNull();
    expect(world.raycast(vector(0, 3), vector(0, -1), 20, () => true)).toBeNull();
    expect(world.groundBelow(0, 10, 0)).toBe(0);
    expect(world.groundBelow(30, 10, 30, 8)).toBe(2);
    expect(world.hasLineOfSight(vector(), vector())).toBe(true);
    expect(world.hasLineOfSight(vector(0, 2), vector(2, 2))).toBe(true);
    expect(world.hasLineOfSight(vector(0, 2), vector(0, -2))).toBe(false);
    expect(SEE_THROUGH({ data: { noShoot: true } })).toBe(true);
  });

  it('lands a falling body and stops at walls and ceilings', () => {
    const world = floorWorld();
    world.addBox(vector(2, 0, -2), vector(3, 5, 2));
    world.addBox(vector(-2, 3, -2), vector(2, 4, 2));
    world.finalize();
    const body = makeBody(vector(0, 1), 0.35, 1.75);
    body.vel.set(0, -8, 0);
    world.moveBody(body, 0.2);
    expect(body.onGround).toBe(true);
    expect(body.pos.y).toBeCloseTo(0, 3);
    body.vel.set(20, 0, 0);
    world.moveBody(body, 0.15);
    expect(body.hitWall).toBe(true);
    expect(body.pos.x).toBeLessThan(1.66);
    body.pos.set(0, 0, 0);
    body.vel.set(0, 10, 0);
    world.moveBody(body, 0.2);
    expect(body.hitCeiling).toBe(true);
    expect(body.vel.y).toBe(0);
  });

  it('steps onto low platforms and snaps down when grounded', () => {
    const world = floorWorld();
    world.addBox(vector(1, 0, -1), vector(3, 0.3, 1));
    world.finalize();
    const body = makeBody(vector(0, 0.0001), 0.3, 1.75);
    body.onGround = true;
    body.vel.set(4, -0.1, 0);
    world.moveBody(body, 0.3);
    expect(body.pos.y).toBeCloseTo(0.3, 2);
    expect(world.overlapsBody(body)).toBe(false);
  });
});
