import { PerspectiveCamera, Scene } from 'three';
import { vi } from 'vitest';
import { createApplication } from '../../src/application/application.js';
import { Preferences } from '../../src/platform/preferences.js';

export function applicationFixture(map = 'district', options = {}) {
  document.body.innerHTML = '<canvas id="c"></canvas><div id="hud"></div>';
  const renderer = {
    scene: new Scene(),
    camera: new PerspectiveCamera(82, 1, 0.1, 300),
    render: vi.fn(),
    dispose: vi.fn(),
  };
  const values = new Map([
    ['paper_map', map],
    ['paper_music', '0'],
    ['paper_name', 'player'],
  ]);
  const preferences = new Preferences({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  const app = createApplication({
    canvas: document.querySelector('#c'),
    hudRoot: document.querySelector('#hud'),
    renderer,
    preferences,
    autoStart: false,
    ...options,
  });
  app.runtime.input.usingGamepad = true;
  let now = performance.now();
  const frame = (seconds = 1 / 60, count = 1) => {
    for (let i = 0; i < count; i++) {
      now += seconds * 1000;
      app.loop.step(now);
    }
  };
  return { app, ...app.runtime, frame, renderer, values };
}
