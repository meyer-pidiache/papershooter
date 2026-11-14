import type { Group, Mesh, Object3D, ShaderMaterial, Vector3 } from 'three';
export type Triple = [number, number, number];
export interface GunMaterials {
  mat: ShaderMaterial;
  dark: ShaderMaterial;
  red: ShaderMaterial;
}
export interface GunModel {
  muzzle: Object3D;
  ejectPt: Object3D;
  flash: Group;
  magMesh?: Mesh;
  magY?: number;
  handL?: Mesh;
  handLPos?: Vector3;
  foreEnd?: Mesh;
  foreEndZ?: number;
  boltH?: Mesh;
  boltZ?: number;
  cylGroup?: Group;
}
export interface BladeSmear {
  mesh: Mesh;
  at: number;
  base: number;
  side: number;
}
export interface KatanaModel {
  blade: Mesh;
  tip: Object3D;
  smears: BladeSmear[];
}
export function completeGunModel(model: Partial<GunModel>): GunModel {
  const { muzzle, ejectPt, flash } = model;
  if (!muzzle || !ejectPt || !flash)
    throw new Error('Weapon model requires muzzle, eject point and flash attachments');
  return { ...model, muzzle, ejectPt, flash };
}
