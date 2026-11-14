import { clamp } from '../../engine/math.js';
import type { WeaponFrame, SwingFrame } from '../../domain/weapon-frame.js';
export class MeleeMechanics {
  slashTime = 0;
  readonly duration = 0.27;
  combo = 0;
  private comboTime = 0;
  blocking = false;
  blockTime = 0;
  private hitDone = false;
  cooldown = 0;
  damage = 75;
  private readonly swing: SwingFrame = { progress: 0, direction: 1, hit: false };
  get direction(): 1 | -1 {
    return this.combo % 2 === 0 ? -1 : 1;
  }
  startSlash() {
    this.slashTime = this.duration;
    this.hitDone = false;
    this.combo++;
    this.comboTime = 0.9;
    this.cooldown = this.duration + 0.06;
  }
  age(dt: number) {
    this.cooldown -= dt;
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
  }
  guard(dt: number, frame: WeaponFrame) {
    const wanted = frame.aim && !frame.fire && this.slashTime <= 0 && this.cooldown <= 0;
    if (wanted && !this.blocking) this.blockTime = 0;
    this.blocking = wanted;
    if (this.blocking) this.blockTime += dt;
  }
  advanceSwing(dt: number): SwingFrame | null {
    if (this.slashTime <= 0) return null;
    this.slashTime -= dt;
    this.swing.progress = clamp(1 - this.slashTime / this.duration, 0, 1);
    this.swing.direction = this.direction;
    this.swing.hit = !this.hitDone && this.swing.progress > 0.32;
    if (this.swing.hit) this.hitDone = true;
    return this.swing;
  }
  wantsFire(frame: WeaponFrame) {
    return (
      (frame.firePressed || (frame.fire && this.combo > 0)) &&
      this.cooldown <= 0 &&
      !frame.blockFire
    );
  }
  wantsMelee(frame: WeaponFrame) {
    return frame.meleePressed && this.slashTime <= 0 && this.cooldown <= 0;
  }
}
