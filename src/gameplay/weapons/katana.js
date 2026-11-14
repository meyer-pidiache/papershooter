import * as THREE from 'three';
import { INK } from '../../shared/ink.js';
import { rand, clamp, damp, lerp } from '../../engine/math.js';
import { ViewModel } from '../../presentation/viewmodel.js';
import { buildKatana } from '../../presentation/models/katana.js';
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3();
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export class Katana extends ViewModel {
  constructor(ctx) {
    super(ctx);
    this.name = 'KATANA';
    this.hint = 'slash · hold aim to block & return bullets';
    this.kind = 'katana';
    this.basePos.set(0.27, -0.25, -0.4);
    this.baseRot.set(0.75, 0.15, -0.35);
    this.aimPos.copy(this.basePos);
    this.slashT = 0;
    this.slashDur = 0.27;
    this.combo = 0;
    this.comboT = 0;
    this.blocking = false;
    this.blockT = 0;
    this.blockAmt = 0;
    this.hitDone = false;
    this.cooldown = 0;
    this.damage = 75;
    // guard pose: the sword simply comes in close to the face, held upright
    this.blockPos = new THREE.Vector3(0.21, -0.31, -0.36);
    this.blockRot = new THREE.Vector3(1.4, 0.3, 1.24);
    this.deflectKick = 0;
    this.parrySwing = 0;
    this.parryDir = 1;
    this.bloodLevel = 0;
    this.model = buildKatana(this.root);
  }

  get spreadPx() {
    return 4;
  }
  startSlash(st) {
    this.slashT = this.slashDur;
    this.hitDone = false;
    this.combo++;
    this.comboT = 0.9;
    this.cooldown = this.slashDur + 0.06;
    this.ctx.audio.katanaSwing();
    this.ctx.player.kickFov(2);
    if (st.sprinting || !st.grounded) this.ctx.player.lunge(5.5);
    const P = this.ctx.player,
      s = this.combo % 2 === 0 ? -1 : 1;
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
  update(dt, st) {
    this.cooldown -= dt;
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    this.deflectKick = Math.max(0, this.deflectKick - dt * 6);
    this.parrySwing = Math.max(0, this.parrySwing - dt * 4.5);
    this.updateBlood(dt, st);
    // guard is up only while the aim trigger is held and you are not swinging
    const wantBlock = st.aim && !st.fire && this.slashT <= 0 && this.cooldown <= 0;
    if (wantBlock && !this.blocking) this.blockT = 0;
    this.blocking = wantBlock;
    if (this.blocking) this.blockT += dt;
    this.blockAmt = damp(this.blockAmt, this.blocking ? 1 : 0, 16, dt);
    const p = this.root.position,
      r = this.root.rotation;
    // Blend the whole pose to an absolute target. Adding an offset instead does not work here:
    // the shared animator already scales the base rotation down by the aim amount, so the same
    // offset landed on a different rotation depending on how far into the guard you were.
    if (this.blockAmt > 0.001) {
      const t = this.blockAmt;
      p.lerp(this.blockPos, t);
      r.x = lerp(r.x, this.blockRot.x, t);
      r.y = lerp(r.y, this.blockRot.y, t);
      r.z = lerp(r.z, this.blockRot.z, t);
    }
    // a parry is a small flick of the wrist, nothing that throws the pose around
    if (this.parrySwing > 0) {
      const e = Math.sin(Math.min(1, this.parrySwing) * Math.PI);
      r.z += this.parryDir * e * 0.42;
      r.y += this.parryDir * e * 0.16;
      p.x += this.parryDir * e * 0.035;
    }
    if (this.slashT > 0) {
      this.slashT -= dt;
      const t = clamp(1 - this.slashT / this.slashDur, 0, 1);
      const e = easeInOut(t);
      const s = this.combo % 2 === 0 ? -1 : 1;
      r.z += s * (1.3 - 2.7 * e);
      r.x += 0.7 - 1.5 * e;
      r.y += s * (-0.35 + 0.8 * e);
      p.x += s * (0.2 - 0.45 * e);
      p.y += 0.14 - 0.24 * e;
      p.z -= 0.12 * Math.sin(t * Math.PI);
      if (!this.hitDone && t > 0.32) {
        this.hitDone = true;
        this.doHit(st, s);
      }
    } else if (
      (st.firePressed || (st.fire && this.combo > 0)) &&
      this.cooldown <= 0 &&
      !st.blockFire
    )
      this.startSlash(st);
    if (st.meleePressed && this.slashT <= 0 && this.cooldown <= 0) this.startSlash(st);
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
    this.parrySwing = 1;
    this.parryDir = -this.parryDir;
    this.recoilRot.kick(perfect ? -3.5 : -2, this.parryDir * 2, this.parryDir * 2.5);
    this.recoil.kick(this.parryDir * 0.15, 0.15, 1.2);
  }
  // The blade picks up ink as it kills and slowly sheds it again, so a good run shows on the steel.
  addBlood(amount) {
    this.bloodLevel = clamp(this.bloodLevel + amount, 0, 1);
  }
  updateBlood(dt, st) {
    this.bloodLevel = Math.max(0, this.bloodLevel - dt * 0.05);
    const lv = this.bloodLevel;
    for (let i = 0; i < this.model.smears.length; i++) {
      const sm = this.model.smears[i];
      const on = lv > sm.at;
      sm.mesh.visible = on;
      // grow along the blade and fill out in height as it soaks, never past the steel
      if (on) {
        const f = clamp((lv - sm.at) / 0.28, 0.2, 1);
        sm.mesh.scale.set(1, 0.35 + 0.65 * f, 0.4 + 0.6 * f);
      }
    }
  }
}
