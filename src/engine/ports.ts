import type { Object3D, Vector3, Vector3Like } from 'three';
import type { Collider } from './physics.js';

export interface RaycastHit {
  point: Vector3;
  normal: Vector3;
  dist: number;
  box: Collider;
}
export interface RaycastPort {
  raycast(
    origin: Vector3Like,
    direction: Vector3Like,
    distance?: number,
    ignore?: ((box: Collider) => boolean) | null,
  ): RaycastHit | null;
}
export interface SceneResourcePort {
  track(root: Object3D): void;
  release(root: Object3D): void;
}
