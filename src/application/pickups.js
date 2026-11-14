import * as THREE from 'three';
import { makeInkMaterial } from '../presentation/ink/materials.js';
import { INK } from '../shared/ink.js';
import { rand, choose } from '../engine/math.js';

export function createPickups(runtime, actions = {}) {
  const audio = runtime.audio;
  const { R, net, player, hud, effects } = runtime;
  // ---------------- pickups ----------------
  let pickupId = 1;
  const pmat = {
    ammo: makeInkMaterial({ ink: INK.BLUE }),
    health: makeInkMaterial({ ink: INK.GREEN }),
    cap: makeInkMaterial({ ink: INK.BLACK }),
    shell: makeInkMaterial({ ink: INK.ORANGE }),
  };
  const releaseMaterials = runtime.resources.retain(Object.values(pmat));
  function makePickup(kind) {
    const g = new THREE.Group();
    if (kind === 'ammo') {
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.5, 10), pmat.ammo));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8), pmat.cap);
      c.position.y = 0.33;
      g.add(c);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), pmat.cap);
      l.position.set(0, 0, 0.24);
      g.add(l);
    } else if (runtime.state.level.key === 'mexico') {
      const sh = new THREE.CylinderGeometry(0.42, 0.42, 0.22, 12, 1, false, 0, Math.PI);
      sh.rotateZ(Math.PI / 2);
      sh.rotateX(-Math.PI / 2);
      g.add(new THREE.Mesh(sh, pmat.shell));
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.2), pmat.health);
      f.position.y = 0.02;
      g.add(f);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.08, 0.14), pmat.cap);
      m.position.y = 0.1;
      g.add(m);
    } else {
      g.add(
        new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), pmat.health),
        new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), pmat.health),
      );
    }
    return g;
  }
  function spawnPickup(kind, pos, id = null) {
    const m = makePickup(kind);
    m.position.copy(pos);
    m.position.y += 0.6;
    R.scene.add(m);
    runtime.resources.track(m);
    const p = { id: id ?? pickupId++, kind, mesh: m, base: m.position.y, t: rand(0, 6), life: 45 };
    runtime.state.pickups.push(p);
    if (net.isHost) net.send('pickup', { id: p.id, kind, pos: pos.toArray() });
    return p;
  }
  function removePickup(p) {
    runtime.resources.release(p.mesh);
    const i = runtime.state.pickups.indexOf(p);
    if (i >= 0) runtime.state.pickups.splice(i, 1);
  }
  function collectPickup(p) {
    if (p.kind === 'ammo') {
      player.addAmmoAll(0.4);
      player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
      hud.kill('+AMMO · +GRENADE', 0);
    } else {
      player.hp = Math.min(player.maxHp, player.hp + 35);
      hud.kill(runtime.state.level.key === 'mexico' ? 'TACO · +35 HP' : '+35 HP', 0);
    }
    audio.pickup();
    effects.strokeBurst(p.mesh.position, p.kind === 'ammo' ? INK.BLUE : INK.GREEN, 12, 4, {
      life: 0.3,
    });
  }
  function updatePickups(dt) {
    for (let i = runtime.state.pickups.length - 1; i >= 0; i--) {
      const p = runtime.state.pickups[i];
      p.t += dt;
      p.mesh.position.y = p.base + Math.sin(p.t * 2.5) * 0.12;
      p.mesh.rotation.y += dt * 1.8;
      if (player.alive && p.mesh.position.distanceTo(player.center) < 1.5) {
        collectPickup(p);
        removePickup(p);
        if (net.active) net.send(net.isHost ? 'taken' : 'take', { id: p.id });
        continue;
      }
      if (!net.active || net.isHost) {
        p.life -= dt;
        if (p.life <= 0) {
          removePickup(p);
          if (net.isHost) net.send('taken', { id: p.id });
        }
      }
    }
  }

  function updateArenaPickups(dt) {
    if (!net.isHost) return;
    runtime.state.pickupClock -= dt;
    if (runtime.state.pickupClock <= 0 && runtime.state.pickups.length < 10) {
      runtime.state.pickupClock = 7;
      spawnPickup('ammo', choose(runtime.state.level.pickups));
    }
  }

  function dispose() {
    for (const pickup of [...runtime.state.pickups]) removePickup(pickup);
    releaseMaterials();
  }
  return {
    dispose,
    makePickup,
    spawnPickup,
    removePickup,
    collectPickup,
    updatePickups,
    updateArenaPickups,
  };
}
