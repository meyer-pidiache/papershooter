import { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
import type { JumpMotion, MovementGrapple } from './movement-contracts.js';
export type JumpAction = 'none' | 'ground' | 'wall-left' | 'wall-right' | 'air';

// Owns jump buffering, grace after leaving ground, wall contact and the extra air jump.
export class Jumps {
  coyote = 0;
  airJumps = 1;
  private buffer = 0;
  private wallTouch = 9;
  private wallCooldown = 0;
  private readonly wallNormal = new Vector3();
  constructor(
    private readonly body: Body,
    private readonly grapple: MovementGrapple,
  ) {}
  grounded() {
    this.coyote = 0.13;
    this.airJumps = 1;
  }
  airborne(dt: number) {
    this.coyote -= dt;
  }
  focusLocked() {
    this.coyote = 0.13;
  }
  reset() {
    this.airJumps = 1;
  }
  update(dt: number, pressed: boolean, motion: JumpMotion): JumpAction {
    const b = this.body;
    if (pressed) this.buffer = 0.15;
    else this.buffer -= dt;
    this.wallCooldown -= dt;
    if (b.hitWall && !b.onGround) {
      this.wallTouch = 0;
      this.wallNormal.copy(b.wallNormal);
    } else this.wallTouch += dt;
    if (this.buffer <= 0) return 'none';
    if (this.grapple.mode === 'on') {
      this.buffer = 0;
      this.grapple.detach(true);
      return 'none';
    }
    if (b.onGround || this.coyote > 0) {
      this.buffer = 0;
      this.coyote = 0;
      b.vel.y = 9.6;
      b.onGround = false;
      this.airJumps = 1;
      if (motion.sliding) {
        b.vel.x *= 1.06;
        b.vel.z *= 1.06;
      }
      return 'ground';
    }
    if (this.wallTouch < 0.12 && this.wallCooldown <= 0 && b.vel.y < 7) {
      this.buffer = 0;
      this.wallCooldown = 0.35;
      b.vel.x = this.wallNormal.x * 7.5 + b.vel.x * 0.35 + motion.forward.x * 2.5;
      b.vel.z = this.wallNormal.z * 7.5 + b.vel.z * 0.35 + motion.forward.z * 2.5;
      b.vel.y = 9.2;
      this.airJumps = 1;
      return this.wallNormal.dot(motion.right) > 0 ? 'wall-left' : 'wall-right';
    }
    if (this.airJumps > 0) {
      this.buffer = 0;
      this.airJumps--;
      b.vel.y = 9.6 * 0.92;
      if (motion.wishLen > 0) {
        const current = b.vel.x * motion.wish.x + b.vel.z * motion.wish.z;
        const add = Math.max(0, 7.5 * motion.wishLen - current);
        b.vel.x += motion.wish.x * add;
        b.vel.z += motion.wish.z * add;
      }
      return 'air';
    }
    return 'none';
  }
}
