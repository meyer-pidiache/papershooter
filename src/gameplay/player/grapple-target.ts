import { Vector3 } from 'three';
import type { Collider } from '../../engine/physics.js';
import type {
  GrappleEnemy,
  GrappleMover,
  GrapplePose,
  GrappleQueries,
  GrappleTarget,
  GrappleWorldPort,
} from './grapple-contracts.js';

const offset = new Vector3();
const cannotHook = (box: Collider) => !!box.data.noGrapple;

function movingTarget(
  pose: GrapplePose,
  movers: readonly GrappleMover[],
  maximum: number,
): GrappleTarget | null {
  let best: GrappleTarget | null = null,
    nearestLateral = Infinity;
  for (const mover of movers) {
    offset.subVectors(mover.mesh.position, pose.eye);
    const distance = offset.dot(pose.forward);
    if (distance < 2 || distance > maximum) continue;
    const lateral = Math.sqrt(Math.max(0, offset.lengthSq() - distance * distance));
    if (lateral < mover.radius + 0.3 + distance * 0.012 && lateral < nearestLateral) {
      nearestLateral = lateral;
      best = { point: mover.mesh.position.clone(), mover, dist: distance };
    }
  }
  return best;
}
function assistedEnemy(
  pose: GrapplePose,
  world: GrappleWorldPort,
  enemies: readonly GrappleEnemy[],
  maximum: number,
): GrappleTarget | null {
  let best: GrappleTarget | null = null,
    nearestLateral = Infinity;
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.state === 'spawn') continue;
    offset.subVectors(enemy.center, pose.eye);
    const distance = offset.dot(pose.forward);
    if (distance < 1.5 || distance > maximum) continue;
    const lateral = Math.sqrt(Math.max(0, offset.lengthSq() - distance * distance));
    if (lateral > 1.1 + distance * 0.06 || lateral >= nearestLateral) continue;
    if (!world.hasLineOfSight(pose.eye, enemy.center)) continue;
    best = { point: enemy.center.clone(), enemy, dist: distance };
    nearestLateral = lateral;
  }
  return best;
}
function ringTarget(
  pose: GrapplePose,
  rings: readonly Vector3[],
  maximum: number,
): GrappleTarget | null {
  let best: Vector3 | null = null,
    nearestLateral = Infinity,
    distanceToBest = Infinity;
  for (const ring of rings) {
    offset.subVectors(ring, pose.eye);
    const distance = offset.dot(pose.forward);
    if (distance < 2 || distance > maximum) continue;
    const lateral = Math.sqrt(Math.max(0, offset.lengthSq() - distance * distance));
    if (lateral > 0.8 + distance * 0.02) continue;
    if (lateral < nearestLateral) {
      best = ring;
      distanceToBest = distance;
      nearestLateral = lateral;
    }
  }
  return best ? { point: best.clone(), enemy: null, dist: distanceToBest } : null;
}

// Preserve precedence: exact enemy, moving prop, assisted enemy, ring, then the aimed surface.
export function findGrappleTarget(
  pose: GrapplePose,
  world: GrappleWorldPort,
  queries: GrappleQueries,
): GrappleTarget | null {
  const wall = world.raycast(pose.eye, pose.forward, 75, cannotHook);
  const wallDistance = wall ? wall.dist : 75;
  const exact = queries.raycastEnemy(pose.eye, pose.forward, Math.min(50, wallDistance + 0.5));
  if (exact) return { point: exact.point.clone(), enemy: exact.enemy, dist: exact.dist };
  const moving = movingTarget(
    pose,
    queries.landmarks().grappleMovers || [],
    Math.min(75, wallDistance + 1),
  );
  if (moving) return moving;
  const enemy = assistedEnemy(pose, world, queries.enemies(), Math.min(45, wallDistance + 1.5));
  if (enemy) return enemy;
  const ring = ringTarget(pose, queries.landmarks().rings, Math.min(75, wallDistance + 1.5));
  if (ring) return ring;
  return wall
    ? { point: wall.point.clone().addScaledVector(wall.normal, 0.12), enemy: null, dist: wall.dist }
    : null;
}
