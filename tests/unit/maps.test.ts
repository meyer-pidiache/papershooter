import { afterEach, describe, expect, it, vi } from 'vitest';
import baseline from '../fixtures/maps-baseline.json';
import { LEVELS } from '../../src/maps/index.js';
import { levelFingerprint, seededRandom } from '../support/level-fingerprint';

afterEach(() => vi.restoreAllMocks());

describe('existing map output at c74df47', () => {
  for (const key of ['district', 'mexico'] as const) {
    for (const arena of [false, true]) {
      it(`preserves ${key} in ${arena ? 'arena' : 'solo'}`, () => {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom());
        expect(levelFingerprint(key, arena)).toEqual(baseline[`${key}-${arena}`]);
      });
    }
  }

  it('offers both existing maps', () => {
    expect(LEVELS.map((level) => level.key)).toEqual(['district', 'mexico']);
  });
});
