import { Vector3 } from 'three';
import type { Body } from '../../engine/physics.js';
export interface GuardWeapon {
  kind: string;
  blocking?: boolean;
  blockT?: number;
}
export interface DeflectedProjectile {
  vel: Vector3;
  pos: Vector3;
}
export interface CombatPose {
  eye: Vector3;
  center: Vector3;
  forward: Vector3;
  right: Vector3;
}
export interface PlayerCombatFeedback {
  hurt(amount: number, from: Vector3 | null): void;
  deflected(projectile: DeflectedProjectile, perfect: boolean): void;
  meleeBlocked(): void;
  died(): void;
}

// Owns local health, recovery and guard windows; feedback receives outcomes, never this owner.
export class PlayerCombat {
  maxHp = 120;
  hp = 120;
  alive = true;
  regenDelay = 4.5;
  regenRate = 11;
  private lastDamageTime = 10;
  private blockHeld = 0;
  private blockCooldown = 0;
  private readonly direction = new Vector3();
  constructor(
    private readonly body: Body,
    private readonly pose: CombatPose,
    private readonly weapon: () => GuardWeapon,
    private readonly feedback: PlayerCombatFeedback,
  ) {}
  reset() {
    this.blockHeld = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.lastDamageTime = 10;
  }
  get blocking() {
    const weapon = this.weapon();
    return weapon.kind === 'katana' && !!weapon.blocking;
  }
  get blockRadius() {
    return this.blocking && this.blockCooldown <= 0 ? 0.95 : 0;
  }
  get parryWindow() {
    return this.blocking && this.blockHeld < 0.55;
  }
  age(dt: number) {
    this.lastDamageTime += dt;
  }
  coolBlock(dt: number) {
    this.blockCooldown -= dt;
  }
  recover(dt: number, sprinting: boolean, grappleIdle: boolean) {
    if (!this.alive) return;
    if (this.lastDamageTime > this.regenDelay && this.hp < this.maxHp && !sprinting && grappleIdle)
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    this.blockHeld = this.blocking ? this.blockHeld + dt : 0;
  }
  takeDamage(amount: number, from: Vector3 | null) {
    if (!this.alive) return;
    this.hp -= amount;
    this.lastDamageTime = 0;
    this.feedback.hurt(amount, from);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }
  knockback(direction: Vector3, amount: number) {
    this.body.vel.addScaledVector(direction, amount);
    this.body.vel.y += amount * 0.5;
    this.body.onGround = false;
  }
  tryDeflect(projectile: DeflectedProjectile) {
    if (!this.alive || !this.blocking || this.blockCooldown > 0) return false;
    this.direction.copy(projectile.vel).normalize().negate();
    if (this.direction.dot(this.pose.forward) < 0.55) return false;
    const perfect = (this.weapon().blockT ?? Infinity) < 0.26,
      ret = perfect || Math.random() < 0.35;
    this.blockCooldown = 0.19;
    this.feedback.deflected(projectile, perfect);
    return { perfect, ret };
  }
  tryBlockMelee(enemy: { center: Vector3 }) {
    if (!this.alive || !this.parryWindow || this.blockCooldown > 0) return false;
    this.direction.subVectors(enemy.center, this.pose.eye).normalize();
    if (this.direction.dot(this.pose.forward) < 0.35) return false;
    this.feedback.meleeBlocked();
    return true;
  }
  die() {
    if (!this.alive) return;
    this.alive = false;
    this.feedback.died();
  }
}
