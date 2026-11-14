// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Sfx } from '../../src/presentation/audio.js';
import { AudioContextModel } from '../support/audio-context.js';
import { assertAudioTrace } from '../support/audio-fingerprint.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('procedural audio', () => {
  it('retries a suspended context after the browser rejects an autoplay resume', async () => {
    vi.stubGlobal('AudioContext', AudioContextModel);
    const audio = new Sfx();
    audio.init();
    const resume = vi
      .spyOn(audio.ctx, 'resume')
      .mockRejectedValueOnce(new Error('user gesture required'));
    audio.resume();
    await Promise.resolve();
    expect(audio.ctx.state).toBe('suspended');
    audio.resume();
    expect(resume).toHaveBeenCalledTimes(2);
    expect(audio.ctx.state).toBe('running');
    audio.dispose();
  });

  it('schedules finite sound envelopes, attenuates distance and owns its context', () => {
    vi.stubGlobal('AudioContext', AudioContextModel);
    const audio = new Sfx();
    audio.init();
    const ctx = audio.ctx;
    audio.init();
    expect(audio.ctx).toBe(ctx);
    audio.resume();
    expect(ctx.state).toBe('running');
    audio.setListener(new Vector3(), new Vector3(1, 0, 0));
    const near = audio.synth._out(new Vector3(1, 0, 0)).gain.value;
    const far = audio.synth._out(new Vector3(100, 0, 0)).gain.value;
    expect(far).toBeLessThan(near);
    const sounds = [
      'shot',
      'enemyShot',
      'shotgun',
      'sniperShot',
      'sniperAim',
      'empty',
      'winded',
      'reload',
      'katanaSwing',
      'katanaHit',
      'parry',
      'perfectParry',
      'grappleFire',
      'grappleHit',
      'grappleRelease',
      'jump',
      'slide',
      'wallJump',
      'mantle',
      'dash',
      'hurt',
      'death',
      'hitEnemy',
      'headshot',
      'enemyDie',
      'gib',
      'splat',
      'spawn',
      'lunge',
      'bulletImpact',
      'ricochet',
      'pickup',
      'wave',
      'waveClear',
      'tick',
      'hitstop',
      'switchWeapon',
      'heartbeat',
      'shotgunFire',
      'revolver',
      'sniperFire',
      'focusIn',
      'focusSlash',
      'pump',
      'shell',
      'cylinder',
      'explosion',
      'fuse',
      'flyerDive',
      'flyerBuzz',
      'stomp',
      'bossRoar',
      'shieldHit',
      'airdrop',
      'crateLand',
    ];
    for (const sound of sounds) {
      const before = ctx.nodes.length;
      audio[sound]();
      expect(ctx.nodes.length, sound).toBeGreaterThan(before);
    }
    for (const kind of ['rifle', 'shotgun', 'sniper', 'other'])
      audio.remoteShot(kind, new Vector3(3, 1, 0));
    audio.footstep(0.5);
    audio.land(1);
    audio.kill(true);
    audio.kill(false);
    audio.smash(new Vector3(), true);
    audio.smash(new Vector3(), false);
    audio.synth.noise({ hp: 200, freqEnd: 40, at: 2 });
    audio.synth.tone({ freq: 440, freqEnd: 880, pos: new Vector3(2, 0, 0) });
    audio.reelLoop(true);
    const reel = ctx.nodes.length;
    audio.reelLoop(true);
    expect(ctx.nodes.length).toBe(reel);
    expect(audio.reel.playing).toBe(true);
    audio.reelLoop(false);
    expect(
      ctx.parameters.every(
        ({ value, time }) => Number.isFinite(value) && Number.isFinite(time) && time >= 0,
      ),
    ).toBe(true);
    expect(
      ctx.nodes
        .filter((node) => node.started !== undefined)
        .every((node) => node.stopped >= node.started),
    ).toBe(true);
    assertAudioTrace('effects', ctx);
    audio.dispose();
    expect(ctx.state).toBe('closed');
    expect(audio.ctx).toBeNull();
  });

  it('plays both complete themes and stops its scheduling timer', () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', AudioContextModel);
    const audio = new Sfx();
    audio.init();
    const ctx = audio.ctx;
    for (const [tune, duration] of [
      ['district', 140],
      ['mexico', 80],
    ]) {
      audio.setTune(tune);
      audio.musicOn(true);
      audio.setIntensity(1);
      expect(audio.musicPlaying).toBe(true);
      for (let time = 0; time < duration; time += 0.5) {
        ctx.currentTime += 0.5;
        audio.music.tick();
      }
      ctx.currentTime += 10;
      audio.music.tick();
      vi.advanceTimersByTime(100);
      audio.musicOn(false);
      expect(audio.musicPlaying).toBe(false);
    }
    expect(ctx.nodes.filter((node) => node.kind === 'oscillator').length).toBeGreaterThan(100);
    expect(
      ctx.parameters.every(({ value, time }) => Number.isFinite(value) && Number.isFinite(time)),
    ).toBe(true);
    assertAudioTrace('music', ctx);
    audio.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
