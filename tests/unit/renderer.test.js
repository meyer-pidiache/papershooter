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

import { InkRenderer } from '../../src/presentation/renderer.js';
import { makeInkMaterial, setFill, setInk } from '../../src/presentation/ink/materials.js';
import { INK } from '../../src/shared/ink.js';

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

it('keeps frame uniforms and palette values owned by each renderer', () => {
  const first = new InkRenderer(document.createElement('canvas'));
  const second = new InkRenderer(document.createElement('canvas'));
  const material = makeInkMaterial();
  try {
    first.camera.rotation.y = 0.25;
    second.camera.rotation.y = 1;
    first.render(10);
    material.onBeforeRender(first.renderer, first.scene, first.camera);
    const firstLight = material.uniforms.uLightDir;
    const firstValue = firstLight.value.clone();
    expect(material.uniforms.uTime.value).toBe(10);
    second.render(20);
    material.onBeforeRender(second.renderer, second.scene, second.camera);
    expect(material.uniforms.uTime.value).toBe(20);
    expect(material.uniforms.uLightDir).not.toBe(firstLight);
    expect(firstLight.value.equals(firstValue)).toBe(true);
    material.onBeforeRender(first.renderer, first.scene, first.camera);
    expect(material.uniforms.uTime.value).toBe(10);
    expect(first.post.uniforms.uInks.value[0]).not.toBe(second.post.uniforms.uInks.value[0]);
  } finally {
    material.dispose();
    first.dispose();
    second.dispose();
  }
});
