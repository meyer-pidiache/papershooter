import { MeleeMechanics } from './melee-mechanics.js';
import { BladeAnimation } from '../../presentation/weapons/blade-animation.js';
import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand } from '../../engine/math.js';
import { ViewModel } from '../../presentation/viewmodel.js';
import { buildKatana } from '../../presentation/models/katana.js';
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();
export class Katana extends ViewModel {
  constructor(ctx) {
    super(ctx);
    this.name = 'KATANA';
    this.hint = 'slash · hold aim to block & return bullets';
    this.kind = 'katana';
    this.basePos.set(0.27, -0.25, -0.4);
    this.baseRot.set(0.75, 0.15, -0.35);
    this.aimPos.copy(this.basePos);
    this.mechanics = new MeleeMechanics();
    this.model = buildKatana(this.root);
    this.animation = new BladeAnimation(this.root, this.model, this.recoil, this.recoilRot);
  }

  get spreadPx() {
    return 4;
  }
  startSlash(st) {
    this.mechanics.startSlash();
    this.ctx.audio.katanaSwing();
    this.ctx.player.kickFov(2);
    if (st.sprinting || !st.grounded) this.ctx.player.lunge(5.5);
    const P = this.ctx.player,
      s = this.mechanics.direction;
    const up = _v2.set(0, 1, 0);
    for (let i = 0; i < 9; i++) {
      const a = (-1.1 + (2.2 * i) / 8) * s;
      const b = a + 0.12 * s;
      const pa = P.eye
        .clone()
        .addScaledVector(P.forward, 1.3)
        .addScaledVector(P.right, Math.cos(a) * 0.9 * s)
        .addScaledVector(up, Math.sin(a) * 0.55 - 0.1);
      const pb = P.eye
        .clone()
        .addScaledVector(P.forward, 1.3)
        .addScaledVector(P.right, Math.cos(b) * 0.9 * s)
        .addScaledVector(up, Math.sin(b) * 0.55 - 0.1);
      this.ctx.effects.tracer(pa, pb, INK.BLUE, 0.03 - 0.002 * i, 0.12 + i * 0.01);
    }
  }
  get blocking() {
    return this.mechanics.blocking;
  }
  get blockT() {
    return this.mechanics.blockTime;
  }
  get cooldown() {
    return this.mechanics.cooldown;
  }
  set cooldown(value) {
    this.mechanics.cooldown = value;
  }
  get damage() {
    return this.mechanics.damage;
  }
  get bloodLevel() {
    return this.animation.bloodLevel;
  }
  update(dt, frame) {
    this.mechanics.age(dt);
    this.animation.age(dt);
    this.mechanics.guard(dt, frame);
    this.animation.guard(dt, this.mechanics.blocking);
    const swing = this.mechanics.advanceSwing(dt);
    if (swing) {
      this.animation.swing(swing);
      if (swing.hit) this.doHit(frame, swing.direction);
    } else if (this.mechanics.wantsFire(frame)) this.startSlash(frame);
    if (this.mechanics.wantsMelee(frame)) this.startSlash(frame);
  }
  doHit(st, s) {
    const ctx = this.ctx,
      P = ctx.player;
    const hits = ctx.enemies.inArc(P.eye, P.forward, 3.0, Math.cos(0.95));
    _v2.copy(P.forward);
    _v.set(-P.forward.z, 0, P.forward.x).multiplyScalar(s * 0.7);
    _v2.add(_v).y -= 0.35;
    _v2.normalize();
    let any = false;
    for (const h of hits) {
      any = true;
      const point = h.enemy.center.clone();
      point.y += rand(-0.2, 0.4);
      ctx.enemies.damage(h.enemy, this.damage, {
        point,
        dir: _v2.clone(),
        part: 'torso',
        source: 'katana',
        crit: false,
        slashDir: s,
      });
    }
    if (ctx.playersInArc)
      for (const t of ctx.playersInArc(P.eye, P.forward, 3.0, Math.cos(0.95))) {
        any = true;
        ctx.hitPlayer(t, 55, {
          point: t.center.clone(),
          dir: _v2.clone(),
          part: 'torso',
          source: 'katana',
          crit: false,
        });
      }
    if (ctx.cutRopes && ctx.cutRopes(P.eye, P.forward, 3.4)) any = true;
    if (ctx.breakablesInArc)
      for (const br of ctx.breakablesInArc(P.eye, P.forward, 3.2, Math.cos(1.0))) {
        any = true;
        ctx.breakHit(br, this.damage, br.pos.clone(), _v2.clone());
      }
    // a swing only cuts; bullets are turned aside by the raised guard, never by a slash
    if (any) {
      this.ctx.audio.katanaHit();
      ctx.game.hitstop(0.07, 0.12);
      ctx.effects.shakeAmt += 0.12;
      ctx.input.rumble(0.7, 0.4, 90);
      this.recoil.kick(0, 0, 1.5);
    }
  }
  onDeflect(perfect) {
    this.animation.onDeflect(perfect);
  }
  addBlood(amount) {
    this.animation.addBlood(amount);
  }
  updateBlood(dt) {
    this.animation.updateBlood(dt);
  }
}
