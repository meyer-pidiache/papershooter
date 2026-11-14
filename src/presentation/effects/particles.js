import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand } from '../../engine/math.js';
import { SEE_THROUGH } from '../../engine/physics.js';
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _d = new THREE.Vector3(),
  _prev = new THREE.Vector3();
export class ParticleSimulation {
  constructor(world, decals) {
    this.world = world;
    this.decals = decals;
    this.list = [];
  }
  spawn(kind, pos, vel, o = {}) {
    const p = {
      kind,
      pos: pos.clone(),
      vel: vel ? vel.clone() : null,
      life: o.life ?? 1,
      maxLife: o.life ?? 1,
      size: o.size ?? 0.05,
      ink: o.ink ?? INK.RED,
      fill: o.fill ?? true,
      gravity: o.gravity ?? 20,
      drag: o.drag ?? 0,
      collide: o.collide ?? null,
      stretch: o.stretch ?? 0.03,
      len: o.len ?? 0,
      axis: o.axis ?? null,
      decalSize: o.decalSize ?? 3,
      shrink: o.shrink ?? true,
      rate: o.rate ?? 0,
      acc: 0,
      grow: o.grow ?? 0,
    };
    this.list.push(p);
    return p;
  }
  update(dt) {
    // particles
    const ps = this.list;
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.kind === 'emitter') {
        p.acc += dt * p.rate;
        while (p.acc >= 1) {
          p.acc -= 1;
          _v.copy(p.vel)
            .multiplyScalar(rand(2, 5))
            .add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(1.2));
          this.spawn('drop', p.pos, _v, {
            size: rand(0.02, 0.05),
            life: rand(1, 2),
            ink: p.ink,
            collide: 'decal',
            gravity: 22,
            decalSize: 6,
          });
        }
        ps[n++] = p;
        continue;
      }
      if (p.vel) {
        _prev.copy(p.pos);
        p.vel.y -= p.gravity * dt;
        if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        if (p.collide) {
          _d.subVectors(p.pos, _prev);
          const len = _d.length();
          if (len > 1e-5) {
            _d.divideScalar(len);
            const hit = this.world.raycast(_prev, _d, len + p.size * 0.5, SEE_THROUGH);
            if (hit) {
              if (p.collide === 'decal')
                this.decals.splat(
                  hit.point,
                  hit.normal,
                  p.ink,
                  p.size * p.decalSize * 0.75,
                  _d,
                  p.size > 0.035 ? 2 : 1,
                );
              continue;
            }
          }
        }
        if (p.pos.y < -10) continue;
      }
      ps[n++] = p;
    }
    ps.length = n;
  }
  clear() {
    this.list.length = 0;
  }
}
