import { FrontSide, ShaderMaterial, Vector3 } from 'three';
import type { Camera, WebGLRenderer, Side } from 'three';
import { INK } from '../../shared/ink.js';
import { inkVert, inkFrag } from './material-shaders.js';

export interface InkFrame {
  uTime: { value: number };
  uLightDir: { value: Vector3 };
}
export type InkMaterial = ShaderMaterial & { inkId: number };
export interface InkOptions {
  ink?: number;
  fill?: boolean;
  shadeScale?: number;
  shadeBias?: number;
  side?: Side;
}
const frames = new WeakMap<WebGLRenderer, InkFrame>();
const lightWorld = new Vector3(0.38, 0.82, 0.42).normalize();

export function createInkFrame(): InkFrame {
  return { uTime: { value: 0 }, uLightDir: { value: new Vector3(0, 1, 0) } };
}
export function registerInkFrame(renderer: WebGLRenderer, frame: InkFrame): void {
  frames.set(renderer, frame);
}
export function unregisterInkFrame(renderer: WebGLRenderer): void {
  frames.delete(renderer);
}
export function updateInkFrame(frame: InkFrame, camera: Camera, time: number): void {
  frame.uTime.value = time;
  frame.uLightDir.value.copy(lightWorld).transformDirection(camera.matrixWorldInverse);
}

function bindFrame(this: ShaderMaterial, renderer: WebGLRenderer): void {
  const frame = frames.get(renderer);
  if (!frame) return;
  this.uniforms.uTime = frame.uTime;
  this.uniforms.uLightDir = frame.uLightDir;
}

/** Models depend on the ink contract; renderer frame state is bound only at draw time. */
export function makeInkMaterial(opts: InkOptions = {}): InkMaterial {
  const material = new ShaderMaterial({
    uniforms: {
      uInk: { value: opts.ink ?? INK.BLUE },
      uFill: { value: opts.fill ? 1 : 0 },
      uShadeScale: { value: opts.shadeScale ?? 1 },
      uShadeBias: { value: opts.shadeBias ?? 0 },
      uLightDir: { value: new Vector3(0, 1, 0) },
      uTime: { value: 0 },
    },
    vertexShader: inkVert,
    fragmentShader: inkFrag,
    side: opts.side ?? FrontSide,
  }) as InkMaterial;
  material.inkId = opts.ink ?? INK.BLUE;
  material.onBeforeRender = bindFrame;
  return material;
}
export function setInk(material: InkMaterial, ink: number): void {
  material.uniforms.uInk.value = ink;
  material.inkId = ink;
}
export function setFill(material: ShaderMaterial, fill: boolean): void {
  material.uniforms.uFill.value = fill ? 1 : 0;
}
