import { Vector3, type PerspectiveCamera } from 'three';
import type { Body } from '../engine/physics.js';
import { clamp, damp, Spring } from '../engine/math.js';
export interface FirstPersonFrame {
  alive: boolean;
  crouching: boolean;
  sliding: boolean;
  strafe: number;
  sprinting: boolean;
  aiming: boolean;
  adsFov: number;
  grappling: boolean;
}
export class FirstPersonView {
  readonly eye = new Vector3();
  readonly center = new Vector3();
  readonly forward = new Vector3(0, 0, -1);
  readonly right = new Vector3(1, 0, 0);
  yaw = 0;
  pitch = 0;
  roll = 0;
  fov = 82;
  speed = 0;
  hurtFx = 0;
  flashFx = 0;
  bobPhase = 0;
  bobAmt = 0;
  private stepDist = 0;
  private eyeH = 1.6;
  private readonly recoilPitch = new Spring(190, 17);
  private readonly recoilYaw = new Spring(190, 17);
  private readonly fovKick = new Spring(220, 14);
  private readonly landDip = new Spring(170, 15);
  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly body: Body,
    private readonly sampleShake: (dt: number) => number,
    private readonly footstep: (gain: number) => void,
  ) {
    camera.rotation.order = 'YXZ';
  }
  reset() {
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.hurtFx = 0;
    this.flashFx = 0;
    this.eyeH = 1.6;
  }
  get landDipValue() {
    return this.landDip.value;
  }
  hurt(amount: number) {
    this.hurtFx = Math.min(1, this.hurtFx + amount / 40);
  }
  flash(amount: number) {
    this.flashFx = amount;
  }
  addRoll(amount: number) {
    this.roll += amount;
  }
  kickLand(amount: number) {
    this.landDip.kick(amount);
  }
  recoil(p: number, y: number) {
    this.pitch = clamp(this.pitch + p * 0.55, -1.5, 1.5);
    this.recoilPitch.kick(p * 22);
    this.recoilYaw.kick(y * 30);
  }
  kickFov(v: number) {
    this.fovKick.kick(v * 30);
  }
  look(delta: { x: number; y: number }, aiming: boolean, scope: boolean) {
    const scale = aiming ? (scope ? 0.38 : 0.62) : 1;
    this.yaw += delta.x * scale;
    this.pitch = clamp(this.pitch + delta.y * scale, -1.5, 1.5);
    this.updateDirections();
  }
  updateDirections() {
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }
  sink(dt: number) {
    this.eyeH = damp(this.eyeH, 0.35, 3, dt);
    this.roll = damp(this.roll, 0.9, 3, dt);
    this.pitch = damp(this.pitch, -0.35, 3, dt);
  }
  idle(t: number) {
    const c = this.camera;
    c.position.set(Math.sin(t * 0.08) * 70, 30 + Math.sin(t * 0.23) * 4, Math.cos(t * 0.08) * 70);
    c.lookAt(0, 10, 0);
    this.eye.copy(c.position);
    this.center.copy(c.position);
    c.getWorldDirection(this.forward);
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();
    if (Math.abs(c.fov - 70) > 0.01) {
      c.fov = 70;
      c.updateProjectionMatrix();
    }
  }
  updateStride(dt: number, sprinting: boolean, sliding: boolean) {
    const b = this.body;
    const hs2 = Math.hypot(b.vel.x, b.vel.z);
    const moving = b.onGround && hs2 > 0.6 && !sliding;
    this.bobAmt = damp(this.bobAmt, moving ? clamp(hs2 / 7, 0.3, 1.4) : 0, 8, dt);
    if (moving) {
      this.bobPhase += dt * (7 + hs2 * 0.5);
      this.stepDist += hs2 * dt;
      if (this.stepDist > (sprinting ? 2.5 : 2.0)) {
        this.stepDist = 0;
        this.footstep(clamp(hs2 / 8, 0.3, 1));
      }
    }
  }
  update(dt: number, frame: FirstPersonFrame) {
    const b = this.body,
      cam = this.camera;
    const targetEye = frame.crouching ? 0.88 : 1.6;
    this.eyeH = frame.alive ? damp(this.eyeH, targetEye, 14, dt) : this.eyeH;
    this.recoilPitch.update(dt);
    this.recoilYaw.update(dt);
    this.fovKick.update(dt);
    this.landDip.update(dt);
    if (frame.alive)
      this.roll = damp(this.roll, -frame.strafe * 0.022 + (frame.sliding ? -0.08 : 0), 9, dt);
    const sh = this.sampleShake(dt);
    const shk = Math.min(sh, 1.2);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.03 * this.bobAmt,
      bobX = Math.cos(this.bobPhase * 0.5) * 0.018 * this.bobAmt;
    this.eye.set(b.pos.x, b.pos.y + this.eyeH + this.landDip.value * 0.07 + bobY, b.pos.z);
    this.center.set(b.pos.x, b.pos.y + b.height * 0.55, b.pos.z);
    cam.position
      .copy(this.eye)
      .addScaledVector(this.right, bobX + (Math.random() - 0.5) * shk * 0.07);
    cam.position.y += (Math.random() - 0.5) * shk * 0.07;
    cam.rotation.set(
      this.pitch + this.recoilPitch.value + (Math.random() - 0.5) * shk * 0.035,
      this.yaw + this.recoilYaw.value + (Math.random() - 0.5) * shk * 0.035,
      this.roll + Math.sin(this.bobPhase * 0.5) * 0.004 * this.bobAmt,
    );
    const sp3 = b.vel.length();
    let fov =
      82 +
      clamp((sp3 - 7) / 16, 0, 1) * 8 +
      (frame.sprinting ? 3 : 0) +
      (frame.sliding ? 4 : 0) +
      (frame.grappling ? 3 : 0) +
      this.fovKick.value;
    if (frame.aiming) fov = frame.adsFov;
    this.fov = damp(this.fov, fov, frame.aiming ? 16 : 8, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    this.hurtFx = damp(this.hurtFx, 0, 3, dt);
    this.flashFx = damp(this.flashFx, 0, 10, dt);
    this.speed = sp3;
  }
}
