import type { PerspectiveCamera, Scene } from 'three';
import type { Net } from '../network/peer-transport.js';
import type { Input } from '../platform/input.js';
import type { Preferences } from '../platform/preferences.js';
import type { HUD } from '../presentation/hud.js';
import type { Sfx } from '../presentation/audio.js';

export interface RenderingPort {
  scene: Scene;
  camera: PerspectiveCamera;
  render(
    time: number,
    effects?: { hurt?: number; flash?: number; slow?: number; lowHp?: number },
  ): void;
  dispose(): void;
}

export interface ApplicationOptions {
  canvas: HTMLCanvasElement;
  hudRoot: HTMLElement;
  renderer?: RenderingPort;
  input?: Input;
  hud?: HUD;
  preferences?: Preferences;
  net?: Net;
  audio?: Sfx;
  autoStart?: boolean;
}
