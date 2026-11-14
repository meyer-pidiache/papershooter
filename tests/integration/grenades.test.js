// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';

it('preserves charged and remote grenade trajectories, blast damage and reset behavior', () => {
  vi.useFakeTimers();
  const fixture = applicationFixture();
  try {
    const { app, player, input, world, effects } = fixture;
    app.controls.begin();
    const frame = (dt = 1 / 60, count = 1) => {
      for (let i = 0; i < count; i++) {
        input.update(dt);
        player.update(dt);
        effects.update(dt);
      }
    };
    world.clear();
    world.addBox({ x: -60, y: -1, z: -60 }, { x: 60, y: 0, z: 60 });
    world.addBox({ x: -5, y: 0, z: -9 }, { x: 5, y: 6, z: -8 });
    world.finalize();
    player.body.pos.set(0, 0, 0);
    const packets = [];
    const stock = player.grenades;
    player.onThrow = (packet) => packets.push(packet);
    input.keys.grenade = true;
    frame(0.05, 12);
    input.keys.grenade = false;
    frame();
    expect(player.grenades).toBe(stock - 1);
    expect(packets).toHaveLength(1);
    player.throwGrenade({ pos: [2, 1, -2], vel: [-1, 3, 0] });
    expect(player.grenades).toBe(stock - 1);
    const trace = [];
    const vector = (value) => value.toArray().map((coordinate) => +coordinate.toFixed(6));
    for (let i = 0; i < 45; i++) {
      frame(0.05);
      if (i % 8 === 0)
        trace.push({
          hp: +player.hp.toFixed(6),
          stock: player.grenades,
          projectiles: player.nades.map((grenade) => ({
            pos: vector(grenade.pos),
            vel: vector(grenade.vel),
            rotation: vector(
              new Vector3(
                grenade.mesh.rotation.x,
                grenade.mesh.rotation.y,
                grenade.mesh.rotation.z,
              ),
            ),
            rest: grenade.rest,
            mine: grenade.mine,
          })),
        });
    }
    expect({ packets, trace }).toMatchSnapshot();
    expect(player.nades).toHaveLength(0);
    player.throwGrenade({ pos: [30, 10, 30], vel: [0, 0, 0] });
    app.controls.resetGame();
    expect(player.nades).toHaveLength(0);
    expect(player.grenades).toBe(3);
  } finally {
    fixture.app.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
