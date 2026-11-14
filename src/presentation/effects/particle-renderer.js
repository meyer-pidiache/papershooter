import * as THREE from 'three';
import { clamp, lerp } from '../../engine/math.js';
import { InstancePool } from './instance-pool.js';
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion(),
  _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
export class ParticleRenderer {
  constructor(scene, resources) {
    this.drops = new InstancePool(scene, resources, new THREE.IcosahedronGeometry(0.5, 1), 700);
    this.strokes = new InstancePool(scene, resources, new THREE.BoxGeometry(1, 1, 1), 600);
  }
  render(particles) {
    let di = 0,
      si = 0;
    const drops = this.drops,
      strokes = this.strokes;
    for (const p of particles) {
      const frac = p.life / p.maxLife;
      if (p.kind === 'drop') {
        if (di >= drops.max) continue;
        const s = p.size * (p.grow ? lerp(1, p.grow, 1 - frac) : p.shrink ? 0.4 + 0.6 * frac : 1);
        _s.set(s, s, s);
        _q.identity();
        drops.write(di++, p.pos, _q, _s, p.ink, p.fill);
      } else if (p.kind === 'stroke') {
        if (si >= strokes.max) continue;
        let len;
        if (p.len > 0) {
          _d.copy(p.axis);
          len = p.len;
        } else {
          const sp = p.vel.length();
          if (sp < 1e-4) {
            _d.set(0, 1, 0);
            len = p.size;
          } else {
            _d.copy(p.vel).divideScalar(sp);
            len = clamp(sp * p.stretch, p.size * 2, 1.6);
          }
        }
        _q.setFromUnitVectors(_up, _d);
        const w = p.size * (p.shrink ? 0.5 + 0.5 * frac : 1);
        _s.set(w, len, w);
        strokes.write(si++, p.pos, _q, _s, p.ink, p.fill);
      }
    }
    drops.mesh.count = di;
    strokes.mesh.count = si;
    drops.mesh.instanceMatrix.needsUpdate = true;
    drops.mesh.instanceColor.needsUpdate = true;
    strokes.mesh.instanceMatrix.needsUpdate = true;
    strokes.mesh.instanceColor.needsUpdate = true;
  }
  clear() {
    this.drops.reset();
    this.strokes.reset();
  }
  dispose() {
    this.drops.dispose();
    this.strokes.dispose();
  }
}
