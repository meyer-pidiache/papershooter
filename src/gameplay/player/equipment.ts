import type { Object3D } from 'three';
import type { WeaponFrame, WeaponPose } from '../../domain/weapon-frame.js';
export interface EquippableWeapon {
  readonly kind: string;
  readonly name: string;
  readonly hint: string;
  readonly isGun: boolean;
  readonly scope?: boolean;
  readonly aimAmt: number;
  readonly adsFov: number;
  readonly root: Object3D;
  equip(): void;
  unequip(): void;
  animate(dt: number, frame: WeaponFrame): void;
  startSlash?(frame: WeaponFrame): void;
  resetAmmo?(): void;
  addAmmoFraction?(fraction: number): void;
}
export interface EquipmentInput {
  down(action: string): boolean;
  pressed(action: string): boolean;
}
export interface EquipmentFeedback {
  selected(weapon: EquippableWeapon, silent: boolean): void;
  sights(ads: boolean, scope: boolean): void;
}

// Selection, temporary melee and input dispatch belong to the loadout, not to locomotion.
export class Equipment {
  index = 0;
  readonly meleeIndex: number;
  private previousIndex = 0;
  private returnTime = 0;
  firing = false;
  constructor(
    readonly weapons: readonly EquippableWeapon[],
    private readonly feedback: EquipmentFeedback,
  ) {
    if (!weapons.length) throw new Error('A loadout requires at least one weapon');
    this.meleeIndex = weapons.findIndex((weapon) => weapon.kind === 'katana');
    this.current.equip();
  }
  get current() {
    return this.weapons[this.index];
  }
  switchTo(index: number, silent = false) {
    if (index < 0 || index >= this.weapons.length) return;
    if (index === this.index && !silent) return;
    if (this.current.kind !== 'katana') this.previousIndex = this.index;
    this.current.unequip();
    this.index = index;
    this.current.equip();
    this.feedback.selected(this.current, silent);
  }
  reset() {
    for (const weapon of this.weapons) weapon.resetAmmo?.();
    this.switchTo(0, true);
  }
  addAmmo(fraction: number) {
    for (const weapon of this.weapons) weapon.addAmmoFraction?.(fraction);
  }
  frame(input: EquipmentInput, pose: WeaponPose): WeaponFrame {
    return {
      fire: input.down('fire'),
      firePressed: input.pressed('fire'),
      aim: pose.aiming || (input.down('aim') && this.current.kind === 'katana'),
      reloadPressed: input.pressed('reload'),
      meleePressed: input.pressed('melee') && this.current.kind === 'katana',
      sprinting: pose.sprinting,
      grounded: pose.grounded,
      speed: pose.speed,
      sliding: pose.sliding,
      lookDelta: pose.lookDelta,
      strafe: pose.strafe,
      bobPhase: pose.bobPhase,
      bobAmt: pose.bobAmt,
      landDip: pose.landDip,
      slideTilt: pose.sliding ? 1 : 0,
      blockFire: !pose.alive,
    };
  }
  update(dt: number, input: EquipmentInput, pose: WeaponPose) {
    this.selectFromInput(input);
    const frame = this.frame(input, pose);
    if (input.pressed('melee') && this.current.kind !== 'katana' && this.meleeIndex >= 0) {
      this.switchTo(this.meleeIndex);
      this.returnTime = 0.85;
      this.current.startSlash?.(frame);
      frame.meleePressed = false;
    }
    this.updateMeleeReturn(dt, frame);
    this.firing = frame.fire && this.current.isGun;
    this.current.animate(dt, frame);
    this.feedback.sights(
      this.current.isGun && this.current.aimAmt > 0.55,
      !!this.current.scope && this.current.aimAmt > 0.62,
    );
  }
  private selectFromInput(input: EquipmentInput) {
    for (let i = 0; i < 5; i++)
      if (input.pressed('slot' + (i + 1))) this.switchTo(Math.min(i, this.weapons.length - 1));
    if (input.pressed('nextWeapon')) this.switchTo((this.index + 1) % this.weapons.length);
    if (input.pressed('prevWeapon'))
      this.switchTo((this.index + this.weapons.length - 1) % this.weapons.length);
  }
  private updateMeleeReturn(dt: number, frame: WeaponFrame) {
    if (this.returnTime <= 0) return;
    if (this.current.kind === 'katana' && (frame.firePressed || frame.aim || frame.meleePressed))
      this.returnTime = 0;
    else {
      this.returnTime -= dt;
      if (this.returnTime <= 0) this.switchTo(this.previousIndex);
    }
  }
}
