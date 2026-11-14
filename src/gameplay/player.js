import { Locomotion } from './player/locomotion.js';
import { Grapple } from './player/grapple.js';
import { GrappleVisuals } from '../presentation/grapple.js';
import { Grenades } from './player/grenades.js';
import { GrenadeVisuals } from '../presentation/grenades.js';
// First-person player: movement (sprint/slide/wall-jump/mantle/air dash), swing-grapple, camera feel, health, weapons.
import * as THREE from 'three';
import { makeBody } from '../engine/physics.js';
import { INK } from '../shared/ink.js';
import { Rifle, Shotgun, Sniper, Katana } from './weapons.js';
const PARRY_WINDOW = 0.55;
import { clamp, damp, rand, Spring } from '../engine/math.js';

const G = 26;
const STAND_H = 1.75,
  EYE_STAND = 1.6,
  EYE_CROUCH = 0.88;
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();

export class Player {
  constructor(ctx) {
    this.ctx = ctx;
    this.camera = ctx.camera;
    this.camera.rotation.order = 'YXZ';
    this.body = makeBody(ctx.level.playerStart, 0.35, STAND_H, 0.55);
    this.yaw = 0;
    this.pitch = 0;
    this.maxHp = 120;
    this.hp = 120;
    this.alive = true;
    this.regenDelay = 4.5;
    this.regenRate = 11;
    this.blockHeld = 0;
    this.eye = new THREE.Vector3();
    this.center = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.speed = 0;
    this.hurtFx = 0;
    this.flashFx = 0;
    this.lastDamageT = 10;
    this.rig = new THREE.Group();
    this.camera.add(this.rig);
    ctx.scene.add(this.camera);
    this.weapons = [new Rifle(ctx), new Shotgun(ctx), new Sniper(ctx), new Katana(ctx)];
    this.katanaIndex = 3;
    for (const w of this.weapons) {
      this.rig.add(w.root);
      if (w.isGun) w.startReserve = w.reserve;
    }
    this.weaponIndex = 0;
    this.weapon = this.weapons[0];
    this.weapon.equip();
    this.returnT = 0;
    this.prevWeaponIndex = 0;
    this.recoilPitch = new Spring(190, 17);
    this.recoilYaw = new Spring(190, 17);
    this.fovKick = new Spring(220, 14);
    this.landDip = new Spring(170, 15);
    this.roll = 0;
    this.fov = 82;
    this.bobPhase = 0;
    this.bobAmt = 0;
    this.stepDist = 0;
    this.eyeH = EYE_STAND;
    this.blockCd = 0;

    this.deathT = 0;
    this.isLocal = true;
    this.team = 0;
    this.name = 'you';
    this.firing = false;
    this.grenadePose = {
      eye: this.eye,
      right: this.right,
      forward: this.forward,
      velocity: this.body.vel,
    };
    this.grenadeSystem = new Grenades(
      ctx.world,
      new GrenadeVisuals(ctx.scene, ctx.world, ctx.resources),
      {
        thrown: () => {
          this.weapon.recoil.kick(-0.4, 0.5, 1.2);
          this.weapon.recoilRot.kick(-3, 0, -1.5);
          ctx.audio.grappleFire();
          ctx.input.rumble(0.2, 0.4, 50);
        },
        bounce: () => ctx.audio.shell(),
        fuse: (position) =>
          ctx.effects.strokeBurst(position.clone().add(_v.set(0, 0.22, 0)), INK.ORANGE, 2, 2.5, {
            life: 0.12,
            size: 0.02,
          }),
      },
    );
    this.grappleSystem = new Grapple(
      this.body,
      { eye: this.eye, center: this.center, forward: this.forward, right: this.right },
      ctx.world,
      {
        raycastEnemy: (origin, direction, distance) =>
          ctx.enemies.raycast(origin, direction, distance),
        enemies: () => ctx.enemies.enemies,
        landmarks: () => ctx.level,
        yank: (enemy, toward) => ctx.enemies.yank(enemy, toward),
      },
      new GrappleVisuals(ctx.scene),
      {
        target: (mode) => ctx.hud.grappleTarget(mode),
        outOfBreath: () => {
          ctx.audio.winded();
          ctx.hud.tip('grapple needs a breather', 0.9);
        },
        missed: () => ctx.audio.empty(),
        fired: () => {
          ctx.audio.grappleFire();
          ctx.input.rumble(0.15, 0.4, 40);
          this.weapon.recoil.kick(-0.3, 0.2, 0.5);
        },
        yanked: () => {
          ctx.game.addScore(30, 'YANKED');
          ctx.audio.grappleHit();
          ctx.input.rumble(0.5, 0.5, 90);
        },
        attached: () => {
          ctx.audio.grappleHit();
          ctx.audio.reelLoop(true);
          ctx.hud.grappleTarget(2);
          ctx.input.rumble(0.3, 0.6, 60);
        },
        stopped: () => {
          ctx.audio.reelLoop(false);
          ctx.hud.grappleTarget(0);
        },
        released: (boost) => {
          if (boost) {
            ctx.audio.jump();
            this.kickFov(3);
          } else ctx.audio.grappleRelease();
        },
        exhausted: () => ctx.hud.tip('out of breath · land to recover', 1.4),
      },
    );
    this.locomotion = new Locomotion(
      this.body,
      { center: this.center, right: this.right },
      { world: ctx.world, spawnPoint: () => ctx.level.playerStart },
      this.grappleSystem,
      {
        jump: () => {
          ctx.audio.jump();
          this.landDip.kick(-1.2);
        },
        wallJump: (roll) => {
          ctx.audio.wallJump();
          this.roll += roll;
          this.kickFov(2);
          this.landDip.kick(-1.5);
        },
        airJump: () => {
          ctx.audio.jump();
          this.kickFov(1.6);
          this.landDip.kick(-1.4);
          _v2.copy(this.center);
          _v2.y -= 0.7;
          ctx.effects.strokeBurst(_v2, INK.BLUE, 9, 4.5, { life: 0.28, size: 0.028, gravity: -2 });
        },
        slide: () => {
          ctx.audio.slide();
          this.kickFov(2.5);
          this.landDip.kick(-2.5);
        },
        dash: (direction) => {
          ctx.audio.dash();
          this.kickFov(4);
          ctx.input.rumble(0.3, 0.6, 70);
          this.roll += (direction.x * this.right.x + direction.z * this.right.z) * 0.08;
          _v2.copy(this.center).addScaledVector(direction, -0.6);
          ctx.effects.strokeBurst(_v2, INK.BLUE, 10, 5, { life: 0.25, size: 0.03 });
        },
        mantle: () => {
          ctx.audio.mantle();
          this.landDip.kick(-2.5);
          this.kickFov(1.5);
        },
        land: (impact) => {
          this.landDip.kick(-impact * 6 - 0.5);
          ctx.audio.land(impact);
          if (impact > 0.8) {
            ctx.effects.shakeAmt += impact * 0.15;
            ctx.input.rumble(impact * 0.4, 0.2, 80);
          }
        },
        fell: () => {
          this.takeDamage(20, null);
          if (this.onFall) this.onFall();
          ctx.hud.message('OFF THE PAGE', 'redrawn at the start', 1.8);
        },
      },
    );
  }
  reset(pos) {
    this.grenadeSystem.cancelCharge();
    this.blockHeld = 0;
    const b = this.body;
    b.pos.copy(pos);
    b.vel.set(0, 0, 0);
    b.onGround = false;
    b.height = STAND_H;
    this.hp = this.maxHp;
    this.alive = true;
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.hurtFx = 0;
    this.flashFx = 0;
    this.deathT = 0;
    this.lastDamageT = 10;
    this.locomotion.reset();
    this.grappleSystem.reset();
    for (const w of this.weapons)
      if (w.isGun) {
        w.mag = w.magSize;
        w.reserve = w.startReserve;
        w.reloading = false;
        w.pumpT = 0;
      }
    this.switchTo(0, true);
    this.rig.visible = true;
    this.eyeH = EYE_STAND;
    this.grenadeSystem.reset();
  }

  get crouching() {
    return this.locomotion.crouching;
  }
  set crouching(value) {
    this.locomotion.crouching = value;
  }
  get sliding() {
    return this.locomotion.sliding;
  }
  get airJumps() {
    return this.locomotion.jumps.airJumps;
  }
  get gravityScale() {
    return this.locomotion.gravityScale;
  }
  set gravityScale(value) {
    this.locomotion.gravityScale = value;
  }
  get dashLock() {
    return this.locomotion.dashLock;
  }
  set dashLock(value) {
    this.locomotion.dashLock = value;
  }
  get _aiming() {
    return this.locomotion.aiming;
  }
  get _sprinting() {
    return this.locomotion.sprinting;
  }
  get _mv() {
    return this.locomotion.frame.mv;
  }
  get grapple() {
    return this.grappleSystem.state;
  }
  get grapStam() {
    return this.grappleSystem.stamina;
  }
  detachGrapple(boost) {
    this.grappleSystem.detach(boost);
  }
  get grenades() {
    return this.grenadeSystem.stock;
  }
  set grenades(value) {
    this.grenadeSystem.stock = value;
  }
  get maxGrenades() {
    return this.grenadeSystem.maximum;
  }
  get nades() {
    return this.grenadeSystem.projectiles;
  }
  get onThrow() {
    return this.grenadeSystem.onThrow;
  }
  set onThrow(handler) {
    this.grenadeSystem.onThrow = handler;
  }
  clearNades() {
    this.grenadeSystem.clear();
  }
  throwGrenade(remote = null, charge = 0) {
    this.grenadeSystem.throw(remote, charge, this.grenadePose);
  }
  updateNades(dt) {
    this.grenadeSystem.update(dt);
  }
  get isBlocking() {
    return this.weapon.kind === 'katana' && this.weapon.blocking;
  }
  aimDir(spread = 0) {
    const d = this.forward.clone();
    if (spread > 0) {
      d.addScaledVector(this.right, rand(-spread, spread));
      d.y += rand(-spread, spread);
      d.normalize();
    }
    return d;
  }
  recoil(p, y) {
    this.pitch = clamp(this.pitch + p * 0.55, -1.5, 1.5);
    this.recoilPitch.kick(p * 22);
    this.recoilYaw.kick(y * 30);
  }
  kickFov(v) {
    this.fovKick.kick(v * 30);
  }
  lunge(speed) {
    const d = this.forward.clone();
    d.y = clamp(d.y, -0.2, 0.5);
    d.normalize();
    const b = this.body;
    b.vel.addScaledVector(d, speed);
    if (b.onGround) {
      b.vel.y = Math.max(b.vel.y, 2.5);
      b.onGround = false;
    }
    this.ctx.audio.dash();
    this.kickFov(3);
  }
  switchTo(i, silent = false) {
    if (i < 0 || i >= this.weapons.length) return;
    if (i === this.weaponIndex && !silent) return;
    if (this.weapon.kind !== 'katana') this.prevWeaponIndex = this.weaponIndex;
    this.weapon.unequip();
    this.weaponIndex = i;
    this.weapon = this.weapons[i];
    this.weapon.equip();
    if (!silent) this.ctx.audio.switchWeapon();
    this.ctx.hud.setWeapon(this.weapon.name, this.weapon.hint);
    this.ctx.hud.setCrosshairMode(this.weapon.kind === 'katana' ? 'katana' : '');
  }
  addAmmoAll(frac = 0.5) {
    for (const w of this.weapons) if (w.isGun) w.addAmmo(Math.round(w.maxReserve * frac));
  }
  takeDamage(amount, fromPos) {
    if (!this.alive) return;
    this.hp -= amount;
    this.lastDamageT = 0;
    this.hurtFx = Math.min(1, this.hurtFx + amount / 40);
    this.ctx.effects.shakeAmt += 0.2 + amount / 80;
    this.ctx.audio.hurt();
    this.ctx.input.rumble(0.8, 0.5, 160);
    if (fromPos) {
      _v.subVectors(fromPos, this.eye);
      const x = _v.dot(this.right),
        f = _v.dot(this.forward);
      this.ctx.hud.damageFrom(Math.atan2(x, f));
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }
  knockback(dir, amount) {
    const b = this.body;
    b.vel.addScaledVector(dir, amount);
    b.vel.y += amount * 0.5;
    b.onGround = false;
  }
  // The guard only covers what is right in front of the blade: a modest reach and a narrow
  // cone, so shots from your flank still land and holding block is not a free win.
  get blockRadius() {
    return this.isBlocking && this.blockCd <= 0 ? 0.95 : 0;
  }
  tryDeflect(proj) {
    if (!this.alive || !this.isBlocking || this.blockCd > 0) return false;
    // block only what is flying in at you from the front; flank and back shots get through
    _v.copy(proj.vel).normalize().negate();
    if (_v.dot(this.forward) < 0.55) return false;
    const perfect = this.weapon.blockT < 0.26;
    const ctx = this.ctx;
    // only a well timed guard sends it back; otherwise the round is simply knocked out of the air
    const ret = perfect || Math.random() < 0.35;
    this.blockCd = 0.19; // the blade has to come back before the next parry
    this.weapon.onDeflect(perfect);
    if (perfect) this.ctx.audio.perfectParry();
    else this.ctx.audio.parry();
    ctx.effects.sparks(
      proj.pos,
      _v2.copy(proj.vel).normalize().negate(),
      INK.ORANGE,
      perfect ? 14 : 8,
      10,
    );
    ctx.effects.strokeBurst(proj.pos, INK.BLUE, perfect ? 8 : 5, 4.5, { life: 0.2, size: 0.028 });
    ctx.input.rumble(0.4, 0.6, 70);
    ctx.game.hitstop(perfect ? 0.07 : 0.025, 0.18);
    ctx.effects.shakeAmt += 0.06;
    this.flashFx = perfect ? 0.35 : 0.1;
    ctx.game.addScore(perfect ? 60 : 15, perfect ? 'PERFECT PARRY' : 'BLOCKED');
    return { perfect, ret };
  }
  get parryWindow() {
    return this.isBlocking && this.blockHeld < PARRY_WINDOW;
  }
  tryBlockMelee(e) {
    if (!this.alive || !this.parryWindow || this.blockCd > 0) return false;
    _v.subVectors(e.center, this.eye).normalize();
    if (_v.dot(this.forward) < 0.35) return false;
    this.weapon.onDeflect(true);
    this.ctx.audio.parry();
    this.ctx.game.hitstop(0.06, 0.15);
    this.ctx.effects.sparks(
      _v2.copy(this.eye).addScaledVector(this.forward, 0.8),
      this.forward.clone().negate(),
      INK.ORANGE,
      12,
      8,
    );
    this.ctx.game.addScore(40, 'BLOCKED');
    this.ctx.input.rumble(0.6, 0.6, 100);
    return true;
  }
  die() {
    this.alive = false;
    this.deathT = 0;
    this.ctx.audio.death();
    this.detachGrapple(false);
    this.ctx.game.onPlayerDeath();
  }
  idleCam(t) {
    const c = this.camera;
    c.position.set(Math.sin(t * 0.08) * 70, 30 + Math.sin(t * 0.23) * 4, Math.cos(t * 0.08) * 70);
    c.lookAt(0, 10, 0);
    this.rig.visible = false;
    this.eye.copy(c.position);
    this.center.copy(c.position);
    c.getWorldDirection(this.forward);
    this.right.set(this.forward.z, 0, -this.forward.x).normalize();
    if (Math.abs(c.fov - 70) > 0.01) {
      c.fov = 70;
      c.updateProjectionMatrix();
    }
  }

  update(dt) {
    this.lastDamageT += dt;
    if (!this.alive) {
      this._updateDead(dt);
      return;
    }
    this.rig.visible = true;
    if (this._updateLook(dt)) return;
    const motion = this.locomotion.read(dt, this.ctx.input, this.yaw, !!this.weapon.isGun);
    this.blockCd -= dt;
    this.locomotion.accelerate(dt, motion);
    this.locomotion.jump(dt, this.ctx.input, motion);
    this.locomotion.integrate(dt, this.ctx.input, motion);
    const speed = this._recoverMovement(dt, motion.sprinting);
    this.grenadeSystem.updateInput(
      dt,
      this.ctx.input.down('grenade'),
      this.alive,
      this.dashLock,
      this.grenadePose,
    );
    this._updateWeaponInput(dt, motion.sprinting, motion.aiming, speed);
  }

  _updateDead(dt) {
    const ctx = this.ctx,
      b = this.body;

    this.deathT += dt;
    this.eyeH = damp(this.eyeH, 0.35, 3, dt);
    this.roll = damp(this.roll, 0.9, 3, dt);
    this.pitch = damp(this.pitch, -0.35, 3, dt);
    b.vel.x = damp(b.vel.x, 0, 4, dt);
    b.vel.z = damp(b.vel.z, 0, 4, dt);
    b.vel.y -= G * dt;
    ctx.world.moveBody(b, dt);
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.grenadeSystem.update(dt);
    this._updateCamera(dt);
    this.weapon.animate(dt, this._weaponState(false, false, 0));
    return;
  }

  _updateLook(dt) {
    const inp = this.ctx.input;

    const lookMul = this._aiming ? (this.weapon.scope ? 0.38 : 0.62) : 1;
    this.yaw += inp.look.x * lookMul;
    this.pitch = clamp(this.pitch + inp.look.y * lookMul, -1.5, 1.5);
    this.forward.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (this.locomotion.freezeIfLocked()) {
      this._updateCamera(dt);
      this.weapon.animate(dt, this._weaponState(false, false, 0));
      return true;
    }

    return false;
  }

  _recoverMovement(dt, sprinting) {
    const b = this.body;

    if (
      this.lastDamageT > this.regenDelay &&
      this.hp < this.maxHp &&
      !this._sprinting &&
      this.grapple.state === 'idle'
    )
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    this.blockHeld = this.isBlocking ? this.blockHeld + dt : 0;
    // the grapple runs on breath: hanging drains it, feet on the ground bring it back fast
    this.grappleSystem.recover(dt);
    const hs2 = Math.hypot(b.vel.x, b.vel.z);
    const moving = b.onGround && hs2 > 0.6 && !this.sliding;
    this.bobAmt = damp(this.bobAmt, moving ? clamp(hs2 / 7, 0.3, 1.4) : 0, 8, dt);
    if (moving) {
      this.bobPhase += dt * (7 + hs2 * 0.5);
      this.stepDist += hs2 * dt;
      if (this.stepDist > (sprinting ? 2.5 : 2.0)) {
        this.stepDist = 0;
        this.ctx.audio.footstep(clamp(hs2 / 8, 0.3, 1));
      }
    }
    this._updateCamera(dt);

    return hs2;
  }

  _updateWeaponInput(dt, sprinting, aiming, hs2) {
    const ctx = this.ctx,
      inp = ctx.input;

    for (let i = 0; i < 5; i++)
      if (inp.pressed('slot' + (i + 1))) this.switchTo(Math.min(i, this.weapons.length - 1));
    if (inp.pressed('nextWeapon')) this.switchTo((this.weaponIndex + 1) % this.weapons.length);
    if (inp.pressed('prevWeapon'))
      this.switchTo((this.weaponIndex + this.weapons.length - 1) % this.weapons.length);
    const st = this._weaponState(sprinting, aiming, hs2);
    if (inp.pressed('melee') && this.weapon.kind !== 'katana') {
      this.switchTo(this.katanaIndex);
      this.returnT = 0.85;
      this.weapons[this.katanaIndex].startSlash(st);
      st.meleePressed = false;
    }
    if (this.returnT > 0) {
      if (this.weapon.kind === 'katana' && (st.firePressed || st.aim || st.meleePressed))
        this.returnT = 0;
      else {
        this.returnT -= dt;
        if (this.returnT <= 0) this.switchTo(this.prevWeaponIndex);
      }
    }
    this.firing = st.fire && this.weapon.isGun;
    this.weapon.animate(dt, st);
    ctx.hud.setAds(this.weapon.isGun && this.weapon.aimAmt > 0.55);
    ctx.hud.setScope(!!this.weapon.scope && this.weapon.aimAmt > 0.62);
  }

  _weaponState(sprinting, aiming, hs) {
    const inp = this.ctx.input,
      b = this.body;
    return {
      fire: inp.down('fire'),
      firePressed: inp.pressed('fire'),
      aim: aiming || (inp.down('aim') && this.weapon.kind === 'katana'),
      reloadPressed: inp.pressed('reload'),
      meleePressed: inp.pressed('melee') && this.weapon.kind === 'katana',
      sprinting,
      grounded: b.onGround,
      speed: hs,
      sliding: this.sliding,
      lookDelta: inp.look,
      strafe: this._mv.x,
      bobPhase: this.bobPhase,
      bobAmt: this.bobAmt,
      landDip: clamp(-this.landDip.value * 0.08, -0.5, 0.5),
      slideTilt: this.sliding ? 1 : 0,
      blockFire: !this.alive,
    };
  }

  _updateCamera(dt) {
    const b = this.body,
      cam = this.camera,
      mv = this._mv;
    const targetEye = this.crouching ? EYE_CROUCH : EYE_STAND;
    this.eyeH = this.alive ? damp(this.eyeH, targetEye, 14, dt) : this.eyeH;
    this.recoilPitch.update(dt);
    this.recoilYaw.update(dt);
    this.fovKick.update(dt);
    this.landDip.update(dt);
    if (this.alive) this.roll = damp(this.roll, -mv.x * 0.022 + (this.sliding ? -0.08 : 0), 9, dt);
    const sh = this.ctx.effects.shakeAmt;
    this.ctx.effects.shakeAmt = damp(sh, 0, 7, dt);
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
      (this._sprinting ? 3 : 0) +
      (this.sliding ? 4 : 0) +
      (this.grapple.state === 'on' ? 3 : 0) +
      this.fovKick.value;
    if (this._aiming) fov = this.weapon.adsFov;
    this.fov = damp(this.fov, fov, this._aiming ? 16 : 8, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    this.hurtFx = damp(this.hurtFx, 0, 3, dt);
    this.flashFx = damp(this.flashFx, 0, 10, dt);
    this.speed = sp3;
  }
}
