import * as THREE from 'three';
import { INK } from '../shared/ink.js';
import { choose } from '../engine/math.js';
import {
  FFA_TARGET,
  RESPAWN,
  formatClock as mmss,
  rankScores,
  recordDeath,
  parseScoreRows,
} from '../domain/match';
import { escapeHtml as esc } from '../presentation/html';

export function createMatch(runtime, actions = {}) {
  const audio = runtime.audio;
  const { remote, player, online, game, net, scores, hud, effects, input } = runtime;
  const { endFocus } = actions;
  // ---------------- free for all: spawning, death, scoring ----------------
  const HOW = {
    rifle: 'rifle',
    shotgun: 'shotgun',
    sniper: 'sniper',
    katana: 'katana',
    grenade: 'grenade',
    deflect: 'their own bullet',
  };
  const howWord = (src) => HOW[src] || null;
  const spawnSpots = () =>
    runtime.state.level.arenaSpawns && runtime.state.level.arenaSpawns.length
      ? runtime.state.level.arenaSpawns
      : runtime.state.level.spawns;
  function arenaSpawn() {
    const spots = spawnSpots();
    const others = [...remote.values()].filter((r) => r.alive && r.root && r.root.visible);
    const scored = spots.map((s) => ({
      s,
      d: others.reduce((a, r) => Math.min(a, r.body.pos.distanceTo(s)), 999),
    }));
    scored.sort((a, b) => b.d - a.d);
    return choose(scored.slice(0, Math.min(3, scored.length))).s.clone();
  }
  // a spot for a late joiner: the one farthest from everybody already in the match
  function farthestSpawnIndex() {
    const spots = spawnSpots();
    const bodies = [player, ...remote.values()].filter((r) => r.alive);
    let best = 0,
      bd = -1;
    spots.forEach((s, i) => {
      const d = bodies.reduce((a, r) => Math.min(a, r.body.pos.distanceTo(s)), 999);
      if (d > bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }
  function onLocalDeath() {
    if (!online()) {
      game.state = 'dying';
      game.deathT = 0;
      return;
    }
    const killer = player.lastHitBy || null;
    const h = player.lastHit || {};
    const dir = h.from
      ? player.center
          .clone()
          .sub(new THREE.Vector3().fromArray(h.from))
          .normalize()
          .toArray()
          .map((v) => +v.toFixed(2))
      : null;
    const how = killer ? howWord(h.src) : null;
    net.broadcast('pdead', {
      killer,
      dir,
      over: !!(h.crit || h.amount >= 90 || h.src === 'katana'),
      how,
      crit: !!h.crit,
    });
    if (net.isHost) tallyDeath(net.id, killer);
    game.respawnT = RESPAWN;
    game.state = 'dying';
    game.deathT = 0;
    const kn = killer && scores.get(killer) ? scores.get(killer).name : null;
    hud.kill(
      kn ? 'erased by ' + kn + (how ? ' · ' + how + (h.crit ? ' headshot' : '') : '') : 'erased',
      0,
    );
  }
  function respawnLocal() {
    player.reset(arenaSpawn());
    player.name = runtime.state.myName;
    player.lastHitBy = null;
    player.lastHit = null;
    game.state = 'play';
    player.shieldT = 2;
    hud.tip('spawn protection · 2s', 1.6);
    effects.strokeBurst(player.center, INK.BLUE, 24, 6, { life: 0.5, size: 0.03 });
    audio.spawn(player.center);
  }
  function tallyDeath(victim, killer) {
    recordDeath(scores, victim, killer);
    sendScores();
    checkWin();
  }
  function sendScores() {
    const rows = [...scores.entries()].map(([id, s]) => ({ id, ...s }));
    net.send('score', rows);
    applyScores(rows);
  }
  function applyScores(rows) {
    const parsed = parseScoreRows(rows);
    if (!parsed) return;
    scores.clear();
    for (const r of parsed) scores.set(r.id, { name: r.name, kills: r.kills, deaths: r.deaths });
    refreshScoreHud();
  }
  function sortedScores() {
    return rankScores(scores);
  }
  function refreshScoreHud() {
    if (!online()) return;
    const rows = sortedScores();
    const top = rows.slice(0, 3);
    const myIdx = rows.findIndex(([id]) => id === net.id);
    if (myIdx >= 3) top.push(rows[myIdx]);
    hud.setPvpScore(
      top
        .map(
          ([id, sc]) =>
            `<div class="row${id === net.id ? ' me' : ''}"><span class="rank">${rows.findIndex(([x]) => x === id) + 1}.</span><span>${esc(sc.name)}${id === net.id ? ' (you)' : ''}</span><b>${esc(sc.kills)}</b></div>`,
        )
        .join('') + `<div class="target">first to ${FFA_TARGET}</div>`,
    );
    hud.setModifier('');
    if (!hud.el.board.hidden) hud.setBoard(boardHTML());
  }
  function boardHTML(title = 'FREE FOR ALL') {
    const rows = sortedScores();
    return `<h3>${esc(title)}</h3>${rows.map(([id, s]) => `<div class="${id === net.id ? 'me' : ''}"><span>${esc(s.name)}${id === net.id ? ' (you)' : ''}</span><span>${esc(s.kills)} kills · ${esc(s.deaths)} deaths</span></div>`).join('')}<div class="foot">first to ${FFA_TARGET} · ${mmss(runtime.state.matchLeft)} left · lobby ${esc(String(net.aliasCode || net.code || '').replace(/-\d+$/, ''))}</div>`;
  }
  function checkWin() {
    if (!net.isHost || !online() || game.over) return;
    let winner = null;
    for (const [id, s] of scores) if (s.kills >= FFA_TARGET) winner = { id, name: s.name };
    if (winner) {
      net.send('end', winner);
      endMatch(winner);
    }
  }
  function endMatch(winner) {
    game.over = winner;
    game.overT = 0;
    game.state = 'over';
    endFocus();
    input.exitLock();
    hud.setBoard(null);
    const title = winner.id === net.id ? 'YOU WIN' : (winner.name || 'someone') + ' WINS';
    hud.setGameplayVisible(false);
    hud.showScreen(
      `<h1>${esc(title)}</h1><div class="scoreboard">${sortedScores()
        .map(
          ([id, s]) =>
            `<div class="${id === net.id ? 'me' : ''}"><span>${esc(s.name)}</span><span>${esc(s.kills)} K · ${esc(s.deaths)} D</span></div>`,
        )
        .join('')}</div><div class="go" id="overGo">back to the lobby in a moment…</div>`,
    );
  }

  return {
    howWord,
    spawnSpots,
    arenaSpawn,
    farthestSpawnIndex,
    onLocalDeath,
    respawnLocal,
    tallyDeath,
    sendScores,
    applyScores,
    sortedScores,
    refreshScoreHud,
    boardHTML,
    checkWin,
    endMatch,
  };
}
