// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';

vi.mock('three', async (original) => {
  const actual = await original();
  class RendererBoundary {
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setRenderTarget = vi.fn();
    setClearColor = vi.fn();
    clear = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
  }
  return { ...actual, WebGLRenderer: RendererBoundary };
});

import {
  InkRenderer,
  makeInkMaterial,
  setFill,
  setInk,
  INK,
} from '../../src/presentation/renderer.js';

it('wires the ink/depth pass and paper post pass with camera and effect uniforms', () => {
  const renderer = new InkRenderer(document.createElement('canvas'));
  const boundary = renderer.renderer;
  renderer.camera.position.set(3, 4, 5);
  renderer.render(2, { hurt: 0.5, flash: 0.2, slow: 1, lowHp: 0.7 });
  expect(boundary.setRenderTarget.mock.calls).toEqual([[renderer.rt], [null]]);
  expect(boundary.render.mock.calls).toEqual([
    [renderer.scene, renderer.camera],
    [renderer.postScene, renderer.postCam],
  ]);
  expect(renderer.post.uniforms.uTime.value).toBe(2);
  expect(renderer.post.uniforms.uHurt.value).toBe(0.5);
  expect(renderer.post.uniforms.uLowHp.value).toBe(0.7);
  expect(renderer.post.uniforms.uInvView.value.elements[12]).toBe(3);
  renderer.render(3);
  expect(renderer.post.uniforms.uHurt.value).toBe(0);
  window.dispatchEvent(new Event('resize'));
  expect(boundary.setSize).toHaveBeenCalled();
  const material = makeInkMaterial({ ink: INK.RED, fill: true });
  setInk(material, INK.BLUE);
  setFill(material, false);
  expect(material.uniforms.uInk.value).toBe(INK.BLUE);
  expect(material.uniforms.uFill.value).toBe(0);
  material.dispose();
  renderer.dispose();
  expect(boundary.dispose).toHaveBeenCalledOnce();
  expect(boundary.forceContextLoss).toHaveBeenCalledOnce();
});
