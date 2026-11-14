import { Vector3 } from 'three';
import { clamp } from '../../engine/math.js';
import type { Body } from '../../engine/physics.js';
import { acceleratePlanar } from '../../domain/locomotion.js';
import { Jumps } from './jumps.js';
import type {
  MotionFrame,
  MovementEnvironment,
  MovementFeedback,
  MovementGrapple,
  MovementInput,
  MovementPose,
} from './movement-contracts.js';

const down = new Vector3(0, -1, 0);
export class Locomotion {
  crouching = false;
  sliding = false;
  private slideTime = 0;
  private mantleCooldown = 0;
  private dashCooldown = 0;
  private landGrace = 0;
  private sprintToggle = false;
  private lastGround = true;
  private airTime = 0;
  sprinting = false;
  aiming = false;
  gravityScale = 1;
  dashLock = false;
  readonly jumps: Jumps;
  readonly frame: MotionFrame = {
    mv: { x: 0, y: 0 },
    wish: new Vector3(),
    wishLen: 0,
    forward: new Vector3(),
    right: new Vector3(),
    sliding: false,
    aiming: false,
    hspeed: 0,
    sprinting: false,
    maxSpeed: 6.6,
    grounded: false,
    landGraceT: 0,
  };
  private readonly probe = new Vector3();
  constructor(
    private readonly body: Body,
    private readonly pose: MovementPose,
    private readonly environment: MovementEnvironment,
    private readonly grapple: MovementGrapple,
    private readonly feedback: MovementFeedback,
  ) {
    this.jumps = new Jumps(body, grapple);
  }
  reset() {
    this.crouching = false;
    this.sliding = false;
    this.dashCooldown = 0;
    this.jumps.reset();
    this.gravityScale = 1;
    this.dashLock = false;
  }
  freezeIfLocked() {
    if (!this.dashLock) return false;
    this.body.vel.set(0, 0, 0);
    this.body.onGround = false;
    this.jumps.focusLocked();
    return true;
  }
  read(dt: number, input: MovementInput, yaw: number, gun: boolean) {
    const b = this.body,
      m = this.frame,
      mv = input.move;
    m.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    m.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    const wish = m.wish
      .set(0, 0, 0)
      .addScaledVector(m.forward, mv.y)
      .addScaledVector(m.right, mv.x);
    let length = wish.length();
    if (length > 1e-4) wish.divideScalar(length);
    length = Math.min(1, length);
    if (input.usingGamepad) {
      if (input.pressed('sprint')) this.sprintToggle = !this.sprintToggle;
      if (mv.y < 0.1) this.sprintToggle = false;
    } else this.sprintToggle = input.down('sprint');
    const aiming = (this.aiming = input.down('aim') && gun),
      speed = Math.hypot(b.vel.x, b.vel.z),
      crouch = input.down('crouch');
    if (input.pressed('crouch') && b.onGround && speed > 6.3 && !this.sliding)
      this.startSlide(speed);
    if (this.sliding) {
      this.slideTime += dt;
      if (!crouch || speed < 3.5 || this.airTime > 0.35) this.sliding = false;
    }
    let wantCrouch = (crouch && b.onGround) || this.sliding;
    if (!wantCrouch && this.crouching) {
      b.height = 1.75;
      if (this.environment.world.overlapsBody(b)) wantCrouch = true;
    }
    this.crouching = wantCrouch;
    b.height = this.crouching ? 1.05 : 1.75;
    const sprinting = (this.sprinting =
      this.sprintToggle && mv.y > 0.1 && !this.crouching && !aiming);
    this.landGrace -= dt;
    this.dashCooldown -= dt;
    m.mv = mv;
    m.wishLen = length;
    m.aiming = aiming;
    m.hspeed = speed;
    m.sprinting = sprinting;
    m.maxSpeed = this.crouching && !this.sliding ? 3.6 : sprinting ? 10.6 : 6.6;
    m.sliding = this.sliding;
    m.grounded = b.onGround;
    m.landGraceT = this.landGrace;
    return m;
  }
  accelerate(dt: number, motion: MotionFrame) {
    if (this.body.onGround) {
      this.jumps.grounded();
      this.airTime = 0;
    } else {
      this.jumps.airborne(dt);
      this.airTime += dt;
    }
    acceleratePlanar(this.body.vel, motion, dt);
  }
  jump(dt: number, input: MovementInput, motion: MotionFrame) {
    this.mantleCooldown -= dt;
    const action = this.jumps.update(dt, input.pressed('jump'), motion);
    if (action === 'ground') {
      this.sliding = false;
      this.feedback.jump();
    } else if (action === 'wall-left' || action === 'wall-right')
      this.feedback.wallJump(action === 'wall-left' ? -0.1 : 0.1);
    else if (action === 'air') this.feedback.airJump();
    if (
      (input.pressed('dash') || (input.pressed('crouch') && !this.body.onGround)) &&
      !this.body.onGround &&
      this.dashCooldown <= 0 &&
      this.grapple.mode !== 'on'
    )
      this.dash(motion.wishLen > 0 ? motion.wish : motion.forward);
  }
  integrate(dt: number, input: MovementInput, motion: MotionFrame) {
    const b = this.body,
      world = this.environment.world;
    b.vel.y -= 26 * this.gravityScale * (this.grapple.mode === 'on' ? 0.88 : 1) * dt;
    this.grapple.update(dt, input.pressed('grapple'), input.down('grapple'), motion.mv.y);
    if (
      !b.onGround &&
      this.mantleCooldown <= 0 &&
      motion.mv.y > 0.3 &&
      b.vel.y < 8 &&
      this.grapple.mode !== 'on'
    )
      this.tryMantle(motion.forward);
    b.noSnap = this.grapple.mode === 'on' || b.vel.y > 0.5;
    const speed = b.vel.length();
    if (speed > 48) b.vel.multiplyScalar(48 / speed);
    world.moveBody(b, dt);
    if (b.pos.y < -12 || Math.abs(b.pos.x) > 95 || Math.abs(b.pos.z) > 95) {
      this.grapple.detach(false);
      b.pos.copy(this.environment.spawnPoint());
      b.vel.set(0, 0, 0);
      this.feedback.fell();
    }
    if (b.onGround && !this.lastGround) {
      const impact = clamp(-b.landVel / 14, 0, 1.5);
      this.feedback.land(impact);
      if (Math.hypot(b.vel.x, b.vel.z) > 9) this.landGrace = 0.4;
    }
    this.lastGround = b.onGround;
  }
  private startSlide(speed: number) {
    this.sliding = true;
    this.slideTime = 0;
    const boost = clamp(12.8 - speed, 0, 4.5),
      b = this.body;
    b.vel.x += (b.vel.x / speed) * boost;
    b.vel.z += (b.vel.z / speed) * boost;
    this.feedback.slide();
  }
  private dash(direction: Vector3) {
    const b = this.body;
    this.dashCooldown = 1.3;
    const current = b.vel.x * direction.x + b.vel.z * direction.z,
      target = Math.max(current + 6, 14);
    b.vel.x += direction.x * (target - current);
    b.vel.z += direction.z * (target - current);
    b.vel.y = Math.max(b.vel.y, 2);
    this.feedback.dash(direction);
  }
  private tryMantle(forward: Vector3) {
    const b = this.body,
      world = this.environment.world,
      probe = this.probe;
    probe.set(b.pos.x, b.pos.y + 1, b.pos.z);
    if (!world.raycast(probe, forward, 0.95)) return;
    probe.set(b.pos.x + forward.x * 0.95, b.pos.y + 2.75, b.pos.z + forward.z * 0.95);
    const top = world.raycast(probe, down, 2.25);
    if (!top || top.normal.y < 0.5) return;
    const height = top.point.y - b.pos.y;
    if (height < 0.5 || height > 2.4) return;
    const half = b.halfW;
    if (
      world.overlapsAABB(
        { x: probe.x - half, y: top.point.y + 0.08, z: probe.z - half },
        { x: probe.x + half, y: top.point.y + 1.05, z: probe.z + half },
      )
    )
      return;
    b.vel.y = Math.min(11, Math.sqrt(2 * 26 * (height + 0.45)));
    b.vel.x = forward.x * 3.2;
    b.vel.z = forward.z * 3.2;
    this.mantleCooldown = 0.7;
    this.feedback.mantle();
  }
}
