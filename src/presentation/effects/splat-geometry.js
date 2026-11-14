import * as THREE from 'three';
import { TAU } from '../../engine/math.js';
export function splatGeometry(seed) {
  const pts = [];
  const n = 20;
  const r0 = 0.42 + (0.1 * ((seed * 7) % 3)) / 3;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    // a few long fingers of ink rather than an even blob
    const finger = Math.pow(Math.abs(Math.sin(a * (1.5 + seed * 0.5) + seed * 2.1)), 3) * 0.55;
    const wob = 0.82 + 0.36 * (((i * 13 + seed * 5) % 7) / 7);
    pts.push(
      new THREE.Vector2(
        Math.cos(a) * r0 * (1 + finger) * wob,
        Math.sin(a) * r0 * (1 + finger * 0.7) * wob,
      ),
    );
  }
  const shapes = [new THREE.Shape(pts)];
  const sat = 3 + (seed % 3);
  for (let k = 0; k < sat; k++) {
    const a = seed * 2.3 + k * (TAU / sat) + 0.4,
      d = 0.6 + 0.22 * (((k * 3 + seed) % 4) / 4);
    shapes.push(
      new THREE.Shape().absarc(
        Math.cos(a) * d,
        Math.sin(a) * d,
        0.045 + (0.05 * ((k + seed) % 3)) / 3,
        0,
        TAU,
        false,
      ),
    );
  }
  return new THREE.ShapeGeometry(shapes, 5);
}
