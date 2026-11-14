import { isRecord } from '../shared/ice.js';

export const MAX_PLAYERS = 10;
export const FFA_TARGET = 20;
export const FFA_TIME = 600;
export const RESPAWN = 2.5;

export interface Score {
  name: string;
  kills: number;
  deaths: number;
}

export interface ScoreRow extends Score {
  id: string;
}

/** Network scores are untrusted data even when their sender is the elected host. */
export function parseScoreRows(value: unknown): ScoreRow[] | null {
  if (!Array.isArray(value) || value.length > MAX_PLAYERS) return null;
  const rows: ScoreRow[] = [];
  const ids = new Set<string>();
  for (const row of value) {
    if (
      !isRecord(row) ||
      typeof row.id !== 'string' ||
      !row.id ||
      row.id.length > 128 ||
      ids.has(row.id)
    )
      return null;
    if (typeof row.name !== 'string') return null;
    const kills = row.kills,
      deaths = row.deaths;
    if (
      typeof kills !== 'number' ||
      !Number.isSafeInteger(kills) ||
      kills < 0 ||
      typeof deaths !== 'number' ||
      !Number.isSafeInteger(deaths) ||
      deaths < 0
    )
      return null;
    ids.add(row.id);
    rows.push({ id: row.id, name: row.name.slice(0, 14), kills, deaths });
  }
  return rows;
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
export function recordDeath(
  scores: Map<string, Score>,
  victim: string,
  killer?: string | null,
): void {
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
