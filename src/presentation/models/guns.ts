import * as THREE from 'three';
import { TAU } from '../../engine/math.js';
import { box, cylinder, sphere, frame, hand, flash } from './weapon-kit.js';
import { completeGunModel, type GunMaterials, type GunModel } from './weapon-contracts.js';
export function buildRifle(root: THREE.Group, materials: GunMaterials): GunModel {
  const model: Partial<GunModel> = {};

  const g = root,
    mat = materials.mat,
    dark = materials.dark;
  box([0.09, 0.12, 0.5], [0, 0, 0], mat, g);
  box([0.075, 0.085, 0.36], [0, 0, -0.42], mat, g);
  cylinder([0.018, 0.42], [0, 0.02, -0.75], dark, g);
  model.magMesh = box([0.06, 0.2, 0.1], [0, -0.16, -0.06], mat, g);
  model.magMesh.rotation.x = 0.15;
  model.magY = -0.16;
  box([0.07, 0.11, 0.3], [0, -0.01, 0.4], mat, g);
  const grip = box([0.05, 0.14, 0.06], [0, -0.13, 0.12], mat, g);
  grip.rotation.x = 0.3;
  // the sight: a single small floating dot, nothing else in the picture
  frame([0.075, 0.07, 0.012, 0.03], [0, 0.12, -0.05], mat, g);
  box([0.03, 0.018, 0.05], [0, 0.062, -0.05], dark, g);
  sphere(0.0012, [0, 0.12, -0.05], materials.red, g, 5);
  hand(mat, [0.02, -0.15, 0.13], g, { direction: [0.5, -0.6, 1] });
  model.handL = hand(mat, [-0.05, -0.08, -0.4], g, { direction: [-0.35, -0.9, 0.9] });
  model.handLPos = model.handL.position.clone();
  model.muzzle = new THREE.Object3D();
  model.muzzle.position.set(0, 0.02, -0.98);
  g.add(model.muzzle);
  model.ejectPt = new THREE.Object3D();
  model.ejectPt.position.set(0.06, 0.02, 0.02);
  g.add(model.ejectPt);
  model.flash = flash(g, [0, 0.02, -0.98], 1);

  return completeGunModel(model);
}
export function buildShotgun(root: THREE.Group, materials: GunMaterials): GunModel {
  const model: Partial<GunModel> = {};

  const g = root,
    mat = materials.mat,
    dark = materials.dark;
  box([0.09, 0.13, 0.42], [0, 0, 0.05], mat, g);
  cylinder([0.021, 0.92], [0, 0.05, -0.62], dark, g);
  cylinder([0.019, 0.72], [0, -0.02, -0.5], mat, g);
  model.foreEnd = box([0.078, 0.085, 0.27], [0, 0.01, -0.46], mat, g);
  model.foreEndZ = -0.46;
  const stock = box([0.07, 0.12, 0.34], [0, -0.04, 0.42], mat, g);
  stock.rotation.x = 0.08;
  const grip = box([0.05, 0.13, 0.06], [0, -0.13, 0.16], mat, g);
  grip.rotation.x = 0.35;
  sphere(0.013, [0, 0.095, -1.0], materials.red, g, 6);
  box([0.03, 0.025, 0.02], [0, 0.085, -0.02], dark, g);
  hand(mat, [0.02, -0.16, 0.17], g, { direction: [0.5, -0.6, 1] });
  model.handL = hand(mat, [-0.04, -0.06, -0.45], g, { direction: [-0.35, -0.9, 0.9] });
  model.handLPos = model.handL.position.clone();
  model.handL.userData.foreEnd = true;
  model.muzzle = new THREE.Object3D();
  model.muzzle.position.set(0, 0.05, -1.09);
  g.add(model.muzzle);
  model.ejectPt = new THREE.Object3D();
  model.ejectPt.position.set(0.06, 0.03, 0.05);
  g.add(model.ejectPt);
  model.flash = flash(g, [0, 0.05, -1.09], 1);

  return completeGunModel(model);
}
export function buildSniper(root: THREE.Group, materials: GunMaterials): GunModel {
  const model: Partial<GunModel> = {};

  const g = root,
    mat = materials.mat,
    dark = materials.dark;
  box([0.085, 0.115, 0.6], [0, 0, 0.05], mat, g);
  cylinder([0.024, 1.25], [0, 0.02, -0.92], dark, g);
  cylinder([0.032, 0.16], [0, 0.02, -1.5], dark, g);
  model.magMesh = box([0.055, 0.16, 0.14], [0, -0.14, -0.06], mat, g);
  model.magY = -0.14;
  const stock = box([0.075, 0.13, 0.44], [0, -0.02, 0.5], mat, g);
  stock.rotation.x = 0.04;
  box([0.05, 0.14, 0.07], [0, -0.13, 0.2], mat, g).rotation.x = 0.3;
  box([0.06, 0.05, 0.16], [0, 0.07, 0.42], mat, g);
  // scope: tube, rings, and a red cross the ADS view lines up with
  cylinder([0.052, 0.56], [0, 0.135, -0.1], mat, g);
  cylinder([0.066, 0.07], [0, 0.135, -0.36], mat, g);
  cylinder([0.062, 0.07], [0, 0.135, 0.14], mat, g);
  for (const z of [-0.24, 0.02]) {
    box([0.03, 0.09, 0.035], [0, 0.085, z], dark, g);
  }
  const cross = new THREE.Group();
  cross.position.set(0, 0.135, -0.38);
  g.add(cross);
  box([0.09, 0.006, 0.004], [0, 0, 0], materials.red, cross);
  box([0.006, 0.09, 0.004], [0, 0, 0], materials.red, cross);
  // bolt handle on the right, worked after every shot
  model.boltH = box([0.026, 0.026, 0.16], [0.07, 0.05, 0.16], dark, g);
  model.boltZ = 0.16;
  sphere(0.032, [0.07, 0.05, 0.24], dark, g, 6);
  // bipod
  const bl = box([0.02, 0.26, 0.02], [-0.07, -0.13, -0.78], dark, g);
  bl.rotation.z = 0.35;
  const br = box([0.02, 0.26, 0.02], [0.07, -0.13, -0.78], dark, g);
  br.rotation.z = -0.35;
  hand(mat, [0.02, -0.16, 0.24], g, { direction: [0.5, -0.6, 1] });
  model.handL = hand(mat, [-0.05, -0.09, -0.5], g, { direction: [-0.35, -0.9, 0.9] });
  model.handLPos = model.handL.position.clone();
  model.muzzle = new THREE.Object3D();
  model.muzzle.position.set(0, 0.02, -1.6);
  g.add(model.muzzle);
  model.ejectPt = new THREE.Object3D();
  model.ejectPt.position.set(0.06, 0.04, 0.06);
  g.add(model.ejectPt);
  model.flash = flash(g, [0, 0.02, -1.6], 1);

  return completeGunModel(model);
}
export function buildRevolver(root: THREE.Group, materials: GunMaterials): GunModel {
  const model: Partial<GunModel> = {};

  const g = root,
    mat = materials.mat,
    dark = materials.dark;
  box([0.045, 0.09, 0.2], [0, 0, 0], mat, g);
  cylinder([0.02, 0.3], [0, 0.035, -0.24], dark, g);
  box([0.03, 0.03, 0.26], [0, 0.005, -0.22], mat, g);
  model.cylGroup = new THREE.Group();
  model.cylGroup.position.set(0, 0.0, -0.02);
  g.add(model.cylGroup);
  cylinder([0.05, 0.11], [0, 0, 0], mat, model.cylGroup, { axis: 'z', segments: 6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    cylinder([0.012, 0.115], [Math.cos(a) * 0.032, Math.sin(a) * 0.032, 0], dark, model.cylGroup, {
      axis: 'z',
      segments: 5,
    });
  }
  const grip = box([0.045, 0.14, 0.055], [0, -0.1, 0.07], dark, g);
  grip.rotation.x = 0.4;
  box([0.02, 0.045, 0.035], [0, 0.05, 0.1], mat, g).rotation.x = -0.4;
  box([0.01, 0.03, 0.02], [0, 0.075, -0.34], materials.red, g);
  box([0.012, 0.025, 0.015], [-0.014, 0.06, 0.08], mat, g);
  box([0.012, 0.025, 0.015], [0.014, 0.06, 0.08], mat, g);
  hand(mat, [0.0, -0.13, 0.08], g, { direction: [0.45, -0.55, 1] });
  model.handL = hand(mat, [-0.05, -0.17, 0.02], g, { direction: [-0.4, -0.7, 1] });
  model.handLPos = model.handL.position.clone();
  model.muzzle = new THREE.Object3D();
  model.muzzle.position.set(0, 0.035, -0.4);
  g.add(model.muzzle);
  model.ejectPt = new THREE.Object3D();
  model.ejectPt.position.set(-0.05, 0.02, 0);
  g.add(model.ejectPt);
  model.flash = flash(g, [0, 0.035, -0.4], 1);

  return completeGunModel(model);
}
