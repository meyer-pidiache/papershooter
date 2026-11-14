// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { applicationFixture } from '../support/application.js';
import { Rifle, Shotgun, Sniper, Revolver, Katana } from '../../src/gameplay/weapons.js';
import baseline from '../fixtures/weapons-baseline.json';

function geometry(root) {
  const hash = createHash('sha256');
  root.traverse((node) => {
    if (!node.isMesh) return;
    for (const [name, attribute] of Object.entries(node.geometry.attributes)) {
      hash.update(name);
      hash.update(
        Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength),
      );
    }
    const index = node.geometry.index;
    if (index)
      hash.update(Buffer.from(index.array.buffer, index.array.byteOffset, index.array.byteLength));
  });
  return hash.digest('hex');
}
function frame(weapon) {
  weapon.root.updateMatrixWorld(true);
  const nodes = [];
  weapon.root.traverse((node) =>
    nodes.push({
      matrix: node.matrixWorld.elements,
      visible: node.visible,
      ink: node.material?.uniforms?.uInk.value,
      fill: node.material?.uniforms?.uFill.value,
    }),
  );
  return {
    nodes,
    mag: weapon.mag,
    reserve: weapon.reserve,
    reloading: weapon.reloading,
    spread: weapon.spreadPx,
  };
}

it.each([Rifle, Shotgun, Sniper, Revolver, Katana].map((Weapon) => [Weapon.name, Weapon]))(
  'preserves %s geometry and animation through its action cycle',
  (_name, Weapon) => {
    vi.useFakeTimers();
    const fixture = applicationFixture();
    try {
      const { app, player, ctx, world, resources } = fixture;
      app.controls.begin();
      world.clear();
      world.addBox({ x: -50, y: -1, z: -50 }, { x: 50, y: 0, z: 50 });
      world.finalize();
      player.body.pos.set(0, 0, 0);
      player._updateCamera(0.1);
      const weapon = new Weapon(ctx);
      resources.track(weapon.root);
      weapon.equip();
      const shape = geometry(weapon.root),
        st = player._weaponState(false, false, 0),
        frames = [frame(weapon)];
      if (weapon.isGun) {
        const total = weapon.mag + weapon.reserve;
        weapon.fire(st);
        frames.push(frame(weapon));
        for (let i = 0; i < 50; i++) {
          weapon.animate(0.03, {
            ...st,
            aim: i > 10,
            speed: i < 20 ? 12 : 0,
            grounded: i >= 10,
            sliding: i < 10,
          });
          if (i % 10 === 0) frames.push(frame(weapon));
        }
        weapon.startReload();
        for (let i = 0; i < 120; i++) {
          weapon.animate(0.03, st);
          if (i % 10 === 0) frames.push(frame(weapon));
        }
        expect(weapon.mag + weapon.reserve).toBe(total - 1);
        expect(weapon.reloading).toBe(false);
      } else {
        weapon.startSlash(st);
        for (let i = 0; i < 30; i++) {
          weapon.animate(0.03, st);
          if (i % 3 === 0) frames.push(frame(weapon));
        }
        weapon.addBlood(0.8);
        for (let i = 0; i < 30; i++) {
          if (i === 5) weapon.onDeflect(true);
          if (i === 15) weapon.onDeflect(false);
          weapon.animate(0.03, { ...st, aim: true });
          if (i % 3 === 0) frames.push(frame(weapon));
        }
        expect(weapon.blocking).toBe(true);
      }
      const fingerprint = {
        geometry: shape,
        animation: createHash('sha256').update(JSON.stringify(frames)).digest('hex'),
      };
      if (
        process.env.DUMP_WEAPON_TRACE === '1' ||
        fingerprint.animation !== baseline[weapon.kind]?.animation
      ) {
        mkdirSync('reports', { recursive: true });
        writeFileSync(
          `reports/weapon-${weapon.kind}-trace.json`,
          JSON.stringify({ fingerprint, frames }),
        );
      }
      if (process.env.RECORD_WEAPON_BASELINE === '1') {
        const path = 'tests/fixtures/weapons-baseline.json',
          saved = JSON.parse(readFileSync(path, 'utf8'));
        saved[weapon.kind] = fingerprint;
        writeFileSync(path, JSON.stringify(saved, null, 2) + '\n');
      } else expect(fingerprint).toEqual(baseline[weapon.kind]);
    } finally {
      fixture.app.dispose();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  },
);
