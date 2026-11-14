// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { applicationFixture } from '../support/application.js';

it('preserves the movement trace for walking, sprint, jump, double jump, dash and crouch', () => {
  vi.useFakeTimers();
  const fixture = applicationFixture();
  try {
    const { app, world, player, input } = fixture;
    app.controls.begin();
    world.clear();
    world.addBox({ x: -60, y: -1, z: -60 }, { x: 60, y: 0, z: 60 });
    world.finalize();
    player.body.pos.set(0, 0, 0);
    const trace = [];
    const run = (keys, frames) => {
      input.keys = keys;
      for (let i = 0; i < frames; i++) {
        input.update(1 / 60);
        player.update(1 / 60);
      }
      trace.push({
        pos: player.body.pos.toArray().map((value) => +value.toFixed(6)),
        vel: player.body.vel.toArray().map((value) => +value.toFixed(6)),
        ground: player.body.onGround,
        jumps: player.airJumps,
        sliding: player.sliding,
      });
    };
    run({ forward: true }, 30);
    input.usingGamepad = false;
    run({ forward: true, sprint: true }, 30);
    run({ forward: true, jump: true }, 5);
    run({ forward: true }, 1);
    run({ right: true, jump: true }, 5);
    run({ right: true, dash: true }, 5);
    run({}, 60);
    run({ forward: true, sprint: true }, 30);
    run({ forward: true, crouch: true }, 20);
    expect(trace).toMatchSnapshot();
  } finally {
    fixture.app.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
