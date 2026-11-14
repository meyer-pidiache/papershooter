import { Vector3 } from 'three';
import { clamp } from '../../engine/math.js';
import type { Body } from '../../engine/physics.js';
import { findGrappleTarget } from './grapple-target.js';
import type {
  GrappleFeedback,
  GrapplePose,
  GrappleQueries,
  GrappleState,
  GrappleVisualPort,
  GrappleWorldPort,
  GrappleServices,
} from './grapple-contracts.js';

// Owns hook transitions, rope constraints and stamina. Shared body/pose are explicit physics data.
export class Grapple {
  readonly state: GrappleState = {
    state: 'idle',
    anchor: new Vector3(),
    hook: new Vector3(),
    from: new Vector3(),
    flyT: 0,
    flyDur: 0,
    len: 0,
    cd: 0,
    enemy: null,
    mover: null,
    blockedT: 0,
    t: 0,
    swingT: 0,
  };
  stamina = 1;
  private recoveryPause = 0;
  private readonly direction = new Vector3();
  private readonly pump = new Vector3();
  private readonly hand = new Vector3();
  private readonly world: GrappleWorldPort;
  private readonly queries: GrappleQueries;
  private readonly view: GrappleVisualPort;
  private readonly feedback: GrappleFeedback;
  constructor(
    private readonly body: Body,
    private readonly pose: GrapplePose,
    services: GrappleServices,
  ) {
    this.world = services.world;
    this.queries = services.queries;
    this.view = services.view;
    this.feedback = services.feedback;
  }
  get mode() {
    return this.state.state;
  }
  reset() {
    this.stamina = 1;
    this.detach(false);
  }
  private handPosition(out: Vector3) {
    out
      .copy(this.pose.eye)
      .addScaledVector(this.pose.right, -0.55)
      .addScaledVector(this.pose.forward, 0.9);
    out.y -= 0.42;
    return out;
  }
  private target() {
    return findGrappleTarget(this.pose, this.world, this.queries);
  }
  private fire() {
    if (this.stamina < 0.18) {
      this.feedback.outOfBreath();
      return;
    }
    const target = this.target();
    if (!target) {
      this.feedback.missed();
      return;
    }
    this.stamina -= 0.09;
    this.recoveryPause = 0.5;
    const g = this.state;
    g.state = 'fly';
    g.anchor.copy(target.point);
    this.handPosition(g.from);
    g.hook.copy(g.from);
    g.flyT = 0;
    g.flyDur = clamp(target.dist / 110, 0.04, 0.6);
    g.enemy = target.enemy || null;
    g.mover = target.mover || null;
    g.t = 0;
    this.feedback.fired();
  }
  detach(boost: boolean) {
    const g = this.state;
    if (g.state === 'idle') return;
    const previous = g.state;
    g.state = 'idle';
    g.cd = 0.12;
    g.enemy = null;
    g.mover = null;
    this.recoveryPause = 0.5;
    this.view.hide();
    this.feedback.stopped();
    if (previous === 'on') {
      if (boost) {
        this.body.vel.y = Math.max(this.body.vel.y, 0) + 8;
        this.body.vel.x *= 1.12;
        this.body.vel.z *= 1.12;
      } else this.body.vel.y += 2.5;
      this.feedback.released(boost);
    }
  }
  recover(dt: number) {
    this.recoveryPause -= dt;
    if (this.state.state !== 'idle') this.stamina -= 0.08 * dt;
    else if (this.recoveryPause <= 0) this.stamina += (this.body.onGround ? 0.4 : 0.2) * dt;
    this.stamina = clamp(this.stamina, 0, 1);
    if (this.state.state === 'on' && this.stamina <= 0) {
      this.detach(false);
      this.feedback.exhausted();
    }
  }
  update(dt: number, pressed: boolean, held: boolean, forwardInput: number) {
    const g = this.state;
    g.cd -= dt;
    if (g.state === 'idle') {
      if (pressed && g.cd <= 0) this.fire();
      g.t += dt;
      if (g.t > 0.08) {
        g.t = 0;
        this.feedback.target(this.target() ? 1 : 0);
      }
    } else if (g.state === 'fly') this.advanceHook(dt);
    else this.swing(dt, pressed, held, forwardInput);
    if (g.state !== 'idle') this.view.draw(this.handPosition(this.hand), g.hook);
  }
  private advanceHook(dt: number) {
    const g = this.state;
    if (g.mover) g.anchor.copy(g.mover.mesh.position);
    g.flyT += dt;
    const fraction = Math.min(1, g.flyT / g.flyDur);
    g.hook.lerpVectors(g.from, g.anchor, fraction);
    if (fraction < 1) return;
    if (g.enemy) {
      if (g.enemy.alive) {
        this.queries.yank(g.enemy, this.pose.center);
        this.feedback.yanked();
      }
      this.detach(false);
      return;
    }
    g.state = 'on';
    g.len = Math.max(1.5, this.pose.center.distanceTo(g.anchor) * 0.94);
    g.blockedT = 0;
    g.t = 0;
    g.swingT = 0;
    this.feedback.attached();
    if (this.body.onGround) {
      this.body.vel.y = Math.max(this.body.vel.y, 5);
      this.body.onGround = false;
    }
  }
  private swing(dt: number, pressed: boolean, reeling: boolean, forwardInput: number) {
    const g = this.state,
      b = this.body,
      c = this.pose.center;
    if (g.mover) g.anchor.copy(g.mover.mesh.position);
    g.hook.copy(g.anchor);
    g.swingT += dt;
    const direction = this.direction.subVectors(g.anchor, c),
      distance = direction.length();
    if (distance > 0.01) direction.divideScalar(distance);
    this.applyPull(dt, reeling, forwardInput, distance);
    if (b.onGround && reeling && direction.y > 0.2) {
      b.vel.y = Math.max(b.vel.y, 4.5);
      b.onGround = false;
    }
    g.t += dt;
    if (g.t > 0.15) {
      g.t = 0;
      if (!this.world.hasLineOfSight(this.pose.eye, g.anchor)) g.blockedT += 0.15;
      else g.blockedT = 0;
    }
    if (
      pressed ||
      distance < 1.3 ||
      g.blockedT > 0.3 ||
      distance > 90 ||
      (b.onGround && g.swingT > 0.6 && !reeling)
    )
      this.detach(distance < 1.3);
  }
  private applyPull(dt: number, reeling: boolean, forwardInput: number, distance: number) {
    const g = this.state,
      b = this.body,
      direction = this.direction;
    const along = b.vel.dot(direction);
    if (reeling) {
      g.len = Math.max(1.5, g.len - 14 * dt);
      if (along < 22) b.vel.addScaledVector(direction, 42 * dt);
    } else {
      if (along < 6) b.vel.addScaledVector(direction, 3 * dt);
      if (forwardInput > 0.3 && this.pose.center.y < g.anchor.y - 1) {
        this.pump.copy(this.pose.forward);
        this.pump.y = 0;
        if (this.pump.lengthSq() > 0.01) {
          this.pump.normalize();
          b.vel.addScaledVector(this.pump, 10 * dt);
        }
      }
    }
    if (distance > g.len) {
      const normalVelocity = b.vel.dot(direction);
      if (normalVelocity < 0) b.vel.addScaledVector(direction, -normalVelocity);
      const excess = Math.min(distance - g.len, 0.35) * 0.85;
      b.pos.addScaledVector(direction, excess);
      if (this.world.overlapsBody(b)) b.pos.addScaledVector(direction, -excess);
    }
  }
}
