import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { Effects } from '../../src/presentation/effects.js';
import { SceneResources } from '../../src/engine/resources.js';
import { World } from '../../src/engine/physics.js';
import baseline from '../fixtures/effects-baseline.json';

function frame(scene, effects) {
  scene.updateMatrixWorld(true);
  const meshes = [];
  scene.traverse((node) => {
    if (!node.isMesh) return;
    meshes.push({
      geometry: node.geometry.type,
      matrix: node.matrixWorld.elements,
      count: node.count,
      instances:
        node.instanceMatrix && Array.from(node.instanceMatrix.array.slice(0, node.count * 16)),
      colors: node.instanceColor && Array.from(node.instanceColor.array.slice(0, node.count * 3)),
    });
  });
  return {
    meshes,
    particles: effects.particles.length,
    fragments: effects.debrisList.length,
    gibs: effects.gibsAlive,
    shake: effects.shakeAmt,
  };
}

describe('effect simulation baseline', () => {
  it('preserves composed particle, decal and fragment output through expiry', () => {
    const scene = new Scene();
    const resources = new SceneResources();
    const world = new World();
    world.addBox(new Vector3(-25, -1, -25), new Vector3(25, 0, 25));
    world.addBox(new Vector3(1.5, 0, -5), new Vector3(2.5, 4, 5));
    const effects = new Effects(scene, world, resources);
    const pos = new Vector3(0, 1, 0),
      dir = new Vector3(0.5, 1, 0.2).normalize(),
      normal = new Vector3(0, 1, 0);
    effects.blood(pos, dir);
    effects.drip(pos);
    effects.boom(pos);
    effects.explosion(pos);
    effects.fountain(pos, dir);
    effects.shell(pos, dir);
    effects.smoke(pos, dir);
    effects.sparks(pos, normal);
    effects.strokeBurst(pos, 1);
    effects.tracer(pos, new Vector3(5, 1, 0));
    effects.bulletImpact(pos, normal);
    effects.splat(new Vector3(1.5, 1, 0), new Vector3(-1, 0, 0));
    effects.debris(
      new Mesh(new BoxGeometry(), new MeshBasicMaterial()),
      pos,
      new Vector3(3, 4, 2),
      new Vector3(1, 2, 3),
      { blood: true, life: 3 },
    );
    const frames = [frame(scene, effects)];
    for (let i = 1; i <= 250; i++) {
      effects.update(0.02);
      if ([1, 10, 40, 100, 250].includes(i)) frames.push(frame(scene, effects));
    }
    const actual = createHash('sha256').update(JSON.stringify(frames)).digest('hex');
    if (process.env.RECORD_EFFECTS_BASELINE === '1') {
      const path = 'tests/fixtures/effects-baseline.json';
      const saved = JSON.parse(readFileSync(path, 'utf8'));
      saved.composed = actual;
      writeFileSync(path, JSON.stringify(saved, null, 2) + '\n');
    } else expect(actual).toBe(baseline.composed);
    expect(effects.particles).toHaveLength(0);
    expect(effects.debrisList).toHaveLength(0);
    effects.dispose();
    resources.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
