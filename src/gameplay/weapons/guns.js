import * as THREE from 'three';
import { makeInkMaterial } from '../../presentation/ink/materials.js';
import { INK } from '../../shared/ink.js';
import { SEE_THROUGH } from '../../engine/physics.js';
import { rand, clamp, damp, TAU } from '../../engine/math.js';
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
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export class Gun extends ViewModel {
  constructor(ctx, type) {
    super(ctx);
    Object.assign(this, GUNS[type]);
    this.isGun = true;
    this.mag = this.magSize;
    this.startReserve = this.reserve;
    this.fireT = 0;
    this.reloading = false;
    this.reloadT = 0;
    this.spreadCur = this.spread;
    this.flashT = 0;
    this.pumpT = 0;
    this.racked = false;
    this.needPump = false;
    this.mat = makeInkMaterial({ ink: INK.BLUE });
    this.dark = makeInkMaterial({ ink: INK.BLACK });
    this.red = makeInkMaterial({ ink: INK.RED, fill: true });
    this.model = gunBuilders[type](this.root, { mat: this.mat, dark: this.dark, red: this.red });
    this.setSight(...this.sight);
  }
  get spreadPx() {
    return 5 + this.spreadCur * 900;
  }
  addAmmo(n) {
    this.reserve = Math.min(this.reserve + n, this.maxReserve);
  }
  resetAmmo() {
    this.mag = this.magSize;
    this.reserve = this.startReserve;
    this.reloading = false;
    this.pumpT = 0;
  }
  addAmmoFraction(fraction) {
    this.addAmmo(Math.round(this.maxReserve * fraction));
  }
  startReload() {
    if (this.reloading || this.mag >= this.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadT = 0;
    this.racked = false;
    if (this.reloadType === 'shells') this.ctx.audio.shell();
    else if (this.reloadType === 'cylinder') this.ctx.audio.cylinder();
    else this.ctx.audio.reload();
  }
  update(dt, st) {
    this.fireT -= dt;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.model.flash.visible = false;
    }
    // moving and flying bloom the shot; aiming down the sights steadies most of that, the scope nearly all of it
    const base = st.aim ? this.adsSpread : this.spread;
    let moveAdd =
      Math.min(st.speed, 24) * this.moveSpread +
      (st.grounded ? 0 : 0.01) +
      (st.sliding ? 0.008 : 0);
    if (st.aim) moveAdd *= this.scope ? 0.03 : 0.3;
    this.spreadCur = damp(this.spreadCur, base + moveAdd, 7, dt);
    const p = this.root.position,
      r = this.root.rotation;
    if (this.pumpT > 0) {
      this.pumpT -= dt;
      const t = 1 - this.pumpT / this.cycleDur;
      const s = Math.sin(Math.min(1, t * 1.15) * Math.PI);
      if (this.model.foreEnd) this.model.foreEnd.position.z = this.model.foreEndZ + s * 0.16;
      if (this.model.boltH) {
        this.model.boltH.position.z = this.model.boltZ + s * 0.2;
        this.model.boltH.rotation.z = -s * 1.1;
      }
      r.x += s * 0.12;
      r.z += s * 0.15;
      p.y -= s * 0.02;
      if (t > 0.45 && !this.pumped) {
        this.pumped = true;
        this.ctx.audio.pump();
        this._ejectShell();
        this.recoilRot.kick(-1.5, 0, 1);
      }
      if (this.pumpT <= 0) {
        this.pumped = false;
        this.needPump = false;
        if (this.model.foreEnd) this.model.foreEnd.position.z = this.model.foreEndZ;
        if (this.model.boltH) {
          this.model.boltH.position.z = this.model.boltZ;
          this.model.boltH.rotation.z = 0;
        }
      }
    }
    if (this.reloading) {
      this.reloadT += dt;
      if (this.reloadType === 'mag') {
        const t = this.reloadT / this.reloadDur;
        const tilt =
          Math.sin((clamp(t / 0.22, 0, 1) * Math.PI) / 2) *
          (t < 0.82 ? 1 : clamp(1 - (t - 0.82) / 0.18, 0, 1));
        r.x += -0.3 * tilt;
        r.z += 0.5 * tilt;
        r.y += 0.25 * tilt;
        p.y -= 0.07 * tilt;
        p.x += 0.03 * tilt;
        const mt = clamp((t - 0.18) / 0.5, 0, 1);
        this.model.magMesh.position.y = this.model.magY - Math.sin(mt * Math.PI) * 0.3;
        this.model.magMesh.rotation.z = Math.sin(mt * Math.PI) * 0.6;
        if (t > 0.86 && !this.racked) {
          this.racked = true;
          this.recoilRot.kick(-2.5, 0, 0);
          this.recoil.kick(0, 0, 0.6);
        }
        if (this.reloadT >= this.reloadDur) {
          const take = Math.min(this.magSize - this.mag, this.reserve);
          this.mag += take;
          this.reserve -= take;
          this.reloading = false;
        }
        return;
      }
      if (this.reloadType === 'cylinder') {
        const t = this.reloadT / this.reloadDur;
        const open = t < 0.25 ? easeOut(t / 0.25) : t > 0.8 ? 1 - easeOut((t - 0.8) / 0.2) : 1;
        r.z += 0.9 * open;
        r.x += 0.3 * open;
        p.x -= 0.05 * open;
        p.y += 0.02 * open;
        this.model.cylGroup.rotation.z = -1.5 * open;
        if (t > 0.3 && !this.racked) {
          this.racked = true;
          for (let i = 0; i < 6; i++) this._ejectShell(0.7);
          this.ctx.audio.shell();
        }
        if (this.reloadT >= this.reloadDur) {
          const take = Math.min(this.magSize - this.mag, this.reserve);
          this.mag += take;
          this.reserve -= take;
          this.reloading = false;
          this.model.cylGroup.rotation.z = 0;
        }
        return;
      }
      // shells: one at a time, can be interrupted by firing
      const s = Math.sin(Math.min(1, this.reloadT / this.reloadDur) * Math.PI);
      r.z += 0.35 * s;
      r.x += 0.15 * s;
      p.y -= 0.04 * s;
      if (this.model.handL)
        this.model.handL.position.set(
          this.model.handLPos.x + 0.1 * s,
          this.model.handLPos.y - 0.12 * s,
          this.model.handLPos.z + 0.55 * s,
        );
      if (this.reloadT >= this.reloadDur) {
        this.mag++;
        this.reserve--;
        this.reloadT = 0;
        if (this.mag >= this.magSize || this.reserve <= 0) {
          this.reloading = false;
          if (this.model.handL) this.model.handL.position.copy(this.model.handLPos);
          if (this.needPump) this.pumpT = this.cycleDur;
        } else this.ctx.audio.shell();
      }
    }
    if (
      st.reloadPressed &&
      this.mag < this.magSize &&
      this.reserve > 0 &&
      !this.reloading &&
      this.pumpT <= 0
    ) {
      this.startReload();
      return;
    }
    const wantFire = this.auto ? st.fire : st.firePressed;
    if (wantFire && this.fireT <= 0 && this.pumpT <= 0 && !st.blockFire) {
      if (this.mag <= 0) {
        if (st.firePressed) {
          this.ctx.audio.empty();
          this.startReload();
        }
      } else {
        if (this.reloading) {
          this.reloading = false;
          if (this.model.handL) this.model.handL.position.copy(this.model.handLPos);
        }
        this.fire(st);
      }
    }
  }
  fire(st) {
    const ctx = this.ctx,
      P = ctx.player;
    this.fireT = this.interval;
    this.mag--;
    const spreadNow = this.spreadCur;
    this.spreadCur = Math.min(this.spreadCur + this.spreadKick, this.spreadMax);
    let hits = 0;
    for (let i = 0; i < this.pellets; i++) if (this.fireRay(P.eye, P.aimDir(spreadNow))) hits++;
    // fx
    this.model.flash.visible = true;
    this.flashT = 0.045;
    this.model.flash.rotation.z = rand(0, TAU);
    this.model.flash.scale.setScalar(this.flashScale * rand(0.8, 1.4));
    this.model.muzzle.getWorldPosition(_v);
    _v2.copy(P.forward);
    ctx.effects.strokeBurst(_v, INK.ORANGE, 4 + this.pellets, 6 * this.flashScale, {
      life: 0.08,
      size: 0.03,
      gravity: 0,
      drag: 8,
    });
    ctx.effects.smoke(_v, _v2, this.kind === 'shotgun' ? 5 : 2);
    if (this.shell && this.reloadType !== 'shells') this._ejectShell();
    if (this.cycleDur) {
      this.pumpT = this.cycleDur + 0.12;
      this.pumped = false;
      if (this.reloadType === 'shells') this.needPump = true;
    }
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
    if (this.mag === 0 && this.reloadType === 'mag')
      setTimeout(() => {
        if (this.mag === 0 && !this.reloading) this.startReload();
      }, 250);
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
  _ejectShell(spread = 1) {
    if (!this.shell) return;
    const P = this.ctx.player;
    this.model.ejectPt.getWorldPosition(_v);
    _v2
      .copy(P.right)
      .multiplyScalar(rand(1.5, 2.5) * spread)
      .addScaledVector(P.forward, rand(-0.5, 0.5));
    _v2.y += rand(1.5, 2.8);
    this.ctx.effects.shell(_v, _v2, this.shell[1], this.shell[0]);
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
