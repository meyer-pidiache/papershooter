// Small math + helper utilities shared by every module.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const choose = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const approach = (cur: number, target: number, maxDelta: number) =>
  cur < target ? Math.min(cur + maxDelta, target) : Math.max(cur - maxDelta, target);
export const wrapAngle = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
export const angleLerp = (a: number, b: number, t: number) => a + wrapAngle(b - a) * t;
export const randDir = () => new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Damped spring for one scalar (used for camera kicks, weapon recoil, etc.)
export class Spring {
  value: number;
  vel: number;
  target: number;
  k: number;
  d: number;
  constructor(k = 120, d = 14) {
    this.value = 0;
    this.vel = 0;
    this.target = 0;
    this.k = k;
    this.d = d;
  }
  update(dt: number) {
    // sub-step for stability with stiff springs
    const steps = dt > 0.02 ? 3 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = (this.target - this.value) * this.k - this.vel * this.d;
      this.vel += f * h;
      this.value += this.vel * h;
    }
    return this.value;
  }
  kick(v: number) {
    this.vel += v;
  }
  set(v: number) {
    this.value = v;
    this.vel = 0;
  }
}

export class Spring3 {
  value: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;
  k: number;
  d: number;
  _f: THREE.Vector3;
  constructor(k = 120, d = 14) {
    this.value = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.k = k;
    this.d = d;
    this._f = new THREE.Vector3();
  }
  update(dt: number) {
    const steps = dt > 0.02 ? 3 : 1;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this._f
        .copy(this.target)
        .sub(this.value)
        .multiplyScalar(this.k)
        .addScaledVector(this.vel, -this.d);
      this.vel.addScaledVector(this._f, h);
      this.value.addScaledVector(this.vel, h);
    }
    return this.value;
  }
  kick(x: number, y: number, z: number) {
    this.vel.x += x;
    this.vel.y += y;
    this.vel.z += z;
  }
}

// Simple timer helper
export class Cooldown {
  t: number;
  dur: number;
  constructor(t = 0) {
    this.t = 0;
    this.dur = t;
  }
  update(dt: number) {
    if (this.t > 0) this.t -= dt;
  }
  ready() {
    return this.t <= 0;
  }
  start(d = this.dur) {
    this.t = d;
  }
  get frac() {
    return this.dur > 0 ? clamp(this.t / this.dur, 0, 1) : 0;
  }
}

// Quaternion helper: rotation that maps +Y to dir
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
export function quatFromYTo(dir: THREE.Vector3, out = new THREE.Quaternion()) {
  return out.setFromUnitVectors(_up, dir);
}
export function alignYAxis(
  obj: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  thickness = 1,
) {
  const d = new THREE.Vector3().subVectors(to, from);
  const len = d.length();
  if (len < 1e-5) {
    obj.visible = false;
    return;
  }
  obj.visible = true;
  d.divideScalar(len);
  obj.position.copy(from).addScaledVector(d, len * 0.5);
  obj.quaternion.setFromUnitVectors(_up, d);
  obj.scale.set(thickness, len, thickness);
}
