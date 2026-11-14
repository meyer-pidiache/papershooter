import { createBuilder } from './builder.js';
import { buildDistrict } from './district.js';
import { buildMexico } from './mexico.js';
export { LEVELS } from '../domain/maps.js';

// Each map consumes the same kit; geometry and colliders remain in its own module.
const builders = { district: buildDistrict, mexico: buildMexico };
export function buildLevel(scene, world, key = 'district', opts = {}) {
  const builder = builders[key] ?? builders.district;
  return builder(createBuilder(scene, world), !!opts.arena);
}
