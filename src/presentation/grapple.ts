import * as THREE from 'three';
import { makeInkMaterial } from './ink/materials.js';
import { INK } from '../shared/ink.js';
import { alignYAxis } from '../engine/math.js';
export class GrappleVisuals {
  private readonly rope: THREE.Mesh;
  private readonly hookMesh: THREE.Group;
  constructor(scene: THREE.Scene) {
    const rm = makeInkMaterial({ ink: INK.BLUE, fill: false, shadeBias: -0.3 });
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 6), rm);
    this.rope.visible = false;
    scene.add(this.rope);
    const hm = makeInkMaterial({ ink: INK.BLUE });
    this.hookMesh = new THREE.Group();
    this.hookMesh.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10), hm));
    const hb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), hm);
    hb.position.y = -0.2;
    this.hookMesh.add(hb);
    this.hookMesh.visible = false;
    scene.add(this.hookMesh);
  }
  hide() {
    this.rope.visible = false;
    this.hookMesh.visible = false;
  }
  draw(hand: THREE.Vector3, hook: THREE.Vector3) {
    alignYAxis(this.rope, hand, hook, 0.008);
    this.rope.visible = true;
    this.hookMesh.visible = true;
    this.hookMesh.position.copy(hook);
    this.hookMesh.quaternion.copy(this.rope.quaternion);
  }
}
