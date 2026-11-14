import { Vector3 } from 'three';

/** The renderer owns its palette values; ink identifiers live in shared/ink. */
export function createInkColors(): Vector3[] {
  return [
    new Vector3(0.1, 0.19, 0.76),
    new Vector3(0.86, 0.12, 0.2),
    new Vector3(0.18, 0.2, 0.26),
    new Vector3(0.92, 0.55, 0.08),
    new Vector3(0.12, 0.6, 0.3),
    new Vector3(0.9, 0.4, 0.66),
  ];
}
