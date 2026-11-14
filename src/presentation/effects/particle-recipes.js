import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand } from '../../engine/math.js';
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _d = new THREE.Vector3();
export function sparks(particles, point, normal, ink = INK.BLUE, n = 6, speed = 7) {
  for (let i = 0; i < n; i++) {
    _v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
    if (_v.dot(normal) < 0) _v.negate();
    _v.addScaledVector(normal, 0.6)
      .normalize()
      .multiplyScalar(rand(speed * 0.4, speed));
    particles.spawn('stroke', point, _v, {
      size: rand(0.012, 0.025),
      life: rand(0.15, 0.35),
      ink,
      gravity: 14,
      stretch: 0.035,
      collide: null,
    });
  }
}
export function strokeBurst(particles, pos, ink, n = 16, speed = 6, opts = {}) {
  for (let i = 0; i < n; i++) {
    _v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
      .normalize()
      .multiplyScalar(rand(speed * 0.3, speed));
    particles.spawn('stroke', pos, _v, {
      size: opts.size ?? rand(0.02, 0.04),
      life: opts.life ?? rand(0.25, 0.5),
      ink,
      gravity: opts.gravity ?? 0,
      stretch: opts.stretch ?? 0.05,
      drag: opts.drag ?? 3,
      collide: null,
    });
  }
}
export function tracer(particles, from, to, ink = INK.BLUE, thick = 0.022, life = 0.06) {
  _d.subVectors(to, from);
  const len = _d.length();
  if (len < 0.05) return;
  _d.divideScalar(len);
  _v.copy(from).addScaledVector(_d, len / 2);
  particles.spawn('stroke', _v, null, {
    life,
    size: thick,
    ink,
    axis: _d.clone(),
    len,
    gravity: 0,
    shrink: false,
  });
}
export function blood(particles, pos, dir, amount = 1, opts = {}) {
  const ink = opts.ink ?? INK.RED;
  const n = Math.round(14 * amount);
  for (let i = 0; i < n; i++) {
    _v.copy(dir)
      .multiplyScalar(rand(1, 6))
      .add(_v2.set(rand(-1, 1), rand(-0.5, 1.2), rand(-1, 1)).multiplyScalar(rand(1, 4.5)));
    particles.spawn('drop', pos, _v, {
      size: rand(0.02, 0.065),
      life: rand(1.2, 2.6),
      ink,
      collide: 'decal',
      gravity: 22,
      decalSize: rand(4, 8),
    });
  }
  const m = Math.round(7 * amount);
  for (let i = 0; i < m; i++) {
    _v.copy(dir)
      .multiplyScalar(rand(6, 15))
      .add(_v2.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).multiplyScalar(rand(1, 4)));
    particles.spawn('stroke', pos, _v, {
      size: rand(0.02, 0.04),
      life: rand(0.3, 0.6),
      ink,
      collide: 'decal',
      gravity: 12,
      stretch: 0.05,
      decalSize: 5,
    });
  }
  const k = Math.round(6 * amount);
  for (let i = 0; i < k; i++) {
    _v.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1))
      .multiplyScalar(rand(0.5, 2.5))
      .addScaledVector(dir, rand(0, 2));
    particles.spawn('drop', pos, _v, {
      size: rand(0.012, 0.03),
      life: rand(0.3, 0.7),
      ink,
      collide: null,
      gravity: 6,
      drag: 2,
    });
  }
}
export function drip(particles, pos, amount = 1) {
  particles.spawn('drop', pos, _v.set(rand(-0.3, 0.3), rand(-0.4, 0.2), rand(-0.3, 0.3)), {
    size: rand(0.018, 0.03) + 0.02 * amount,
    life: rand(1, 1.8),
    ink: INK.RED,
    collide: 'decal',
    gravity: 20,
    decalSize: 5,
  });
}
export function fountain(particles, pos, dir, dur = 0.8, ink = INK.RED) {
  particles.spawn('emitter', pos, dir, { life: dur, ink, rate: 40, size: 0.05 });
}
export function shell(particles, pos, vel, ink = INK.ORANGE, size = 0.02) {
  particles.spawn('stroke', pos, vel, {
    size,
    life: rand(0.9, 1.4),
    ink,
    gravity: 22,
    stretch: 0.012,
    collide: null,
    shrink: false,
    len: 0,
    drag: 0.5,
  });
}
export function smoke(particles, pos, dir, n = 3) {
  for (let i = 0; i < n; i++) {
    _v.copy(dir)
      .multiplyScalar(rand(0.6, 1.8))
      .add(_v2.set(rand(-0.5, 0.5), rand(0.6, 1.4), rand(-0.5, 0.5)));
    particles.spawn('drop', pos, _v, {
      size: rand(0.04, 0.07),
      life: rand(0.45, 0.8),
      ink: INK.BLUE,
      fill: false,
      gravity: -1.2,
      drag: 3,
      collide: null,
      grow: 3.2,
      shrink: false,
    });
  }
}
