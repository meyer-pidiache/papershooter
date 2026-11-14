import type { Falloff } from './weapons.js';
interface RayDistance {
  dist: number;
}
export type RayTarget = 'player' | 'enemy' | 'world' | 'miss';

// Ties preserve the original hit precedence: a wall beats an enemy; an enemy beats a player.
export function nearestRayTarget(
  enemy: RayDistance | null,
  world: RayDistance | null,
  player: RayDistance | null,
): RayTarget {
  if (player && (!enemy || player.dist < enemy.dist) && (!world || player.dist < world.dist))
    return 'player';
  if (enemy && (!world || enemy.dist < world.dist)) return 'enemy';
  return world ? 'world' : 'miss';
}
export function shotDamage(
  base: number,
  headMultiplier: number,
  falloff: Readonly<Falloff> | null,
  distance: number,
  critical: boolean,
) {
  let damage = base * (critical ? headMultiplier : 1);
  if (falloff)
    damage *= Math.max(
      falloff[2],
      Math.min(1, 1 - (distance - falloff[0]) / (falloff[1] - falloff[0])),
    );
  return damage;
}
