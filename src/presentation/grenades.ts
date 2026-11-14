import * as THREE from 'three';
import { makeInkMaterial } from './ink/materials.js';
import { INK } from '../shared/ink.js';
import type { RaycastPort, SceneResourcePort } from '../engine/ports.js';
interface Arc {
  dots: THREE.Mesh[];
  mark: THREE.Mesh;
  shown?: boolean;
}
const _ap = new THREE.Vector3(),
  _av = new THREE.Vector3(),
  _ad = new THREE.Vector3(),
  _aprev = new THREE.Vector3();
export class GrenadeVisuals {
  private arc: Arc | null = null;
  constructor(
    private readonly scene: THREE.Scene,
    private readonly world: RaycastPort,
    private readonly resources: SceneResourcePort,
  ) {}
  create(pos: THREE.Vector3) {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), makeInkMaterial({ ink: INK.BLACK })),
    );
    const pin = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.02, 4, 8),
      makeInkMaterial({ ink: INK.ORANGE }),
    );
    pin.position.y = 0.2;
    g.add(pin);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6),
      makeInkMaterial({ ink: INK.ORANGE }),
    );
    cap.position.y = 0.17;
    g.add(cap);
    g.position.copy(pos);
    this.scene.add(g);
    this.resources.track(g);
    return g;
  }
  remove(model: THREE.Object3D) {
    this.resources.release(model);
  }
  hideArc() {
    if (this.arc) this.showArc(-1, _ap, _av);
  }
  showArc(charge: number, position: THREE.Vector3, velocity: THREE.Vector3) {
    if (!this.arc) {
      const dots = [];
      const mat = makeInkMaterial({ ink: INK.BLACK, fill: true });
      for (let i = 0; i < 26; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat);
        m.visible = false;
        this.scene.add(m);
        this.resources.track(m);
        dots.push(m);
      }
      const mark = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.05, 5, 18),
        makeInkMaterial({ ink: INK.ORANGE }),
      );
      mark.rotation.x = Math.PI / 2;
      mark.visible = false;
      this.scene.add(mark);
      this.resources.track(mark);
      this.arc = { dots, mark };
    }
    const A = this.arc;
    if (charge < 0) {
      if (A.shown) {
        for (const d of A.dots) d.visible = false;
        A.mark.visible = false;
        A.shown = false;
      }
      return;
    }
    A.shown = true;
    const world = this.world;
    _ap.copy(position);
    _av.copy(velocity);
    let n = 0;
    const step = 1 / 30;
    for (let i = 0; i < 52 && n < A.dots.length; i++) {
      _av.y -= 22 * step;
      _aprev.copy(_ap);
      _ap.addScaledVector(_av, step);
      _ad.subVectors(_ap, _aprev);
      const len = _ad.length();
      if (len > 1e-6) {
        _ad.divideScalar(len);
        const hit = world.raycast(_aprev, _ad, len + 0.16);
        if (hit) {
          _ap.copy(hit.point).addScaledVector(hit.normal, 0.16);
          const vn = _av.dot(hit.normal);
          if (vn < 0) {
            _av.addScaledVector(hit.normal, -1.45 * vn);
            _av.multiplyScalar(0.55);
          }
          if (_av.length() < 1.2 && hit.normal.y > 0.5) break;
        }
      }
      if (i % 2 === 0 && i >= 6) {
        const d = A.dots[n++];
        d.position.copy(_ap);
        d.visible = true;
        const k = 0.8 + charge * 0.6;
        d.scale.setScalar(k);
      }
    }
    for (let i = n; i < A.dots.length; i++) A.dots[i].visible = false;
    A.mark.position.copy(_ap);
    A.mark.position.y += 0.02;
    A.mark.visible = true;
    A.mark.scale.setScalar(0.8 + charge * 0.5);
  }
}
