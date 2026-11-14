export const LEVELS = [
  { key: 'district', name: 'PAPER DISTRICT', blurb: 'streets, rooftops and fire escapes' },
  { key: 'mexico', name: 'PAPER MEXICO', blurb: 'a sun-baked plaza · piñatas, tacos and mariachi' },
] as const;

export type MapKey = (typeof LEVELS)[number]['key'];

export function knownMap(value: unknown): MapKey {
  return value === 'mexico' ? value : 'district';
}

export function mapName(value: unknown): string {
  return LEVELS.find((map) => map.key === value)?.name ?? LEVELS[0].name;
}
