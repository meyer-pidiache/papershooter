export const FFA_TARGET = 20;
export const FFA_TIME = 600;
export const RESPAWN = 2.5;

export interface Score {
  name: string;
  kills: number;
  deaths: number;
}

export function formatClock(seconds: number): string {
  const remaining = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
}

export function comboScore(points: number, combo: number): number {
  return Math.round(points * (1 + Math.min(combo, 9) * 0.25));
}

export function rankScores(scores: ReadonlyMap<string, Score>): Array<[string, Score]> {
  return [...scores].sort((a, b) => b[1].kills - a[1].kills || a[1].deaths - b[1].deaths);
}

/** Mutates the match's score table; a suicide never awards a kill. */
export function recordDeath(scores: Map<string, Score>, victim: string, killer?: string | null): void {
  const victimScore = scores.get(victim);
  if (victimScore) victimScore.deaths++;
  if (killer && killer !== victim) {
    const killerScore = scores.get(killer);
    if (killerScore) killerScore.kills++;
  }
}

export function idlePolicy(inMatch: boolean, isHost: boolean, othersActive: boolean, idle: number) {
  const limit = inMatch ? 150 : 300;
  const canDrop = !isHost || !othersActive;
  return { limit, warn: canDrop && idle > limit - 20, drop: canDrop && idle > limit };
}
