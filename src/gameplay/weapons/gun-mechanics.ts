import { damp } from '../../engine/math.js';
import type { GunDefinition } from '../../domain/weapons.js';
import type { WeaponFrame, PumpFrame } from '../../domain/weapon-frame.js';
export type GunMechanismSpec = Pick<
  GunDefinition,
  | 'magSize'
  | 'reserve'
  | 'maxReserve'
  | 'interval'
  | 'reloadDur'
  | 'reloadType'
  | 'auto'
  | 'cycleDur'
  | 'spread'
  | 'adsSpread'
  | 'spreadKick'
  | 'spreadMax'
  | 'moveSpread'
  | 'scope'
>;

// Pure ammunition/timing/bloom state. No model, sound, actor or world access.
export class GunMechanics {
  mag: number;
  reserve: number;
  fireTime = 0;
  reloading = false;
  reloadTime = 0;
  pumpTime = 0;
  needPump = false;
  spread: number;
  private readonly pumpFrame: PumpFrame = { progress: 0, finished: false };
  constructor(private readonly spec: GunMechanismSpec) {
    this.mag = spec.magSize;
    this.reserve = spec.reserve;
    this.spread = spec.spread;
  }
  resetAmmo() {
    this.mag = this.spec.magSize;
    this.reserve = this.spec.reserve;
    this.reloading = false;
    this.pumpTime = 0;
  }
  addAmmo(amount: number) {
    this.reserve = Math.min(this.reserve + amount, this.spec.maxReserve);
  }
  startReload() {
    if (this.reloading || this.mag >= this.spec.magSize || this.reserve <= 0) return false;
    this.reloading = true;
    this.reloadTime = 0;
    return true;
  }
  ageFire(dt: number) {
    this.fireTime -= dt;
  }
  bloom(dt: number, frame: WeaponFrame) {
    const base = frame.aim ? this.spec.adsSpread : this.spec.spread;
    let movement =
      Math.min(frame.speed, 24) * this.spec.moveSpread +
      (frame.grounded ? 0 : 0.01) +
      (frame.sliding ? 0.008 : 0);
    if (frame.aim) movement *= this.spec.scope ? 0.03 : 0.3;
    this.spread = damp(this.spread, base + movement, 7, dt);
  }
  advancePump(dt: number): PumpFrame | null {
    if (this.pumpTime <= 0 || !this.spec.cycleDur) return null;
    this.pumpTime -= dt;
    this.pumpFrame.progress = 1 - this.pumpTime / this.spec.cycleDur;
    this.pumpFrame.finished = this.pumpTime <= 0;
    if (this.pumpFrame.finished) this.needPump = false;
    return this.pumpFrame;
  }
  advanceReload(dt: number) {
    this.reloadTime += dt;
    return this.reloadTime / this.spec.reloadDur;
  }
  finishMagazine() {
    if (this.reloadTime < this.spec.reloadDur) return false;
    const take = Math.min(this.spec.magSize - this.mag, this.reserve);
    this.mag += take;
    this.reserve -= take;
    this.reloading = false;
    return true;
  }
  finishShell(): 'waiting' | 'loaded' | 'complete' {
    if (this.reloadTime < this.spec.reloadDur) return 'waiting';
    this.mag++;
    this.reserve--;
    this.reloadTime = 0;
    if (this.mag >= this.spec.magSize || this.reserve <= 0) {
      this.reloading = false;
      if (this.needPump) this.pumpTime = this.spec.cycleDur ?? 0;
      return 'complete';
    }
    return 'loaded';
  }
  wantsReload(frame: WeaponFrame) {
    return (
      frame.reloadPressed &&
      this.mag < this.spec.magSize &&
      this.reserve > 0 &&
      !this.reloading &&
      this.pumpTime <= 0
    );
  }
  trigger(frame: WeaponFrame): 'none' | 'empty' | 'fire' {
    const wants = this.spec.auto ? frame.fire : frame.firePressed;
    if (!wants || this.fireTime > 0 || this.pumpTime > 0 || frame.blockFire) return 'none';
    return this.mag <= 0 ? 'empty' : 'fire';
  }
  interruptReload() {
    const interrupted = this.reloading;
    this.reloading = false;
    return interrupted;
  }
  beginShot() {
    this.fireTime = this.spec.interval;
    this.mag--;
    const before = this.spread;
    this.spread = Math.min(this.spread + this.spec.spreadKick, this.spec.spreadMax);
    return before;
  }
  armCycle() {
    if (!this.spec.cycleDur) return false;
    this.pumpTime = this.spec.cycleDur + 0.12;
    if (this.spec.reloadType === 'shells') this.needPump = true;
    return true;
  }
}
