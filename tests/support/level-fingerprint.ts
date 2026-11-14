import { createHash } from 'node:crypto';
import { Mesh, Scene, Vector3 } from 'three';
import { buildLevel } from '../../src/maps/index.js';
import { World } from '../../src/engine/physics.js';

// Record output, not source text: extraction must preserve collision and procedural geometry.
export function levelFingerprint(key: string, arena: boolean) {
  const scene = new Scene();
  const world = new World();
  const level = buildLevel(scene, world, key, { arena });
  const hash = createHash('sha256');
  let vertices = 0;
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const positions = object.geometry.getAttribute('position');
    vertices += positions.count;
    hash.update(Buffer.from(positions.array.buffer));
    hash.update(JSON.stringify(object.matrixWorld.elements));
  });
  hash.update(
    JSON.stringify(
      world.boxes.map(({ min, max, data }) => ({
        min,
        max,
        data: {
          noNav: data.noNav,
          noShoot: data.noShoot,
          noGrapple: data.noGrapple,
          tag: data.tag,
          breakable: data.breakable?.id,
        },
      })),
    ),
  );
  const result = {
    key: level.key,
    bounds: level.bounds,
    start: level.playerStart.toArray(),
    spawns: level.spawns.map((p: Vector3) => p.toArray()),
    arenaSpawns: level.arenaSpawns.map((p: Vector3) => p.toArray()),
    colliders: world.boxes.length,
    breakables: level.breakables.length,
    animated: level.animated.length,
    vertices,
    digest: hash.digest('hex'),
  };
  scene.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    }
  });
  return result;
}

export function seededRandom(seed = 170) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
