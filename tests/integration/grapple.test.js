// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { applicationFixture } from '../support/application.js';

it('preserves hook flight, attachment, reeling and jump release', () => {
  vi.useFakeTimers();
  const fixture = applicationFixture();
  try {
    const { app, player, input, world, effects } = fixture;
    app.controls.begin();
    world.clear();
    world.addBox({ x: -60, y: -1, z: -60 }, { x: 60, y: 0, z: 60 });
    world.addBox({ x: -10, y: 0, z: -16 }, { x: 10, y: 20, z: -15 });
    world.finalize();
    player.body.pos.set(0, 0, 0);
    player.pitch = 0.35;
    const trace = [];
    const vector = (value) => value.toArray().map((coordinate) => +coordinate.toFixed(6));
    const run = (keys, frames) => {
      input.keys = keys;
      for (let i = 0; i < frames; i++) {
        input.update(0.02);
        player.update(0.02);
        effects.update(0.02);
      }
      trace.push({
        state: player.grapple.state,
        pos: vector(player.body.pos),
        vel: vector(player.body.vel),
        hook: vector(player.grapple.hook),
        length: +player.grapple.len.toFixed(6),
        stamina: +player.grapStam.toFixed(6),
      });
    };
    run({}, 1);
    run({ grapple: true }, 2);
    expect(player.grapple.state).toBe('fly');
    run({ grapple: true }, 9);
    expect(player.grapple.state).toBe('on');
    run({ grapple: true, forward: true }, 8);
    run({ forward: true }, 5);
    run({ jump: true, forward: true }, 1);
    expect(player.grapple.state).toBe('idle');
    expect(player.body.vel.y).toBeGreaterThan(0);
    run({}, 10);
    expect(trace).toMatchSnapshot();
  } finally {
    fixture.app.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
  }
});
