import { describe, expect, it } from 'vitest';
import { MeleeMechanics } from '../../src/gameplay/weapons/melee-mechanics.js';
import type { WeaponFrame } from '../../src/domain/weapon-frame.js';
const frame: WeaponFrame = {
  fire: false,
  firePressed: false,
  aim: false,
  reloadPressed: false,
  meleePressed: false,
  sprinting: false,
  grounded: true,
  speed: 0,
  sliding: false,
  lookDelta: { x: 0, y: 0 },
  strafe: 0,
  bobPhase: 0,
  bobAmt: 0,
  landDip: 0,
  slideTilt: 0,
  blockFire: false,
};

describe('independent melee timing', () => {
  it('reports exactly one hit after the active part of a swing begins', () => {
    const state = new MeleeMechanics();
    state.startSlash();
    expect(state.advanceSwing(0.05)?.hit).toBe(false);
    expect(state.advanceSwing(0.04)?.hit).toBe(true);
    expect(state.advanceSwing(0.1)?.hit).toBe(false);
    expect(state.advanceSwing(0.2)?.hit).toBe(false);
    expect(state.advanceSwing(0.1)).toBeNull();
  });
  it('alternates combo directions and resets after the combo window', () => {
    const state = new MeleeMechanics();
    state.startSlash();
    expect(state.direction).toBe(1);
    state.startSlash();
    expect(state.direction).toBe(-1);
    state.age(1);
    state.startSlash();
    expect(state.direction).toBe(1);
  });
  it('starts guard only outside an attack/cooldown and resets the guard window on re-entry', () => {
    const state = new MeleeMechanics();
    state.startSlash();
    state.guard(0.1, { ...frame, aim: true });
    expect(state.blocking).toBe(false);
    state.age(0.4);
    state.advanceSwing(0.4);
    state.guard(0.1, { ...frame, aim: true });
    expect(state.blocking).toBe(true);
    expect(state.blockTime).toBe(0.1);
    state.guard(0.2, { ...frame, aim: true });
    expect(state.blockTime).toBeCloseTo(0.3);
    state.guard(0.1, { ...frame, aim: true, fire: true });
    expect(state.blocking).toBe(false);
    state.guard(0.05, { ...frame, aim: true });
    expect(state.blockTime).toBe(0.05);
  });
  it('requires a fresh trigger or an active combo for held fire, and honors blocked fire', () => {
    const state = new MeleeMechanics();
    expect(state.wantsFire({ ...frame, fire: true })).toBe(false);
    expect(state.wantsFire({ ...frame, firePressed: true })).toBe(true);
    state.startSlash();
    expect(state.wantsFire({ ...frame, fire: true })).toBe(false);
    state.age(0.4);
    state.advanceSwing(0.4);
    expect(state.wantsFire({ ...frame, fire: true })).toBe(true);
    expect(state.wantsFire({ ...frame, fire: true, blockFire: true })).toBe(false);
    expect(state.wantsMelee({ ...frame, meleePressed: true })).toBe(true);
  });
});
