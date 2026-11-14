import { expect, it } from 'vitest';
import { nearestRayTarget, shotDamage } from '../../src/domain/ballistics.js';
const hit = (dist: number | null) => (dist === null ? null : { dist });
it.each([
  [null, null, null, 'miss'],
  [10, null, null, 'enemy'],
  [null, 10, null, 'world'],
  [null, null, 10, 'player'],
  [10, 20, 5, 'player'],
  [5, 20, 10, 'enemy'],
  [20, 5, 10, 'world'],
  [10, 10, 10, 'world'],
  [10, 20, 10, 'enemy'],
  [null, 10, 10, 'world'],
] as const)(
  'selects the nearest target with stable tie precedence (%s,%s,%s)',
  (enemy, world, player, expected) => {
    expect(nearestRayTarget(hit(enemy), hit(world), hit(player))).toBe(expected);
  },
);
it('applies critical damage and bounds distance falloff at both ends', () => {
  expect(shotDamage(24, 2, null, 100, false)).toBe(24);
  expect(shotDamage(24, 2, null, 100, true)).toBe(48);
  expect(shotDamage(24, 2, [10, 30, 0.2], 0, false)).toBe(24);
  expect(shotDamage(24, 2, [10, 30, 0.2], 20, false)).toBe(12);
  expect(shotDamage(24, 2, [10, 30, 0.2], 40, true)).toBeCloseTo(9.6);
});
