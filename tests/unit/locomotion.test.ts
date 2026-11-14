import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { makeBody, World } from '../../src/engine/physics.js';
import { Locomotion } from '../../src/gameplay/player/locomotion.js';
import type {
  MovementFeedback,
  MovementGrapple,
  MovementInput,
} from '../../src/gameplay/player/movement-contracts.js';

function fixture() {
  const world = new World(),
    body = makeBody(new Vector3(), 0.35, 1.75, 0.55);
  const grapple: MovementGrapple = { mode: 'idle', detach: vi.fn(), update: vi.fn() };
  const feedback: MovementFeedback = {
    jump: vi.fn(),
    lunge: vi.fn(),
    wallJump: vi.fn(),
    airJump: vi.fn(),
    slide: vi.fn(),
    dash: vi.fn(),
    mantle: vi.fn(),
    land: vi.fn(),
    fell: vi.fn(),
  };
  const keys = new Set<string>(),
    edges = new Set<string>();
  const input: MovementInput = {
    move: { x: 0, y: 0 },
    usingGamepad: false,
    down: (action) => keys.has(action),
    pressed: (action) => edges.has(action),
  };
  const motor = new Locomotion(
    body,
    { center: new Vector3(0, 1, 0), right: new Vector3(1, 0, 0) },
    { world, spawnPoint: () => new Vector3(10, 2, 10) },
    grapple,
    feedback,
  );
  return { world, body, grapple, feedback, input, keys, edges, motor };
}

describe('locomotion boundaries', () => {
  it('keeps the body crouched beneath an obstruction until standing is safe', () => {
    const f = fixture();
    f.body.onGround = true;
    f.keys.add('crouch');
    f.motor.read(0.02, f.input, 0, true);
    expect(f.body.height).toBe(1.05);
    f.world.addBox({ x: -2, y: 1.2, z: -2 }, { x: 2, y: 2, z: 2 });
    f.world.finalize();
    f.keys.clear();
    f.motor.read(0.02, f.input, 0, true);
    expect(f.body.height).toBe(1.05);
    f.world.clear();
    f.motor.read(0.02, f.input, 0, true);
    expect(f.body.height).toBe(1.75);
  });
  it('freezes focus-driven movement and preserves the jump grace when released', () => {
    const f = fixture();
    f.body.vel.set(1, 2, 3);
    f.body.onGround = true;
    f.motor.dashLock = true;
    expect(f.motor.freezeIfLocked()).toBe(true);
    expect(f.body.vel.length()).toBe(0);
    expect(f.body.onGround).toBe(false);
    f.motor.dashLock = false;
    expect(f.motor.freezeIfLocked()).toBe(false);
    f.edges.add('jump');
    const motion = f.motor.read(0.02, f.input, 0, true);
    f.motor.accelerate(0.02, motion);
    f.motor.jump(0.02, f.input, motion);
    expect(f.feedback.jump).toHaveBeenCalledOnce();
    expect(f.feedback.airJump).not.toHaveBeenCalled();
    expect(f.body.vel.y).toBe(9.6);
  });
  it('returns an out-of-bounds body to the supplied spawn and reports the fall once', () => {
    const f = fixture();
    f.body.pos.set(0, -13, 0);
    const motion = f.motor.read(0.01, f.input, 0, true);
    f.motor.integrate(0.01, f.input, motion);
    expect(f.body.pos.toArray()).toEqual([10, 2, 10]);
    expect(f.body.vel.length()).toBe(0);
    expect(f.feedback.fell).toHaveBeenCalledOnce();
    expect(f.grapple.detach).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('applies a lunge along the view direction and releases ground attachment', () => {
    const f = fixture();
    f.body.onGround = true;
    f.motor.lunge(4, new Vector3(0, 0, -1));
    expect(f.body.onGround).toBe(false);
    expect(f.body.vel.z).toBe(-4);
    expect(f.body.vel.y).toBe(2.5);
    expect(f.feedback.lunge).toHaveBeenCalledOnce();
  });
  it('mantles a reachable ledge when the space above it is clear', () => {
    const f = fixture();
    f.world.addBox({ x: -2, y: 0, z: -1.1 }, { x: 2, y: 1.3, z: -0.85 });
    f.world.finalize();
    f.input.move.y = 1;
    const motion = f.motor.read(0.01, f.input, 0, true);
    f.motor.accelerate(0.01, motion);
    f.motor.jump(0.01, f.input, motion);
    f.motor.integrate(0.01, f.input, motion);
    expect(f.feedback.mantle).toHaveBeenCalledOnce();
    expect(f.body.vel.y).toBeGreaterThan(0);
  });
});
