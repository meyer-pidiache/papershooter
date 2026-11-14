import { GunMechanics } from './gun-mechanics.js';
import { GunAnimation } from '../../presentation/weapons/gun-animation.js';
import { ShellEjection } from '../../presentation/weapons/shell-ejection.js';
import * as THREE from 'three';
import { makeInkMaterial } from '../../presentation/ink/materials.js';
import { INK } from '../../shared/ink.js';
import { SEE_THROUGH } from '../../engine/physics.js';
import { rand, clamp } from '../../engine/math.js';
import { ViewModel } from '../../presentation/viewmodel.js';
import { GUNS } from '../../domain/weapons.js';
import {
  buildRifle,
  buildShotgun,
  buildSniper,
  buildRevolver,
} from '../../presentation/models/guns.js';
const gunBuilders = {
  rifle: buildRifle,
  shotgun: buildShotgun,
  sniper: buildSniper,
  revolver: buildRevolver,
};
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();
export class Gun extends ViewModel {
  constructor(ctx, type) {
    super(ctx);
    const { reserve, ...metadata } = GUNS[type];
    Object.assign(this, metadata);
    this.mechanics = new GunMechanics({ ...metadata, reserve });
    this.isGun = true;
    this.autoReloadTimer = null;
    this.disposed = false;
    this.mat = makeInkMaterial({ ink: INK.BLUE });
    this.dark = makeInkMaterial({ ink: INK.BLACK });
    this.red = makeInkMaterial({ ink: INK.RED, fill: true });
    this.model = gunBuilders[type](this.root, { mat: this.mat, dark: this.dark, red: this.red });
    this.ejection = new ShellEjection(
      this.model.ejectPt,
      this.shell,
      () => ctx.player,
      (point, velocity, ink, size) => ctx.effects.shell(point, velocity, ink, size),
    );
    this.animation = new GunAnimation(this.root, this.model, this.recoil, this.recoilRot, {
      pump: () => ctx.audio.pump(),
      shell: () => ctx.audio.shell(),
      eject: (spread) => this.ejection.eject(spread),
    });
    this.setSight(...this.sight);
  }
  get mag() {
    return this.mechanics.mag;
  }
  set mag(value) {
    this.mechanics.mag = value;
  }
  get reserve() {
    return this.mechanics.reserve;
  }
  set reserve(value) {
    this.mechanics.reserve = value;
  }
  get reloading() {
    return this.mechanics.reloading;
  }
  get spreadPx() {
    return 5 + this.mechanics.spread * 900;
  }
  addAmmo(amount) {
    this.mechanics.addAmmo(amount);
  }
  addAmmoFraction(fraction) {
    this.addAmmo(Math.round(this.maxReserve * fraction));
  }
  resetAmmo() {
    this.mechanics.resetAmmo();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.autoReloadTimer);
    this.autoReloadTimer = null;
  }
  startReload() {
    if (this.disposed) return;
    if (!this.mechanics.startReload()) return;
    this.animation.beginReload();
    if (this.reloadType === 'shells') this.ctx.audio.shell();
    else if (this.reloadType === 'cylinder') this.ctx.audio.cylinder();
    else this.ctx.audio.reload();
  }
  update(dt, frame) {
    if (this.disposed) return;
    const state = this.mechanics;
    state.ageFire(dt);
    this.animation.ageFlash(dt);
    state.bloom(dt, frame);
    const pump = state.advancePump(dt);
    if (pump) this.animation.pump(pump);
    if (state.reloading && this.advanceReload(dt)) return;
    if (state.wantsReload(frame)) {
      this.startReload();
      return;
    }
    const trigger = state.trigger(frame);
    if (trigger === 'empty') {
      if (frame.firePressed) {
        this.ctx.audio.empty();
        this.startReload();
      }
    } else if (trigger === 'fire') {
      if (state.interruptReload()) this.animation.restoreHand();
      this.fire(frame);
    }
  }
  advanceReload(dt) {
    const progress = this.mechanics.advanceReload(dt);
    if (this.reloadType === 'mag') {
      this.animation.magazine(progress);
      this.mechanics.finishMagazine();
      return true;
    }
    if (this.reloadType === 'cylinder') {
      this.animation.cylinder(progress);
      if (this.mechanics.finishMagazine()) this.animation.closeCylinder();
      return true;
    }
    this.animation.shell(progress);
    const result = this.mechanics.finishShell();
    if (result === 'complete') this.animation.restoreHand();
    else if (result === 'loaded') this.ctx.audio.shell();
    return false;
  }
  fire(st) {
    if (this.disposed) return;
    const ctx = this.ctx,
      P = ctx.player;
    const spreadNow = this.mechanics.beginShot();
    let hits = 0;
    for (let i = 0; i < this.pellets; i++) if (this.fireRay(P.eye, P.aimDir(spreadNow))) hits++;
    // fx
    this.animation.showFlash(this.flashScale);
    this.model.muzzle.getWorldPosition(_v);
    _v2.copy(P.forward);
    ctx.effects.strokeBurst(_v, INK.ORANGE, 4 + this.pellets, 6 * this.flashScale, {
      life: 0.08,
      size: 0.03,
      gravity: 0,
      drag: 8,
    });
    ctx.effects.smoke(_v, _v2, this.kind === 'shotgun' ? 5 : 2);
    if (this.shell && this.reloadType !== 'shells') this.ejection.eject();
    if (this.mechanics.armCycle()) this.animation.resetPump();
    const k = this.modelKick;
    this.recoil.kick(rand(-k[0], k[0]), rand(k[1] * 0.4, k[1]), k[2]);
    this.recoilRot.kick(k[3], rand(-k[4], k[4]), rand(-k[5], k[5]));
    P.recoil(
      this.camKick[0] * (st.aim ? 0.7 : 1) + rand(0, this.camKick[0] * 0.3),
      rand(-this.camKick[1], this.camKick[1]),
    );
    P.kickFov(this.fovKick);
    this.ctx.audio[this.sound]();
    ctx.input.rumble(0.15 + this.fovKick * 0.08, 0.5, 40 + this.fovKick * 15);
    ctx.effects.shakeAmt += 0.02 + this.fovKick * 0.02;
    if (hits > 0 && this.kind === 'shotgun') ctx.game.hitstop(0.03, 0.3);
    if (this.mag === 0 && this.reloadType === 'mag') {
      clearTimeout(this.autoReloadTimer);
      this.autoReloadTimer = setTimeout(() => {
        this.autoReloadTimer = null;
        if (!this.disposed && this.mag === 0 && !this.reloading) this.startReload();
      }, 250);
    }
  }
  fireRay(origin, dir) {
    const ctx = this.ctx;
    const hitE = ctx.enemies.raycast(origin, dir, 300),
      hitW = ctx.world.raycast(origin, dir, 300, SEE_THROUGH);
    let end,
      hit = false;
    // other players in a versus match are targets too; the closest thing along the ray wins
    const hitP = ctx.raycastPlayers ? ctx.raycastPlayers(origin, dir, 300) : null;
    if (hitP && (!hitE || hitP.dist < hitE.dist) && (!hitW || hitP.dist < hitW.dist)) {
      end = hitP.point;
      const crit = hitP.part === 'head';
      const pv = this.pvp || [this.damage, this.headMul, this.falloff];
      let d = pv[0] * (crit ? pv[1] : 1);
      if (pv[2]) d *= clamp(1 - (hitP.dist - pv[2][0]) / (pv[2][1] - pv[2][0]), pv[2][2], 1);
      ctx.hitPlayer(hitP.player, d, {
        point: hitP.point,
        dir,
        part: hitP.part,
        source: this.kind,
        crit,
        dist: hitP.dist,
      });
      hit = true;
    } else if (
      hitW &&
      hitW.box &&
      hitW.box.data.breakable &&
      (!hitE || hitW.dist < hitE.dist) &&
      ctx.breakHit
    ) {
      end = hitW.point;
      ctx.breakHit(hitW.box.data.breakable, this.damage, hitW.point, dir);
      hit = true;
    } else if (hitE && (!hitW || hitE.dist < hitW.dist)) {
      end = hitE.point;
      const crit = hitE.part === 'head';
      let d = this.damage * (crit ? this.headMul : 1);
      if (this.falloff)
        d *= clamp(
          1 - (hitE.dist - this.falloff[0]) / (this.falloff[1] - this.falloff[0]),
          this.falloff[2],
          1,
        );
      ctx.enemies.damage(hitE.enemy, d, {
        point: hitE.point,
        dir,
        part: hitE.part,
        source: this.kind,
        crit,
      });
      hit = true;
    } else if (hitW) {
      end = hitW.point;
      ctx.effects.bulletImpact(hitW.point, hitW.normal, INK.BLUE);
      if (Math.random() < 0.25) this.ctx.audio.ricochet(hitW.point);
    } else end = origin.clone().addScaledVector(dir, 300);
    this.model.muzzle.getWorldPosition(_v);
    ctx.effects.tracer(_v, end, INK.BLUE, this.tracer, 0.05);
    if (ctx.onShot) ctx.onShot(end);
    return hit;
  }
}
export class Rifle extends Gun {
  constructor(ctx) {
    super(ctx, 'rifle');
  }
}
export class Shotgun extends Gun {
  constructor(ctx) {
    super(ctx, 'shotgun');
    this.basePos.set(0.2, -0.19, -0.34);
  }
}
export class Revolver extends Gun {
  constructor(ctx) {
    super(ctx, 'revolver');
    this.basePos.set(0.19, -0.2, -0.3);
  }
}
export class Sniper extends Gun {
  constructor(ctx) {
    super(ctx, 'sniper');
    this.basePos.set(0.21, -0.19, -0.36);
  }
}
