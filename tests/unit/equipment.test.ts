import { describe, expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Equipment, type EquippableWeapon } from '../../src/gameplay/player/equipment.js';
import type { WeaponPose } from '../../src/domain/weapon-frame.js';

function fixture(kinds = ['rifle', 'shotgun', 'sniper', 'katana']) {
  const weapons: EquippableWeapon[] = kinds.map(
    (kind) =>
      ({
        kind,
        name: kind,
        hint: kind,
        isGun: kind !== 'katana',
        scope: kind === 'sniper',
        aimAmt: 0,
        adsFov: 60,
        root: new Group(),
        equip: vi.fn(),
        unequip: vi.fn(),
        animate: vi.fn(),
        ...(kind === 'katana'
          ? { startSlash: vi.fn() }
          : { resetAmmo: vi.fn(), addAmmoFraction: vi.fn() }),
      }) satisfies EquippableWeapon,
  );
  const feedback = { selected: vi.fn(), sights: vi.fn() },
    equipment = new Equipment(weapons, feedback),
    keys = new Set<string>(),
    edges = new Set<string>();
  const input = {
    down: (action: string) => keys.has(action),
    pressed: (action: string) => edges.has(action),
  };
  const pose: WeaponPose = {
    aiming: false,
    sprinting: false,
    grounded: true,
    speed: 0,
    sliding: false,
    lookDelta: { x: 0, y: 0 },
    strafe: 0,
    bobPhase: 0,
    bobAmt: 0,
    landDip: 0,
    alive: true,
  };
  return { weapons, feedback, equipment, keys, edges, input, pose };
}

describe('loadout commands', () => {
  it('returns to the previous gun after a temporary melee attack', () => {
    const f = fixture();
    f.equipment.switchTo(1);
    f.edges.add('melee');
    f.equipment.update(0.02, f.input, f.pose);
    expect(f.equipment.current.kind).toBe('katana');
    expect(f.weapons[3].startSlash).toHaveBeenCalledOnce();
    f.edges.clear();
    f.equipment.update(1, f.input, f.pose);
    expect(f.equipment.current.kind).toBe('shotgun');
  });
  it.each(['fire', 'aim', 'melee'])(
    'keeps the blade equipped after a deliberate %s command',
    (action) => {
      const f = fixture();
      f.edges.add('melee');
      f.equipment.update(0.02, f.input, f.pose);
      f.edges.clear();
      if (action === 'aim') f.keys.add('aim');
      else f.edges.add(action);
      f.equipment.update(0.02, f.input, f.pose);
      f.edges.clear();
      f.keys.clear();
      f.equipment.update(1, f.input, f.pose);
      expect(f.equipment.current.kind).toBe('katana');
    },
  );
  it('wraps loadout selection and clamps a slot above the available weapon count', () => {
    const f = fixture();
    f.edges.add('prevWeapon');
    f.equipment.update(0.02, f.input, f.pose);
    expect(f.equipment.index).toBe(3);
    f.edges.clear();
    f.edges.add('nextWeapon');
    f.equipment.update(0.02, f.input, f.pose);
    expect(f.equipment.index).toBe(0);
    f.edges.clear();
    f.edges.add('slot5');
    f.equipment.update(0.02, f.input, f.pose);
    expect(f.equipment.index).toBe(3);
    f.equipment.switchTo(-1);
    f.equipment.switchTo(100);
    expect(f.equipment.index).toBe(3);
  });
  it('restores gun ammunition through commands while retaining a valid weapon selection', () => {
    const f = fixture();
    f.equipment.switchTo(2);
    f.equipment.addAmmo(0.5);
    f.equipment.reset();
    expect(f.equipment.index).toBe(0);
    expect(f.weapons[0].resetAmmo).toHaveBeenCalledOnce();
    expect(f.weapons[0].addAmmoFraction).toHaveBeenCalledWith(0.5);
  });
  it('supports a loadout without a melee weapon and rejects an empty one', () => {
    const f = fixture(['rifle']);
    f.edges.add('melee');
    f.keys.add('fire');
    f.equipment.update(0.02, f.input, f.pose);
    expect(f.equipment.current.kind).toBe('rifle');
    expect(f.equipment.firing).toBe(true);
    expect(() => new Equipment([], f.feedback)).toThrow('at least one weapon');
  });
});
