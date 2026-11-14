import * as THREE from 'three';
import { TAU } from '../../engine/math.js';
import { makeInkMaterial } from '../ink/materials.js';
import { INK } from '../../shared/ink.js';
import type { Triple } from './weapon-contracts.js';
export function box(
  size: Triple,
  position: Triple,
  material: THREE.Material,
  parent: THREE.Object3D,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
export function cylinder(
  size: [number, number],
  position: Triple,
  material: THREE.Material,
  parent: THREE.Object3D,
  { axis = 'z', segments = 8 }: { axis?: 'x' | 'y' | 'z'; segments?: number } = {},
) {
  const [radius, height] = size,
    geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
  if (axis === 'z') geometry.rotateX(Math.PI / 2);
  else if (axis === 'x') geometry.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
export function sphere(
  radius: number,
  position: Triple,
  material: THREE.Material,
  parent: THREE.Object3D,
  segments = 8,
) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments), material);
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}
function star(n = 7, r1 = 0.16, r2 = 0.06) {
  const shape = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const angle = (i / (n * 2)) * TAU,
      radius = i % 2 === 0 ? r1 : r2;
    if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}
export function frame(
  size: [number, number, number, number],
  position: Triple,
  material: THREE.Material,
  parent: THREE.Object3D,
) {
  const [width, height, thickness, depth] = size,
    group = new THREE.Group();
  group.position.set(...position);
  parent.add(group);
  box([width, thickness, depth], [0, height / 2, 0], material, group);
  box([width, thickness, depth], [0, -height / 2, 0], material, group);
  box([thickness, height, depth], [-width / 2, 0, 0], material, group);
  box([thickness, height, depth], [width / 2, 0, 0], material, group);
  return group;
}
export function hand(
  material: THREE.Material,
  position: Triple,
  parent: THREE.Object3D,
  { direction = [0.4, -0.5, 1], length = 0.42 }: { direction?: Triple; length?: number } = {},
) {
  const [x, y, z] = position;
  sphere(0.062, position, material, parent);
  const d = new THREE.Vector3(...direction).normalize(),
    arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, length, 7), material);
  arm.position.set(x + (d.x * length) / 2, y + (d.y * length) / 2, z + (d.z * length) / 2);
  arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  parent.add(arm);
  return arm;
}
export function flash(parent: THREE.Object3D, position: Triple, scale: number) {
  const material = makeInkMaterial({ ink: INK.ORANGE, fill: true, side: THREE.DoubleSide }),
    group = new THREE.Group();
  group.add(new THREE.Mesh(star(7, 0.16, 0.06), material));
  const second = new THREE.Mesh(star(5, 0.11, 0.04), material);
  second.rotation.y = Math.PI / 2;
  group.add(second);
  const third = new THREE.Mesh(star(5, 0.1, 0.04), material);
  third.rotation.x = Math.PI / 2;
  group.add(third);
  group.position.set(...position);
  group.scale.setScalar(scale);
  group.visible = false;
  parent.add(group);
  return group;
}
