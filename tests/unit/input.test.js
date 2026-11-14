// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../../src/platform/input.js';

let input;
afterEach(() => {
  input?.dispose();
  input = null;
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const key = (type, code, options = {}) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, ...options }));

describe('browser input adapter', () => {
  it('normalizes keyboard movement, detects edges and releases held keys on blur', () => {
    input = new Input(document.createElement('canvas'));
    key('keydown', 'KeyW');
    key('keydown', 'KeyD');
    input.update(1 / 60);
    expect(Math.hypot(input.move.x, input.move.y)).toBeCloseTo(1);
    expect(input.pressed('forward')).toBe(true);
    expect(input.anyPressed()).toBe(true);
    input.update(1 / 60);
    expect(input.pressed('forward')).toBe(false);
    key('keyup', 'KeyW');
    input.update(1 / 60);
    expect(input.released('forward')).toBe(true);
    key('keydown', 'Space', { repeat: true });
    expect(input.keys.jump).not.toBe(true);
    input.consume('right');
    expect(input.down('right')).toBe(false);
    window.dispatchEvent(new Event('blur'));
    input.update(1 / 60);
    expect(input.move.x).toBe(0);
    expect(input.anyPressed()).toBe(false);
    expect(input.idleSeconds).toBeGreaterThanOrEqual(0);
  });

  it('handles pointer lock, mouse movement, clicks and wheel input', async () => {
    vi.useFakeTimers();
    const canvas = document.createElement('canvas');
    canvas.requestPointerLock = vi.fn().mockRejectedValue(new Error('gesture required'));
    input = new Input(canvas);
    input.requestLock();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1201);
    expect(canvas.requestPointerLock.mock.calls.length).toBeGreaterThan(1);
    input.exitLock();
    input.pointerLocked = true;
    input.invertY = true;
    const move = new MouseEvent('mousemove');
    Object.defineProperties(move, { movementX: { value: 20 }, movementY: { value: 10 } });
    document.dispatchEvent(move);
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: 1 }));
    input.update(1 / 60);
    expect(input.look.x).toBeLessThan(0);
    expect(input.look.y).toBeGreaterThan(0);
    expect(input.pressed('fire')).toBe(true);
    expect(input.pressed('nextWeapon')).toBe(true);
    document.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    input.update(1 / 60);
    expect(input.released('fire')).toBe(true);
    document.dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }));
    input.update(1 / 60);
    expect(input.pressed('prevWeapon')).toBe(true);
  });

  it('maps a standard gamepad, applies dead zones and routes rumble', () => {
    input = new Input(document.createElement('canvas'));
    const playEffect = vi.fn();
    const pad = {
      index: 0,
      connected: true,
      axes: [0.5, -0.5, 0.95, 0.95],
      buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
      vibrationActuator: { playEffect },
    };
    pad.buttons[0].pressed = true;
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
    input.update(0.5);
    expect(input.usingGamepad).toBe(true);
    expect(input.move.y).toBeGreaterThan(0);
    expect(input.look.x).toBeLessThan(0);
    expect(input.pressed('jump')).toBe(true);
    input.rumble(2, -1, 50);
    expect(playEffect.mock.calls[0][1]).toMatchObject({ strongMagnitude: 1, weakMagnitude: 0 });
    pad.axes = [0.01, 0.01, 0, 0];
    pad.buttons[0].pressed = false;
    input.update(1 / 60);
    expect(input.move).toEqual({ x: 0, y: 0 });
    key('keydown', 'KeyW');
    expect(input.usingGamepad).toBe(false);
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] });
    input.update(1 / 60);
    input.rumble();
  });

  it('tolerates a rejected haptic effect after a controller disconnects', async () => {
    input = new Input(document.createElement('canvas'));
    const playEffect = vi.fn().mockRejectedValue(new Error('controller disconnected'));
    input._pad = { vibrationActuator: { playEffect } };
    input.rumble();
    await Promise.resolve();
    expect(playEffect).toHaveBeenCalledOnce();
    input._pad = null;
    input.rumble();
    expect(playEffect).toHaveBeenCalledOnce();
  });
});
