import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { makeBody } from '../../src/engine/physics.js';
import { PlayerCombat } from '../../src/gameplay/player/combat-state.js';

function fixture() {
  const body = makeBody(new Vector3(), 0.35, 1.75, 0.55);
  const pose = {
    eye: new Vector3(0, 1.6, 0),
    center: new Vector3(0, 1, 0),
    forward: new Vector3(0, 0, -1),
    right: new Vector3(1, 0, 0),
  };
  const weapon = { kind: 'katana', blocking: true, blockT: 0 };
  const feedback = { hurt: vi.fn(), deflected: vi.fn(), meleeBlocked: vi.fn(), died: vi.fn() };
  const combat = new PlayerCombat(body, pose, () => weapon, feedback);
  return { body, pose, weapon, feedback, combat };
}

describe('local health and guard state', () => {
  it('recovers only after the damage delay while neither sprinting nor grappling', () => {
    const { combat } = fixture();
    combat.takeDamage(40, null);
    combat.age(4.5);
    combat.recover(1, false, true);
    expect(combat.hp).toBe(80);
    combat.age(0.01);
    combat.recover(1, true, true);
    combat.recover(1, false, false);
    expect(combat.hp).toBe(80);
    combat.recover(1, false, true);
    expect(combat.hp).toBe(91);
    combat.recover(10, false, true);
    expect(combat.hp).toBe(120);
  });
  it('emits death once and cannot regenerate or take damage until reset', () => {
    const { combat, feedback } = fixture();
    combat.takeDamage(1000, null);
    combat.takeDamage(10, null);
    combat.die();
    combat.age(10);
    combat.recover(10, false, true);
    expect(combat.hp).toBe(0);
    expect(combat.alive).toBe(false);
    expect(feedback.died).toHaveBeenCalledOnce();
    expect(feedback.hurt).toHaveBeenCalledOnce();
    combat.maxHp = 110;
    combat.reset();
    expect(combat.hp).toBe(110);
    expect(combat.alive).toBe(true);
  });
  it('rejects projectiles from the flank or rear and enforces the guard cooldown', () => {
    const { combat, feedback } = fixture(),
      pos = new Vector3(0, 1, -0.5);
    expect(combat.tryDeflect({ pos, vel: new Vector3(-1, 0, 0) })).toBe(false);
    expect(combat.tryDeflect({ pos, vel: new Vector3(0, 0, -1) })).toBe(false);
    expect(combat.tryDeflect({ pos, vel: new Vector3(0, 0, 1) })).toEqual({
      perfect: true,
      ret: true,
    });
    expect(combat.blockRadius).toBe(0);
    expect(combat.tryDeflect({ pos, vel: new Vector3(0, 0, 1) })).toBe(false);
    combat.coolBlock(0.2);
    expect(combat.blockRadius).toBe(0.95);
    expect(feedback.deflected).toHaveBeenCalledOnce();
  });
  it('only returns ordinary blocks according to their existing random chance', () => {
    const { combat, weapon } = fixture();
    weapon.blockT = 0.26;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(combat.tryDeflect({ pos: new Vector3(), vel: new Vector3(0, 0, 1) })).toEqual({
      perfect: false,
      ret: false,
    });
    combat.coolBlock(0.2);
    vi.mocked(Math.random).mockReturnValue(0.1);
    expect(combat.tryDeflect({ pos: new Vector3(), vel: new Vector3(0, 0, 1) })).toEqual({
      perfect: false,
      ret: true,
    });
  });
  it('keeps melee parries within their time window and forward cone', () => {
    const { combat, weapon, feedback } = fixture();
    expect(combat.tryBlockMelee({ center: new Vector3(0, 1, 2) })).toBe(false);
    expect(combat.tryBlockMelee({ center: new Vector3(0, 1, -2) })).toBe(true);
    combat.recover(0.55, false, true);
    expect(combat.parryWindow).toBe(false);
    expect(combat.tryBlockMelee({ center: new Vector3(0, 1, -2) })).toBe(false);
    weapon.blocking = false;
    combat.recover(0.01, false, true);
    weapon.blocking = true;
    expect(combat.parryWindow).toBe(true);
    expect(feedback.meleeBlocked).toHaveBeenCalledOnce();
  });
  it('applies knockback to the physics body and disables ground attachment', () => {
    const { body, combat } = fixture();
    body.onGround = true;
    combat.knockback(new Vector3(1, 0, 0), 8);
    expect(body.vel.toArray()).toEqual([8, 4, 0]);
    expect(body.onGround).toBe(false);
  });
});
