import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand } from '../../engine/math.js';
const _v = new THREE.Vector3();
export function boom(particles, decals, pos, radius = 5) {
  const k = radius / 5;
  // a fat orange fireball: a few huge fills that balloon fast, then a cloud of smaller blobs
  for (let i = 0; i < 4; i++) {
    _v.set(rand(-1, 1), rand(0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.3, 1.6));
    particles.spawn('drop', pos, _v, {
      size: rand(2.2, 3.2) * k,
      life: rand(0.3, 0.45),
      ink: INK.ORANGE,
      fill: true,
      gravity: -2,
      drag: 3,
      collide: null,
      grow: 3.2,
      shrink: false,
    });
  }
  for (let i = 0; i < 26; i++) {
    _v.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, 8));
    particles.spawn('drop', pos, _v, {
      size: rand(0.9, 1.9) * k,
      life: rand(0.35, 0.6),
      ink: i % 5 === 0 ? INK.BLACK : INK.ORANGE,
      fill: true,
      gravity: -3,
      drag: 4,
      collide: null,
      grow: 2.8,
      shrink: false,
    });
  }
  // thick ink strokes flung outward, a few black ones for weight
  for (let i = 0; i < 64; i++) {
    _v.set(rand(-1, 1), rand(-0.15, 0.9), rand(-1, 1))
      .normalize()
      .multiplyScalar(rand(14, 34) * k);
    particles.spawn('stroke', pos, _v, {
      size: rand(0.09, 0.2) * k,
      life: rand(0.3, 0.55),
      ink: i % 4 === 0 ? INK.BLACK : INK.ORANGE,
      gravity: 8,
      stretch: 0.09,
      drag: 2,
      collide: null,
    });
  }
  // black soot that splatters onto whatever it lands on
  for (let i = 0; i < 30; i++) {
    _v.set(rand(-1, 1), rand(0.2, 1), rand(-1, 1))
      .normalize()
      .multiplyScalar(rand(3, 10) * k);
    particles.spawn('drop', pos, _v, {
      size: rand(0.06, 0.14),
      life: rand(0.8, 1.6),
      ink: INK.BLACK,
      collide: 'decal',
      gravity: 16,
      decalSize: rand(3, 7) * k,
    });
  }
  // a rising column of outlined smoke rings
  for (let i = 0; i < 18; i++) {
    _v.set(rand(-1, 1), rand(0.8, 2.0), rand(-1, 1)).multiplyScalar(rand(1.2, 3.4));
    particles.spawn('drop', pos, _v, {
      size: rand(0.35, 0.7) * k,
      life: rand(1.0, 1.8),
      ink: INK.BLACK,
      fill: false,
      gravity: -2,
      drag: 2.2,
      collide: null,
      grow: 3.6,
      shrink: false,
    });
  }
  decals.bloodPool(pos, radius * 0.8, INK.BLACK);
  return 0.8;
}
export function explosion(particles, decals, pos, radius = 4, ink = INK.BLACK) {
  for (let i = 0; i < 40; i++) {
    _v.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 14));
    particles.spawn('drop', pos, _v, {
      size: rand(0.03, 0.1),
      life: rand(1, 2),
      ink,
      collide: 'decal',
      gravity: 20,
      decalSize: rand(3, 6),
    });
  }
  for (let i = 0; i < 26; i++) {
    _v.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(10, 22));
    particles.spawn('stroke', pos, _v, {
      size: rand(0.03, 0.06),
      life: rand(0.2, 0.45),
      ink: i % 3 === 0 ? INK.ORANGE : ink,
      gravity: 6,
      stretch: 0.05,
      collide: null,
    });
  }
  for (let i = 0; i < 8; i++) {
    _v.set(rand(-1, 1), rand(0.5, 1.5), rand(-1, 1)).multiplyScalar(rand(1, 3));
    particles.spawn('drop', pos, _v, {
      size: rand(0.12, 0.25),
      life: rand(0.7, 1.2),
      ink: INK.BLUE,
      fill: false,
      gravity: -1.5,
      drag: 2.5,
      collide: null,
      grow: 3,
      shrink: false,
    });
  }
  decals.bloodPool(pos, radius * 0.9, ink);
  return 0.5;
}
