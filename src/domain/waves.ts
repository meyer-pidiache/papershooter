export const BOSSES = ['boss', 'eraser', 'inkblot'] as const;
export type EnemyKind =
  'grunt' | 'rusher' | 'bomber' | 'sniper' | 'flyer' | 'heavy' | 'shield' | (typeof BOSSES)[number];

const ROSTER: ReadonlyArray<{ type: EnemyKind; from: number; weight: number }> = [
  { type: 'grunt', from: 1, weight: 10 },
  { type: 'rusher', from: 2, weight: 6 },
  { type: 'bomber', from: 3, weight: 3 },
  { type: 'sniper', from: 3, weight: 4 },
  { type: 'flyer', from: 4, weight: 4 },
  { type: 'heavy', from: 5, weight: 4 },
  { type: 'shield', from: 6, weight: 4 },
];

export const MODIFIERS = [
  { name: '', speed: 1, damage: 1 },
  { name: 'CAFFEINATED · they move fast', speed: 1.35, damage: 0.85 },
  { name: 'HEAVY INK · they hit harder', speed: 0.9, damage: 1.4 },
  { name: 'SWARM · more of them, thinner', speed: 1.15, damage: 0.9 },
] as const;

export function bossFor(wave: number) {
  return BOSSES[(Math.floor(wave / 5) - 1) % BOSSES.length];
}

export function enemyName(type: string): string {
  const names: Record<string, string> = {
    boss: 'THE DOODLER',
    eraser: 'THE ERASER',
    inkblot: 'THE INKBLOT',
  };
  return names[type] ?? type.toUpperCase();
}

/** The same roster, random draw order and balance as the original game. */
export function planWave(wave: number, random: () => number = Math.random) {
  if (!Number.isSafeInteger(wave) || wave < 1)
    throw new RangeError('Wave must be a positive integer');
  const boss = wave % 5 === 0;
  let allowed: number = MODIFIERS.length;
  if (boss || wave < 4) allowed = 1;
  else if (wave < 6) allowed = 3;
  const modifier = MODIFIERS[Math.floor(random() * allowed)];
  const swarm = modifier === MODIFIERS[3];
  let maxAlive = Math.min(
    4 + Math.floor(wave * 0.9) + (swarm ? 3 : 0),
    (swarm ? 22 : 18) + Math.floor(wave / 3),
  );
  let count = Math.round(Math.min(5 + wave * 2, 32 + wave) * (swarm ? 1.35 : 1));
  const queue: EnemyKind[] = [];
  if (boss) {
    count = 7 + wave;
    maxAlive += 2 + Math.floor(wave / 5);
    queue.push(bossFor(wave));
  }
  const pool = ROSTER.filter((entry) => wave >= entry.from).map((entry) => ({
    ...entry,
    weight: entry.weight * Math.min(1, 0.3 + 0.25 * (wave - entry.from)),
  }));
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  for (let i = 0; i < count; i++) {
    let roll = random() * total;
    let type = pool[0].type;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) {
        type = entry.type;
        break;
      }
    }
    queue.push(type);
  }
  return {
    boss,
    queue,
    maxAlive,
    modifier: modifier.name,
    speed: modifier.speed,
    damage: modifier.damage * 1.2,
  };
}
