import { Vector3, type Group } from 'three';
import { clamp, damp, lerp } from '../../engine/math.js';
import type { KatanaModel } from '../models/weapon-contracts.js';
import type { SwingFrame } from '../../domain/weapon-frame.js';
interface SpringPort {
  kick(x: number, y: number, z: number): void;
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export class BladeAnimation {
  private blockAmt = 0;
  private parrySwing = 0;
  private parryDir = 1;
  bloodLevel = 0;
  private readonly blockPos = new Vector3(0.21, -0.31, -0.36);
  private readonly blockRot = new Vector3(1.4, 0.3, 1.24);
  constructor(
    private readonly root: Group,
    private readonly model: KatanaModel,
    private readonly recoil: SpringPort,
    private readonly recoilRot: SpringPort,
  ) {}
  age(dt: number) {
    this.parrySwing = Math.max(0, this.parrySwing - dt * 4.5);
    this.updateBlood(dt);
  }
  guard(dt: number, blocking: boolean) {
    this.blockAmt = damp(this.blockAmt, blocking ? 1 : 0, 16, dt);
    const p = this.root.position,
      r = this.root.rotation;
    // Blend the whole pose to an absolute target. Adding an offset instead does not work here:
    // the shared animator already scales the base rotation down by the aim amount, so the same
    // offset landed on a different rotation depending on how far into the guard you were.
    if (this.blockAmt > 0.001) {
      const t = this.blockAmt;
      p.lerp(this.blockPos, t);
      r.x = lerp(r.x, this.blockRot.x, t);
      r.y = lerp(r.y, this.blockRot.y, t);
      r.z = lerp(r.z, this.blockRot.z, t);
    }
    // a parry is a small flick of the wrist, nothing that throws the pose around
    if (this.parrySwing > 0) {
      const e = Math.sin(Math.min(1, this.parrySwing) * Math.PI);
      r.z += this.parryDir * e * 0.42;
      r.y += this.parryDir * e * 0.16;
      p.x += this.parryDir * e * 0.035;
    }
  }
  swing(frame: Pick<SwingFrame, 'progress' | 'direction'>) {
    const p = this.root.position,
      r = this.root.rotation;
    const t = frame.progress;
    const e = easeInOut(t);
    const s = frame.direction;
    r.z += s * (1.3 - 2.7 * e);
    r.x += 0.7 - 1.5 * e;
    r.y += s * (-0.35 + 0.8 * e);
    p.x += s * (0.2 - 0.45 * e);
    p.y += 0.14 - 0.24 * e;
    p.z -= 0.12 * Math.sin(t * Math.PI);
  }
  onDeflect(perfect: boolean) {
    this.parrySwing = 1;
    this.parryDir = -this.parryDir;
    this.recoilRot.kick(perfect ? -3.5 : -2, this.parryDir * 2, this.parryDir * 2.5);
    this.recoil.kick(this.parryDir * 0.15, 0.15, 1.2);
  }
  addBlood(amount: number) {
    this.bloodLevel = clamp(this.bloodLevel + amount, 0, 1);
  }
  updateBlood(dt: number) {
    this.bloodLevel = Math.max(0, this.bloodLevel - dt * 0.05);
    const lv = this.bloodLevel;
    for (let i = 0; i < this.model.smears.length; i++) {
      const sm = this.model.smears[i];
      const on = lv > sm.at;
      sm.mesh.visible = on;
      // grow along the blade and fill out in height as it soaks, never past the steel
      if (on) {
        const f = clamp((lv - sm.at) / 0.28, 0.2, 1);
        sm.mesh.scale.set(1, 0.35 + 0.65 * f, 0.4 + 0.6 * f);
      }
    }
  }
}
