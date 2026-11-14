import type { Object3D, Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
import type { RaycastPort } from '../../engine/ports.js';
export interface GrappleEnemy {
  alive: boolean;
  state: string;
  center: Vector3;
}
export interface GrappleMover {
  mesh: Object3D;
  radius: number;
}
export interface GrapplePose {
  eye: Vector3;
  center: Vector3;
  forward: Vector3;
  right: Vector3;
}
export interface GrappleTarget {
  point: Vector3;
  dist: number;
  enemy?: GrappleEnemy | null;
  mover?: GrappleMover;
}
export interface GrappleWorldPort extends RaycastPort {
  hasLineOfSight(from: Vector3, to: Vector3): boolean;
  overlapsBody(body: Body): boolean;
}
export interface GrappleQueries {
  raycastEnemy(
    origin: Vector3,
    direction: Vector3,
    distance: number,
  ): { point: Vector3; dist: number; enemy: GrappleEnemy } | null;
  enemies(): readonly GrappleEnemy[];
  landmarks(): { rings: readonly Vector3[]; grappleMovers?: readonly GrappleMover[] };
  yank(enemy: GrappleEnemy, toward: Vector3): void;
}
export interface GrappleVisualPort {
  draw(hand: Vector3, hook: Vector3): void;
  hide(): void;
}
export interface GrappleFeedback {
  target(mode: number): void;
  outOfBreath(): void;
  missed(): void;
  fired(): void;
  yanked(): void;
  attached(): void;
  stopped(): void;
  released(boost: boolean): void;
  exhausted(): void;
}
export interface GrappleState {
  state: 'idle' | 'fly' | 'on';
  anchor: Vector3;
  hook: Vector3;
  from: Vector3;
  flyT: number;
  flyDur: number;
  len: number;
  cd: number;
  enemy: GrappleEnemy | null;
  mover: GrappleMover | null;
  blockedT: number;
  t: number;
  swingT: number;
}
