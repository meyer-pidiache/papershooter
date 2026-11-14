// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { applicationFixture } from '../support/application.js';

it('preserves first-person projection, stride, recoil, damage, guard and death feedback', () => {
  vi.useFakeTimers();
  const fixture = applicationFixture();
  try {
    const { app, player, input, effects, world } = fixture;
    app.controls.begin();
    world.clear();
    world.addBox({ x: -60, y: -1, z: -60 }, { x: 60, y: 0, z: 60 });
    world.finalize();
    player.body.pos.set(0, 0, 0);
    const trace = [],
      vector = (value) => value.toArray().map((coordinate) => +coordinate.toFixed(6));
    const capture = () =>
      trace.push({
        position: vector(player.camera.position),
        rotation: vector(
          new Vector3(player.camera.rotation.x, player.camera.rotation.y, player.camera.rotation.z),
        ),
        eye: vector(player.eye),
        center: vector(player.center),
        fov: +player.camera.fov.toFixed(6),
        hurt: +player.hurtFx.toFixed(6),
        flash: +player.flashFx.toFixed(6),
        speed: +player.speed.toFixed(6),
      });
    const run = (keys, frames) => {
      input.keys = keys;
      for (let i = 0; i < frames; i++) {
        input.update(0.02);
        player.update(0.02);
        effects.update(0.02);
      }
      capture();
    };
    player.idleCam(2);
    capture();
    run({ forward: true }, 20);
    run({ forward: true, sprint: true }, 10);
    run({ aim: true }, 10);
    player.recoil(0.1, -0.02);
    player.kickFov(4);
    player.takeDamage(20, new Vector3(3, 1, -1));
    capture();
    run({}, 5);
    player.switchTo(3);
    run({ aim: true }, 2);
    const guard = player.tryDeflect({
      vel: new Vector3(0, 0, 1),
      pos: player.eye.clone().add(player.forward),
    });
    expect(guard.perfect).toBe(true);
    capture();
    run({}, 5);
    player.die();
    run({}, 20);
    app.controls.resetGame();
    capture();
    expect(trace).toMatchSnapshot();
  } finally {
    fixture.app.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
