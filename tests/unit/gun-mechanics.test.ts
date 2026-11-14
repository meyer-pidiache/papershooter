import { describe, expect, it } from 'vitest';
import { GUNS } from '../../src/domain/weapons.js';
import type { WeaponFrame } from '../../src/domain/weapon-frame.js';
import { GunMechanics } from '../../src/gameplay/weapons/gun-mechanics.js';
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

describe('independent gun mechanics', () => {
  it.each([GUNS.rifle, GUNS.sniper, GUNS.revolver])(
    'conserves ammunition through a $kind reload',
    (spec) => {
      const state = new GunMechanics(spec),
        total = state.mag + state.reserve;
      state.beginShot();
      expect(state.mag + state.reserve).toBe(total - 1);
      expect(state.startReload()).toBe(true);
      state.advanceReload(spec.reloadDur / 2);
      expect(state.finishMagazine()).toBe(false);
      state.advanceReload(spec.reloadDur / 2);
      expect(state.finishMagazine()).toBe(true);
      expect(state.mag).toBe(spec.magSize);
      expect(state.mag + state.reserve).toBe(total - 1);
      expect(state.reloading).toBe(false);
    },
  );
  it('loads shells one at a time and can interrupt before the next shell arrives', () => {
    const state = new GunMechanics(GUNS.shotgun);
    state.mag = 0;
    expect(state.startReload()).toBe(true);
    state.advanceReload(GUNS.shotgun.reloadDur / 2);
    expect(state.finishShell()).toBe('waiting');
    state.advanceReload(GUNS.shotgun.reloadDur / 2);
    expect(state.finishShell()).toBe('loaded');
    expect(state.mag).toBe(1);
    const reserve = state.reserve;
    expect(state.interruptReload()).toBe(true);
    expect(state.reserve).toBe(reserve);
    expect(state.reloading).toBe(false);
  });
  it('starts the required pump after the final available shell and releases it when complete', () => {
    const state = new GunMechanics(GUNS.shotgun);
    state.mag = 0;
    state.reserve = 1;
    state.needPump = true;
    state.startReload();
    state.advanceReload(GUNS.shotgun.reloadDur);
    expect(state.finishShell()).toBe('complete');
    expect(state.pumpTime).toBe(GUNS.shotgun.cycleDur);
    expect(state.trigger({ ...frame, firePressed: true })).toBe('none');
    expect(state.advancePump(1)?.finished).toBe(true);
    expect(state.needPump).toBe(false);
    expect(state.trigger({ ...frame, firePressed: true })).toBe('fire');
  });
  it('respects automatic versus pressed fire, cooldown and blocked fire', () => {
    const rifle = new GunMechanics(GUNS.rifle),
      sniper = new GunMechanics(GUNS.sniper);
    expect(rifle.trigger({ ...frame, fire: true })).toBe('fire');
    expect(sniper.trigger({ ...frame, fire: true })).toBe('none');
    rifle.beginShot();
    expect(rifle.trigger({ ...frame, fire: true })).toBe('none');
    rifle.ageFire(1);
    expect(rifle.trigger({ ...frame, fire: true, blockFire: true })).toBe('none');
    rifle.mag = 0;
    expect(rifle.trigger({ ...frame, fire: true })).toBe('empty');
  });
  it('steadies a scoped moving shot when aiming and restores the original loadout on reset', () => {
    const state = new GunMechanics(GUNS.sniper);
    state.bloom(1, { ...frame, aim: true, speed: 20, grounded: false, sliding: true });
    expect(state.spread).toBeLessThan(0.01);
    state.beginShot();
    state.addAmmo(10000);
    expect(state.reserve).toBe(GUNS.sniper.maxReserve);
    state.resetAmmo();
    expect(state.mag).toBe(GUNS.sniper.magSize);
    expect(state.reserve).toBe(GUNS.sniper.reserve);
    expect(state.startReload()).toBe(false);
    state.mag = 0;
    state.reserve = 0;
    expect(state.startReload()).toBe(false);
  });
});
