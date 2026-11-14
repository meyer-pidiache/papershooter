import * as THREE from 'three';
import { makeInkMaterial } from '../ink/materials.js';
import { INK } from '../../shared/ink.js';
import { box, hand } from './weapon-kit.js';
import type { KatanaModel } from './weapon-contracts.js';
export function buildKatana(root: THREE.Group): KatanaModel {
  const model: Partial<KatanaModel> = {};

  const mat = makeInkMaterial({ ink: INK.BLUE }),
    dark = makeInkMaterial({ ink: INK.BLACK });
  const g = root;
  model.blade = box([0.012, 0.035, 1.0], [0, 0, -0.55], mat, g);
  box([0.012, 0.02, 0.08], [0, 0.007, -1.07], mat, g).rotation.x = 0.3;
  box([0.1, 0.1, 0.02], [0, 0, -0.05], dark, g);
  box([0.03, 0.036, 0.3], [0, 0, 0.12], dark, g);
  for (let i = 0; i < 6; i++) box([0.036, 0.04, 0.02], [0, 0, 0.02 + i * 0.045], mat, g);
  hand(mat, [0.0, -0.005, 0.05], g, { direction: [0.5, -0.5, 1] });
  hand(mat, [0.0, -0.005, 0.2], g, { direction: [-0.4, -0.7, 1] });
  model.tip = new THREE.Object3D();
  model.tip.position.set(0, 0, -1.05);
  g.add(model.tip);
  // Blood clings to the flat of the blade. Each streak is a ragged sliver built in the plane of
  // the steel and inset inside its silhouette, so nothing ever hangs off an edge.
  const blood = makeInkMaterial({ ink: INK.RED, fill: true, side: THREE.DoubleSide });
  const BH = 0.0168,
    BX = 0.0067; // blade half height, and the face to sit on
  model.smears = [];
  const spec = [
    [-0.34, 0.3, 0.0, 1],
    [-0.7, 0.26, 0.18, -1],
    [-0.95, 0.17, 0.4, 1],
    [-0.52, 0.22, 0.58, -1],
    [-0.2, 0.2, 0.74, 1],
    [-0.84, 0.2, 0.88, -1],
  ];
  for (let i = 0; i < spec.length; i++) {
    const [zc, len, at, side] = spec[i];
    const sh = new THREE.Shape();
    const n = 12;
    // top edge of the streak: ragged, always inside the blade
    sh.moveTo(-len / 2, -BH * 0.92);
    for (let k = 0; k <= n; k++) {
      const t = k / n,
        x = -len / 2 + len * t;
      const taper = Math.sin(Math.PI * Math.min(1, t * 1.15));
      sh.lineTo(
        x,
        -BH * 0.92 +
          BH * 1.84 * (0.3 + 0.7 * taper * (0.55 + 0.45 * Math.abs(Math.sin(t * 7 + i * 2.1)))),
      );
    }
    sh.lineTo(len / 2, -BH * 0.92);
    sh.closePath();
    const geo = new THREE.ShapeGeometry(sh, 2);
    geo.rotateY(Math.PI / 2); // lay it into the plane of the blade
    const m = new THREE.Mesh(geo, blood);
    m.position.set(side * BX, 0, zc);
    m.visible = false;
    g.add(m);
    model.smears.push({ mesh: m, at, base: len, side });
  }

  const { blade, tip, smears } = model;
  if (!blade || !tip || !smears) throw new Error('Incomplete blade model');
  return { blade, tip, smears };
}
