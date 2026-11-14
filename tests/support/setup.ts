import { afterEach, beforeEach, vi } from 'vitest';
import { seededRandom } from './random';

beforeEach(() => vi.spyOn(Math, 'random').mockImplementation(seededRandom()));
afterEach(() => vi.restoreAllMocks());
