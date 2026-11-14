import { describe, expect, it } from 'vitest';
import { knownMap, mapName } from '../../src/domain/maps';
import {
  comboScore,
  formatClock,
  idlePolicy,
  rankScores,
  recordDeath,
} from '../../src/domain/match';
import { bossFor, enemyName, planWave } from '../../src/domain/waves';

describe('game rules', () => {
  it('normalizes known maps without losing Mexico', () => {
    expect(knownMap('mexico')).toBe('mexico');
    expect(knownMap('unknown')).toBe('district');
    expect(mapName('mexico')).toBe('PAPER MEXICO');
    expect(mapName(null)).toBe('PAPER DISTRICT');
  });
  it('formats the match clock and caps combo bonuses', () => {
    expect([600, 59.2, 0, -5].map(formatClock)).toEqual(['10:00', '1:00', '0:00', '0:00']);
    expect(comboScore(100, 0)).toBe(100);
    expect(comboScore(100, 1)).toBe(125);
    expect(comboScore(100, 12)).toBe(325);
  });
  it('awards kills, counts deaths and never awards a suicide', () => {
    const scores = new Map([
      ['a', { name: 'a', kills: 0, deaths: 0 }],
      ['b', { name: 'b', kills: 0, deaths: 0 }],
    ]);
    recordDeath(scores, 'a', 'b');
    recordDeath(scores, 'a', 'a');
    recordDeath(scores, 'missing', 'missing');
    recordDeath(scores, 'b');
    expect(scores.get('a')).toMatchObject({ kills: 0, deaths: 2 });
    expect(rankScores(scores).map(([id]) => id)).toEqual(['b', 'a']);
    scores.get('a')!.kills = 1;
    expect(rankScores(scores).map(([id]) => id)).toEqual(['b', 'a']);
  });
  it('retains a host while another player is active', () => {
    expect(idlePolicy(true, true, true, 200).drop).toBe(false);
    expect(idlePolicy(true, false, true, 151)).toMatchObject({ warn: true, drop: true });
    expect(idlePolicy(false, true, false, 281)).toMatchObject({ warn: true, drop: false });
    expect(idlePolicy(false, false, false, 10).warn).toBe(false);
  });
  it('preserves the first wave, boss rotation and enemy eligibility', () => {
    const wave = planWave(1, () => 0);
    expect(wave.queue).toEqual(Array(7).fill('grunt'));
    expect(wave).toMatchObject({ maxAlive: 4, speed: 1, damage: 1.2, boss: false });
    for (const [number, type] of [
      [5, 'boss'],
      [10, 'eraser'],
      [15, 'inkblot'],
      [20, 'boss'],
    ] as const) {
      expect(bossFor(number)).toBe(type);
      expect(planWave(number, () => 0.99).queue[0]).toBe(type);
      expect(enemyName(type)).toMatch(/^THE /);
    }
    expect(planWave(4, () => 0.99).queue).toContain('flyer');
    expect(planWave(6, () => 0.99)).toMatchObject({
      modifier: 'SWARM · more of them, thinner',
      speed: 1.15,
    });
    expect(enemyName('grunt')).toBe('GRUNT');
    expect(() => planWave(0)).toThrow(RangeError);
    expect(() => planWave(1.5)).toThrow(RangeError);
  });
});
