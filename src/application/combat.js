import * as THREE from 'three';
import { INK } from '../presentation/renderer.js';
import { rand, clamp } from '../engine/math.js';

export function createCombat(runtime, actions = {}) {
  const audio = runtime.audio;
  const {
    ctx,
    player,
    remote,
    online,
    world,
    effects,
    hud,
    input,
    net,
    game,
    R,
    inMatch,
    shotQueue,
  } = runtime;
  const { spawnPickup } = actions;
  // anything a bullet or a blade can hit besides enemies
  ctx.targets = () => [player, ...remote.values()];
  ctx.canHurt = (t) => online() && t !== player;
  ctx.raycastPlayers = (o, d, maxDist) => {
    let best = null;
    for (const t of remote.values()) {
      if (!t.alive || !ctx.canHurt(t)) continue;
      for (let i = 0; i < t.hit.length; i++) {
        const c = t.hitSpheres[i],
          r = t.hit[i][1];
        _v.subVectors(c, o);
        const tca = _v.dot(d);
        if (tca < 0 || tca > maxDist) continue;
        const d2 = _v.lengthSq() - tca * tca;
        if (d2 > r * r) continue;
        const tt = tca - Math.sqrt(r * r - d2);
        if (tt < 0) continue;
        if (!best || tt < best.dist)
          best = {
            player: t,
            part: t.hit[i][0],
            dist: tt,
            point: new THREE.Vector3(o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt),
          };
      }
      // a raised katana sits in front of the chest: a ray that reaches it before the body is turned aside
      if (t.blocking) {
        _bc.set(t.center.x + t.forward.x * 0.5, t.center.y + 0.3, t.center.z + t.forward.z * 0.5);
        const r = 0.42;
        _v.subVectors(_bc, o);
        const tca = _v.dot(d);
        if (tca > 0 && tca <= maxDist) {
          const d2 = _v.lengthSq() - tca * tca;
          if (d2 <= r * r) {
            const tt = tca - Math.sqrt(r * r - d2);
            if (tt >= 0 && (!best || best.player !== t || tt < best.dist))
              best = {
                player: t,
                part: 'blade',
                dist: tt,
                point: new THREE.Vector3(o.x + d.x * tt, o.y + d.y * tt, o.z + d.z * tt),
              };
          }
        }
      }
    }
    return best;
  };
  const _bc = new THREE.Vector3();
  ctx.playersInArc = (pos, dir, range, cosHalf) => {
    const out = [];
    for (const t of remote.values()) {
      if (!t.alive || !ctx.canHurt(t)) continue;
      _v.subVectors(t.center, pos);
      const d = _v.length();
      if (d > range + 0.3) continue;
      if (d > 0.3 && _v.normalize().dot(dir) < cosHalf) continue;
      if (!world.hasLineOfSight(pos, t.center)) continue;
      out.push(t);
    }
    return out;
  };
  ctx.hitPlayer = (t, dmg, info) => {
    if (!ctx.canHurt(t) || !t.alive) return;
    // a raised katana facing you parries a slash outright and turns some bullets aside
    // the bullet met the blade itself: it glances off, and now and then comes straight back at you
    if (info.part === 'blade') {
      effects.strokeBurst(info.point, INK.ORANGE, 8, 6, { life: 0.22, size: 0.035 });
      audio.shieldHit(t.center);
      const ret = Math.random() < 0.4;
      if (ret) {
        effects.tracer(info.point, player.eye, INK.RED, 0.03, 0.08);
        hud.tip('RETURNED', 0.9);
        input.rumble(0.5, 0.4, 90);
        player.lastHitBy = t.id;
        player.lastHit = {
          from: t.center.toArray(),
          crit: false,
          amount: dmg * 0.6,
          src: 'deflect',
        };
        player.takeDamage(dmg * 0.6, t.center);
      } else hud.tip('DEFLECTED', 0.7);
      net.sendTo(t.id, 'parry', { ret, by: net.id });
      return;
    }
    const facing = t.blocking
      ? _v.subVectors(player.center, t.center).normalize().dot(t.forward)
      : -1;
    const frontHit = /^(head|torso|arm|fore)/.test(info.part || '');
    // a slash is only parried by a guard that just came up and faces you
    if (facing > 0.6 && frontHit && info.source === 'katana' && t.parryWindow) {
      effects.strokeBurst(info.point, INK.ORANGE, 10, 6, { life: 0.25, size: 0.04 });
      audio.shieldHit(t.center);
      game.hitstop(0.08, 0.15);
      player.weapons[player.katanaIndex].cooldown = Math.max(
        player.weapons[player.katanaIndex].cooldown,
        0.6,
      );
      input.rumble(0.6, 0.3, 90);
      hud.tip('PARRIED', 0.9);
      return;
    }
    effects.blood(info.point, info.dir, clamp(0.4 + dmg / 80, 0.4, 1.6), { ink: INK.RED });
    hud.hitmarker(false, info.crit);
    audio.hitEnemy(t.center);
    t.flash();
    net.sendTo(t.id, 'pdmg', {
      amount: Math.round(dmg),
      from: player.center.toArray().map((v) => +v.toFixed(1)),
      by: net.id,
      crit: !!info.crit,
      src: info.source,
    });
  };
  // a slash through another player's rope cuts it: their client drops the hook
  const _rp = new THREE.Vector3(),
    _rq = new THREE.Vector3();
  ctx.cutRopes = (eye, dir, range) => {
    let cut = false;
    for (const r of remote.values()) {
      if (!r.alive || !r.grappling) continue;
      _rp.set(
        r.body.pos.x + r.right.x * 0.35,
        r.body.pos.y + 1.25,
        r.body.pos.z + r.right.z * 0.35,
      );
      for (let i = 0; i <= 14; i++) {
        _rq.lerpVectors(_rp, r.gPoint, i / 14).sub(eye);
        const t = _rq.dot(dir);
        if (t < 0.3 || t > range) continue;
        const lat = Math.sqrt(Math.max(0, _rq.lengthSq() - t * t));
        if (lat > 0.9) continue;
        _rq.add(eye);
        effects.strokeBurst(_rq, INK.ORANGE, 10, 5, { life: 0.25, size: 0.035 });
        net.sendTo(r.id, 'cut', {});
        hud.tip('ROPE CUT', 0.9);
        cut = true;
        break;
      }
    }
    return cut;
  };
  const _v = new THREE.Vector3();
  // breakable props: bullets, blades and blasts break them, and everyone in a match sees it go
  ctx.breakHit = (br, dmg, point, dir) => {
    if (!br.alive) return;
    br.hp -= dmg;
    if (br.hp <= 0) breakProp(br, dir, true);
    else {
      effects.strokeBurst(point, br.ink, 5, 4, { life: 0.2, size: 0.03 });
      audio.shieldHit(point);
    }
  };
  ctx.breakablesInArc = (pos, dir, range, cosHalf) =>
    runtime.state.level.breakables.filter((br) => {
      if (!br.alive) return false;
      _v.subVectors(br.pos, pos);
      const d = _v.length();
      return d < range + 0.5 && (d < 0.4 || _v.divideScalar(d).dot(dir) > cosHalf);
    });
  ctx.blastBreakables = (c, R) => {
    for (const br of runtime.state.level.breakables)
      if (br.alive && br.pos.distanceTo(c) < R * 0.9)
        breakProp(br, br.pos.clone().sub(c).normalize(), true);
  };
  function breakProp(br, dir, local, quiet = false) {
    if (!br.alive) return;
    br.alive = false;
    world.removeBox(br.box);
    const g = br.group,
      pos = br.pos;
    const d =
      dir && dir.lengthSq() > 0.01
        ? dir.clone().normalize()
        : new THREE.Vector3(rand(-1, 1), 1, rand(-1, 1)).normalize();
    if (quiet) {
      runtime.resources.release(g);
      return;
    }
    g.updateMatrixWorld(true);
    for (const child of [...g.children]) {
      child.updateWorldMatrix(true, false);
      R.scene.attach(child);
      const v = d.clone().multiplyScalar(rand(2, 6));
      v.x += rand(-3, 3);
      v.z += rand(-3, 3);
      v.y += rand(2.5, 6.5);
      effects.debris(
        child,
        child.position,
        v,
        new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)),
        { radius: 0.14, blood: false, life: rand(6, 9) },
      );
    }
    runtime.resources.release(g);
    const up = new THREE.Vector3(0, 1, 0);
    if (br.kind === 'pinata') {
      for (const ink of [INK.PINK, INK.ORANGE, INK.GREEN])
        effects.strokeBurst(pos, ink, 16, 7, { life: 0.7, size: 0.05 });
      effects.explosion(pos, 2.5, INK.PINK);
      if (!net.active || net.isHost)
        for (let i = 0; i < 2; i++)
          spawnPickup(
            'health',
            pos.clone().add(new THREE.Vector3(rand(-1.2, 1.2), 0, rand(-1.2, 1.2))),
          );
      if (game.mode === 'solo') game.addScore(25, 'PIÑATA');
    } else if (br.kind === 'cactus') {
      effects.blood(pos, d, 1.4, { ink: INK.GREEN });
      effects.bloodPool(new THREE.Vector3(pos.x, 0, pos.z), 1.1, INK.GREEN);
    } else {
      effects.strokeBurst(pos, br.ink, 12, 5, { life: 0.35, size: 0.04 });
      effects.smoke(pos, up, 3);
    }
    audio.smash(pos, br.kind === 'barrel' || br.kind === 'crate' || br.kind === 'cactus');
    if (local && net.active) net.broadcast('brk', { id: br.id });
  }
  // every ray a gun fires this tick is sent to the others, who draw it as a tracer from the shooter's gun

  ctx.onShot = (end) => {
    if (net.active && inMatch())
      shotQueue.push(+end.x.toFixed(1), +end.y.toFixed(1), +end.z.toFixed(1));
  };

  return { breakProp };
}
