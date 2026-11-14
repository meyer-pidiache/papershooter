import type { Vector3, Vector3Like } from 'three';
import type { Body } from '../../engine/physics.js';
import type { RaycastPort } from '../../engine/ports.js';
export interface MovementInput {
  readonly move: { x: number; y: number };
  readonly usingGamepad: boolean;
  down(action: string): boolean;
  pressed(action: string): boolean;
}
export interface MovementWorld extends RaycastPort {
  overlapsBody(body: Body): boolean;
  overlapsAABB(min: Vector3Like, max: Vector3Like): boolean;
  moveBody(body: Body, dt: number): void;
}
export interface MovementEnvironment {
  world: MovementWorld;
  spawnPoint(): Vector3;
}
export interface MovementGrapple {
  readonly mode: 'idle' | 'fly' | 'on';
  detach(boost: boolean): void;
  update(dt: number, pressed: boolean, held: boolean, forward: number): void;
}
export interface MovementPose {
  center: Vector3;
  right: Vector3;
}
export interface JumpMotion {
  wish: Vector3;
  wishLen: number;
  forward: Vector3;
  right: Vector3;
  sliding: boolean;
}
export interface MotionFrame extends JumpMotion {
  mv: { x: number; y: number };
  aiming: boolean;
  hspeed: number;
  sprinting: boolean;
  maxSpeed: number;
  grounded: boolean;
  landGraceT: number;
}
export interface MovementFeedback {
  jump(): void;
  lunge(): void;
  wallJump(roll: number): void;
  airJump(): void;
  slide(): void;
  dash(direction: Vector3): void;
  mantle(): void;
  land(impact: number): void;
  fell(): void;
}
