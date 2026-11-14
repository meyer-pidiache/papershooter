import * as THREE from 'three';
import { makeInkMaterial } from '../ink/materials.js';
import { INK } from '../../shared/ink.js';
const _m = new THREE.Matrix4();
export class InstancePool {
  constructor(scene, resources, geo, max, double = false) {
    const mat = makeInkMaterial({
      ink: INK.RED,
      fill: true,
      side: double ? THREE.DoubleSide : THREE.FrontSide,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    resources.track(mesh);
    this.mesh = mesh;
    this.max = max;
    this.next = 0;
    this.used = 0;
    this.resources = resources;
  }
  write(i, pos, quat, scale, ink, fill) {
    _m.compose(pos, quat, scale);
    this.mesh.setMatrixAt(i, _m);
    const c = this.mesh.instanceColor.array;
    c[i * 3] = ink;
    c[i * 3 + 1] = fill ? 1 : 0;
    c[i * 3 + 2] = 0;
  }
  allocate() {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.used = Math.min(this.used + 1, this.max);
    this.mesh.count = this.used;
    return i;
  }
  reset() {
    this.next = 0;
    this.used = 0;
    this.mesh.count = 0;
  }
  dispose() {
    this.resources.release(this.mesh);
  }
}
