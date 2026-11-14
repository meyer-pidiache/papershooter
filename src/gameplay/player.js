// Compose player state owners, preserve phase order and expose the actor command surface.
import { PlayerCombat } from './player/combat-state.js';
import {
  makeCombatFeedback,
  makeGrenadeFeedback,
  makeGrappleFeedback,
  makeMovementFeedback,
} from './player/feedback.js';
import { Equipment } from './player/equipment.js';
import { FirstPersonView } from '../presentation/first-person.js';
import { Locomotion } from './player/locomotion.js';
import { Grapple } from './player/grapple.js';
import { GrappleVisuals } from '../presentation/grapple.js';
import { Grenades } from './player/grenades.js';
import { GrenadeVisuals } from '../presentation/grenades.js';
import * as THREE from 'three';
import { makeBody } from '../engine/physics.js';
import { Rifle, Shotgun, Sniper, Katana } from './weapons.js';
import { clamp } from '../engine/math.js';

const STAND_H = 1.75;

export class Player {
  constructor(ctx) {
    this.ctx = ctx;
    this.camera = ctx.camera;
    this.body = makeBody(ctx.level.playerStart, 0.35, STAND_H, 0.55);
    this.view = new FirstPersonView(
      this.camera,
      this.body,
      (dt) => ctx.effects.sampleShake(dt),
      (gain) => ctx.audio.footstep(gain),
    );
    this.eye = this.view.eye;
    this.center = this.view.center;
    this.forward = this.view.forward;
    this.right = this.view.right;
    this.viewFrame = {
      alive: true,
      crouching: false,
      sliding: false,
      strafe: 0,
      sprinting: false,
      aiming: false,
      adsFov: 60,
      grappling: false,
    };
    this.rig = new THREE.Group();
    this.camera.add(this.rig);
    ctx.scene.add(this.camera);
    const weapons = [new Rifle(ctx), new Shotgun(ctx), new Sniper(ctx), new Katana(ctx)];
    for (const weapon of weapons) this.rig.add(weapon.root);
    this.equipment = new Equipment(weapons, {
      selected: (weapon, silent) => {
        if (!silent) ctx.audio.switchWeapon();
        ctx.hud.setWeapon(weapon.name, weapon.hint);
        ctx.hud.setCrosshairMode(weapon.kind === 'katana' ? 'katana' : '');
      },
      sights: (ads, scope) => {
        ctx.hud.setAds(ads);
        ctx.hud.setScope(scope);
      },
    });
    this.equipmentPose = {
      aiming: false,
      sprinting: false,
      grounded: false,
      speed: 0,
      sliding: false,
      lookDelta: ctx.input.look,
      strafe: 0,
      bobPhase: 0,
      bobAmt: 0,
      landDip: 0,
      alive: true,
    };

    this.isLocal = true;
    this.team = 0;
    this.name = 'you';
    this.grenadePose = {
      eye: this.eye,
      right: this.right,
      forward: this.forward,
      velocity: this.body.vel,
    };
    const feedback = {
      audio: ctx.audio,
      input: ctx.input,
      hud: ctx.hud,
      effects: ctx.effects,
      score: (points, label) => ctx.game.addScore(points, label),
      hitstop: (duration, scale) => ctx.game.hitstop(duration, scale),
    };
    const weaponFeedback = () => this.weapon;
    this.grenadeSystem = new Grenades(
      ctx.world,
      new GrenadeVisuals(ctx.scene, ctx.world, ctx.resources),
      makeGrenadeFeedback(feedback, weaponFeedback),
    );
    this.grappleSystem = new Grapple(
      this.body,
      { eye: this.eye, center: this.center, forward: this.forward, right: this.right },
      {
        world: ctx.world,
        queries: {
          raycastEnemy: (origin, direction, distance) =>
            ctx.enemies.raycast(origin, direction, distance),
          enemies: () => ctx.enemies.enemies,
          landmarks: () => ctx.level,
          yank: (enemy, toward) => ctx.enemies.yank(enemy, toward),
        },
        view: new GrappleVisuals(ctx.scene),
        feedback: makeGrappleFeedback(feedback, this.view, weaponFeedback),
      },
    );
    this.locomotion = new Locomotion(
      this.body,
      { center: this.center, right: this.right },
      { world: ctx.world, spawnPoint: () => ctx.level.playerStart },
      this.grappleSystem,
      makeMovementFeedback(feedback, { center: this.center, right: this.right }, this.view, () => {
        this.takeDamage(20, null);
        if (this.onFall) this.onFall();
      }),
    );
    this.combat = new PlayerCombat(
      this.body,
      { eye: this.eye, center: this.center, forward: this.forward, right: this.right },
      () => this.weapon,
      makeCombatFeedback(
        feedback,
        { eye: this.eye, center: this.center, forward: this.forward, right: this.right },
        this.view,
        () => this.weapon,
        () => {
          this.detachGrapple(false);
          ctx.game.onPlayerDeath();
        },
      ),
    );
  }
  reset(pos) {
    this.grenadeSystem.cancelCharge();
    const b = this.body;
    b.pos.copy(pos);
    b.vel.set(0, 0, 0);
    b.onGround = false;
    b.height = STAND_H;
    this.combat.reset();
    this.view.reset();
    this.locomotion.reset();
    this.grappleSystem.reset();
    this.equipment.reset();
    this.rig.visible = true;
    this.grenadeSystem.reset();
  }

  get hp() {
    return this.combat.hp;
  }
  set hp(value) {
    this.combat.hp = value;
  }
  get maxHp() {
    return this.combat.maxHp;
  }
  set maxHp(value) {
    this.combat.maxHp = value;
  }
  get alive() {
    return this.combat.alive;
  }
  get regenDelay() {
    return this.combat.regenDelay;
  }
  set regenDelay(value) {
    this.combat.regenDelay = value;
  }
  get regenRate() {
    return this.combat.regenRate;
  }
  set regenRate(value) {
    this.combat.regenRate = value;
  }
  get isBlocking() {
    return this.combat.blocking;
  }
  get blockRadius() {
    return this.combat.blockRadius;
  }
  get parryWindow() {
    return this.combat.parryWindow;
  }
  takeDamage(amount, from = null) {
    this.combat.takeDamage(amount, from);
  }
  knockback(direction, amount) {
    this.combat.knockback(direction, amount);
  }
  tryDeflect(projectile) {
    return this.combat.tryDeflect(projectile);
  }
  tryBlockMelee(enemy) {
    return this.combat.tryBlockMelee(enemy);
  }
  die() {
    this.combat.die();
  }
  get yaw() {
    return this.view.yaw;
  }
  set yaw(value) {
    this.view.yaw = value;
  }
  get pitch() {
    return this.view.pitch;
  }
  set pitch(value) {
    this.view.pitch = value;
  }
  get speed() {
    return this.view.speed;
  }
  get hurtFx() {
    return this.view.hurtFx;
  }
  get flashFx() {
    return this.view.flashFx;
  }
  recoil(p, y) {
    this.view.recoil(p, y);
  }
  kickFov(value) {
    this.view.kickFov(value);
  }
  idleCam(time) {
    this.view.idle(time);
    this.rig.visible = false;
  }
  _updateCamera(dt) {
    const frame = this.viewFrame;
    frame.alive = this.alive;
    frame.crouching = this.crouching;
    frame.sliding = this.sliding;
    frame.strafe = this._mv.x;
    frame.sprinting = this._sprinting;
    frame.aiming = this._aiming;
    frame.adsFov = this.weapon.adsFov;
    frame.grappling = this.grapple.state === 'on';
    this.view.update(dt, frame);
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

  aimDir(spread = 0) {
    return this.view.aimDir(spread);
  }
  lunge(speed) {
    this.locomotion.lunge(speed, this.forward);
  }
  get weapons() {
    return this.equipment.weapons;
  }
  get weapon() {
    return this.equipment.current;
  }
  get weaponIndex() {
    return this.equipment.index;
  }
  get katanaIndex() {
    return this.equipment.meleeIndex;
  }
  get firing() {
    return this.equipment.firing;
  }
  switchTo(index, silent = false) {
    this.equipment.switchTo(index, silent);
  }
  addAmmoAll(fraction = 0.5) {
    this.equipment.addAmmo(fraction);
  }

  update(dt) {
    this.combat.age(dt);
    if (!this.alive) {
      this._updateDead(dt);
      return;
    }
    this.rig.visible = true;
    if (this._updateLook(dt)) return;
    const motion = this.locomotion.read(dt, this.ctx.input, this.yaw, !!this.weapon.isGun);
    this.combat.coolBlock(dt);
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
    this.view.sink(dt);
    this.locomotion.fall(dt);
    this.view.updateDirections();
    this.grenadeSystem.update(dt);
    this._updateCamera(dt);
    this.weapon.animate(dt, this._weaponState(false, false, 0));
    return;
  }

  _updateLook(dt) {
    this.view.look(this.ctx.input.look, this._aiming, !!this.weapon.scope);
    if (this.locomotion.freezeIfLocked()) {
      this._updateCamera(dt);
      this.weapon.animate(dt, this._weaponState(false, false, 0));
      return true;
    }
    return false;
  }
  _recoverMovement(dt, sprinting) {
    const b = this.body;

    this.combat.recover(dt, this._sprinting, this.grapple.state === 'idle');
    // the grapple runs on breath: hanging drains it, feet on the ground bring it back fast
    this.grappleSystem.recover(dt);
    const hs2 = Math.hypot(b.vel.x, b.vel.z);
    this.view.updateStride(dt, sprinting, this.sliding);
    this._updateCamera(dt);

    return hs2;
  }

  _updateWeaponInput(dt, sprinting, aiming, speed) {
    this.equipment.update(dt, this.ctx.input, this._equipmentState(sprinting, aiming, speed));
  }
  _weaponState(sprinting, aiming, speed) {
    return this.equipment.frame(this.ctx.input, this._equipmentState(sprinting, aiming, speed));
  }
  _equipmentState(sprinting, aiming, speed) {
    const state = this.equipmentPose;
    state.aiming = aiming;
    state.sprinting = sprinting;
    state.grounded = this.body.onGround;
    state.speed = speed;
    state.sliding = this.sliding;
    state.lookDelta = this.ctx.input.look;
    state.strafe = this._mv.x;
    state.bobPhase = this.view.bobPhase;
    state.bobAmt = this.view.bobAmt;
    state.landDip = clamp(-this.view.landDipValue * 0.08, -0.5, 0.5);
    state.alive = this.alive;
    return state;
  }
}
