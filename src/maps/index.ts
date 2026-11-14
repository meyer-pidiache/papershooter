import type { Scene } from 'three';
import type { World } from '../engine/physics.js';
import type { MapKey } from '../domain/maps.js';
import { knownMap } from '../domain/maps.js';
import { createBuilder } from './builder.js';
import { buildDistrict } from './district.js';
import { buildMexico } from './mexico.js';
export { LEVELS } from '../domain/maps.js';

export type MapKit = ReturnType<typeof createBuilder>;
export type Level = MapKit['L'];
export type MapBuilder = (kit: MapKit, arena?: boolean) => Level;

// Adding a map key requires a builder here; each map uses the same construction contract.
const builders: Record<MapKey, MapBuilder> = { district: buildDistrict, mexico: buildMexico };
export function buildLevel(
  scene: Scene,
  world: World,
  key = 'district',
  opts: { arena?: boolean } = {},
): Level {
  return builders[knownMap(key)](createBuilder(scene, world), !!opts.arena);
}
