import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand, randInt, TAU } from '../../engine/math.js';
import { SEE_THROUGH } from '../../engine/physics.js';
import { InstancePool } from './instance-pool.js';
import { splatGeometry } from './splat-geometry.js';
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _s = new THREE.Vector3();
const _t1 = new THREE.Vector3(),
  _t2 = new THREE.Vector3(),
  _dt1 = new THREE.Vector3(),
  _dt2 = new THREE.Vector3(),
  _off = new THREE.Vector3(),
  _pc = new THREE.Vector3(),
  _ps = new THREE.Vector3(),
  _pd = new THREE.Vector3(),
  _mtx = new THREE.Matrix4();
const _z = new THREE.Vector3(0, 0, 1),
  _down = new THREE.Vector3(0, -1, 0);
export class Decals {
  constructor(scene, world, resources) {
    this.world = world;
    this.splats = [0, 1, 2, 3, 4].map(
      (i) => new InstancePool(scene, resources, splatGeometry(i), 300, true),
    );
    this.holes = new InstancePool(scene, resources, new THREE.CircleGeometry(0.5, 8), 260, true);
    this.growing = [];
  }
  decal(point, normal, ink = INK.RED, size = 0.3, kind = 'splat', dir = null, stretch = 1) {
    const pool = kind === 'hole' ? this.holes : this.splats[randInt(0, this.splats.length - 1)];
    const i = pool.allocate();
    _v.copy(point).addScaledVector(normal, rand(0.012, 0.03));
    // if the blood had a direction, lay the mark along it so it reads as a streak
    const along = dir && _dt1.copy(dir).addScaledVector(normal, -dir.dot(normal)).lengthSq() > 1e-5;
    if (along) {
      _dt1.normalize();
      _dt2.crossVectors(_dt1, normal).normalize();
      _mtx.makeBasis(_dt2, _dt1, normal);
      _q.setFromRotationMatrix(_mtx);
      _s.set(size * rand(0.6, 0.85), size * stretch * rand(0.9, 1.5), 1);
    } else {
      _q.setFromUnitVectors(_z, normal);
      _q2.setFromAxisAngle(normal, rand(0, TAU));
      _q.premultiply(_q2);
      _s.set(size, size * rand(0.7, 1.3), 1);
    }
    pool.write(i, _v, _q, _s, ink, true);
    pool.mesh.instanceMatrix.needsUpdate = true;
    pool.mesh.instanceColor.needsUpdate = true;
    return { pool, i };
  }
  _surfaceAt(point, normal, offset) {
    _pc.copy(point).add(offset);
    _ps.copy(_pc).addScaledVector(normal, 0.35);
    _pd.copy(normal).negate();
    let hit = this.world.raycast(_ps, _pd, 2.2, SEE_THROUGH);
    if (hit) return hit;
    const len = offset.length();
    if (len > 1e-4) {
      _ps.copy(_pc).addScaledVector(normal, 0.05);
      _pd.copy(offset).divideScalar(-len);
      hit = this.world.raycast(_ps, _pd, len + 0.3, SEE_THROUGH);
    }
    return hit;
  }
  splat(point, normal, ink = INK.RED, size = 0.5, dir = null, cluster = 3) {
    this.decal(point, normal, ink, size * rand(0.55, 0.8), 'splat', dir);
    _t1.set(normal.y, normal.z, normal.x).cross(normal);
    if (_t1.lengthSq() < 1e-6) _t1.set(1, 0, 0);
    _t1.normalize();
    _t2.crossVectors(normal, _t1);
    for (let i = 0; i < cluster; i++) {
      const a = rand(0, TAU),
        r = size * rand(0.3, 1.15);
      _off
        .copy(_t1)
        .multiplyScalar(Math.cos(a) * r)
        .addScaledVector(_t2, Math.sin(a) * r);
      if (dir) _off.addScaledVector(dir, size * rand(0, 0.7));
      const h = this._surfaceAt(point, normal, _off);
      if (h) this.decal(h.point, h.normal, ink, size * rand(0.2, 0.5), 'splat', dir);
    }
    // on a wall, let a little of it run downwards
    if (Math.abs(normal.y) < 0.55 && Math.random() < 0.75) {
      _off.set(0, -size * rand(0.5, 1.3), 0);
      const h = this._surfaceAt(point, normal, _off);
      if (h)
        this.decal(h.point, h.normal, ink, size * rand(0.16, 0.3), 'splat', _down, rand(2.5, 5));
    }
  }
  bloodPool(pos, size = 1.3, ink = INK.RED) {
    _v.copy(pos);
    _v.y += 0.5;
    const base = this.world.raycast(_v, _down, 5, SEE_THROUGH);
    if (!base) return;
    const n = 3;
    for (let k = 0; k < n; k++) {
      const a = rand(0, TAU),
        r = k === 0 ? 0 : size * rand(0.15, 0.5);
      _off.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const hit = k === 0 ? base : this._surfaceAt(base.point, base.normal, _off);
      if (!hit) continue;
      const pool = this.splats[randInt(0, this.splats.length - 1)];
      const i = pool.allocate();
      const quat = new THREE.Quaternion().setFromUnitVectors(_z, hit.normal);
      _q2.setFromAxisAngle(hit.normal, rand(0, TAU));
      quat.premultiply(_q2);
      const p = hit.point.clone().addScaledVector(hit.normal, rand(0.02, 0.04));
      this.growing.push({
        pool,
        i,
        pos: p,
        quat,
        size: size * (k === 0 ? rand(0.75, 1) : rand(0.3, 0.6)),
        t: 0,
        dur: rand(0.5, 1.1),
        ink,
      });
    }
  }
  update(dt) {
    // growing pools
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const g = this.growing[i];
      g.t += dt;
      const f = Math.min(1, g.t / g.dur);
      const e = 1 - (1 - f) * (1 - f);
      _s.set(g.size * e, g.size * e, 1);
      g.pool.write(g.i, g.pos, g.quat, _s, g.ink, true);
      g.pool.mesh.instanceMatrix.needsUpdate = true;
      g.pool.mesh.instanceColor.needsUpdate = true;
      if (f >= 1) this.growing.splice(i, 1);
    }
  }
  clear() {
    this.growing.length = 0;
    for (const pool of [...this.splats, this.holes]) pool.reset();
  }
  dispose() {
    this.clear();
    for (const pool of [...this.splats, this.holes]) pool.dispose();
  }
}
