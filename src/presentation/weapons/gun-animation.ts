import type { Group } from 'three';
import { rand, clamp, TAU } from '../../engine/math.js';
import type { GunModel } from '../models/weapon-contracts.js';
import type { PumpFrame } from '../../domain/weapon-frame.js';
interface SpringPort {
  kick(x: number, y: number, z: number): void;
}
interface CycleCues {
  pump(): void;
  shell(): void;
  eject(spread?: number): void;
}
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export class GunAnimation {
  private flashTime = 0;
  private racked = false;
  private pumped = false;
  constructor(
    private readonly root: Group,
    private readonly model: GunModel,
    private readonly recoil: SpringPort,
    private readonly recoilRot: SpringPort,
    private readonly cues: CycleCues,
  ) {}
  beginReload() {
    this.racked = false;
  }
  resetPump() {
    this.pumped = false;
  }
  ageFlash(dt: number) {
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.model.flash.visible = false;
    }
  }
  showFlash(scale: number) {
    this.model.flash.visible = true;
    this.flashTime = 0.045;
    this.model.flash.rotation.z = rand(0, TAU);
    this.model.flash.scale.setScalar(scale * rand(0.8, 1.4));
  }
  pump(frame: PumpFrame) {
    const p = this.root.position,
      r = this.root.rotation;
    const t = frame.progress;
    const s = Math.sin(Math.min(1, t * 1.15) * Math.PI);
    if (this.model.foreEnd && this.model.foreEndZ !== undefined)
      this.model.foreEnd.position.z = this.model.foreEndZ + s * 0.16;
    if (this.model.boltH && this.model.boltZ !== undefined) {
      this.model.boltH.position.z = this.model.boltZ + s * 0.2;
      this.model.boltH.rotation.z = -s * 1.1;
    }
    r.x += s * 0.12;
    r.z += s * 0.15;
    p.y -= s * 0.02;
    if (t > 0.45 && !this.pumped) {
      this.pumped = true;
      this.cues.pump();
      this.cues.eject();
      this.recoilRot.kick(-1.5, 0, 1);
    }
    if (frame.finished) {
      this.pumped = false;
      if (this.model.foreEnd && this.model.foreEndZ !== undefined)
        this.model.foreEnd.position.z = this.model.foreEndZ;
      if (this.model.boltH && this.model.boltZ !== undefined) {
        this.model.boltH.position.z = this.model.boltZ;
        this.model.boltH.rotation.z = 0;
      }
    }
  }
  magazine(t: number) {
    const { magMesh, magY } = this.model;
    if (!magMesh || magY === undefined)
      throw new Error('Magazine animation requires a magazine attachment');
    const p = this.root.position,
      r = this.root.rotation;
    const tilt =
      Math.sin((clamp(t / 0.22, 0, 1) * Math.PI) / 2) *
      (t < 0.82 ? 1 : clamp(1 - (t - 0.82) / 0.18, 0, 1));
    r.x += -0.3 * tilt;
    r.z += 0.5 * tilt;
    r.y += 0.25 * tilt;
    p.y -= 0.07 * tilt;
    p.x += 0.03 * tilt;
    const mt = clamp((t - 0.18) / 0.5, 0, 1);
    magMesh.position.y = magY - Math.sin(mt * Math.PI) * 0.3;
    magMesh.rotation.z = Math.sin(mt * Math.PI) * 0.6;
    if (t > 0.86 && !this.racked) {
      this.racked = true;
      this.recoilRot.kick(-2.5, 0, 0);
      this.recoil.kick(0, 0, 0.6);
    }
  }
  cylinder(t: number) {
    const { cylGroup } = this.model;
    if (!cylGroup) throw new Error('Cylinder animation requires a cylinder attachment');
    const p = this.root.position,
      r = this.root.rotation;
    const open = t < 0.25 ? easeOut(t / 0.25) : t > 0.8 ? 1 - easeOut((t - 0.8) / 0.2) : 1;
    r.z += 0.9 * open;
    r.x += 0.3 * open;
    p.x -= 0.05 * open;
    p.y += 0.02 * open;
    cylGroup.rotation.z = -1.5 * open;
    if (t > 0.3 && !this.racked) {
      this.racked = true;
      for (let i = 0; i < 6; i++) this.cues.eject(0.7);
      this.cues.shell();
    }
  }
  shell(t: number) {
    const p = this.root.position,
      r = this.root.rotation;
    const s = Math.sin(Math.min(1, t) * Math.PI);
    r.z += 0.35 * s;
    r.x += 0.15 * s;
    p.y -= 0.04 * s;
    if (this.model.handL && this.model.handLPos)
      this.model.handL.position.set(
        this.model.handLPos.x + 0.1 * s,
        this.model.handLPos.y - 0.12 * s,
        this.model.handLPos.z + 0.55 * s,
      );
  }
  restoreHand() {
    if (this.model.handL && this.model.handLPos)
      this.model.handL.position.copy(this.model.handLPos);
  }
  closeCylinder() {
    if (this.model.cylGroup) this.model.cylGroup.rotation.z = 0;
  }
}
