import * as THREE from 'three';
import { INK } from '../presentation/renderer.js';
import { RemotePlayer, encodeLocal } from '../gameplay/remote-player.js';
import { knownMap } from '../domain/maps';
import { FFA_TIME, formatClock as mmss } from '../domain/match';

export function createMultiplayer(runtime, actions = {}) {
  const audio = runtime.audio;
  const {
    remote,
    ctx,
    hud,
    net,
    lobby,
    scores,
    inMatch,
    game,
    player,
    input,
    effects,
    online,
    shotQueue,
    setArena,
  } = runtime;
  const {
    renderLobby,
    sendScores,
    refreshScoreHud,
    showStart,
    farthestSpawnIndex,
    startMatch,
    breakProp,
    hostStart,
    endMatch,
    toLobbyScreen,
    spawnPickup,
    removePickup,
    tallyDeath,
    applyScores,
    sortedScores,
    resetGame,
    unlockButtons,
  } = actions;
  // ---------------- networking ----------------
  const TRACER_THICK = { rifle: 0.02, shotgun: 0.014, sniper: 0.03 };
  const _sm = new THREE.Vector3(),
    _se = new THREE.Vector3();

  function addRemote(id, name) {
    if (remote.has(id)) {
      const r = remote.get(id);
      r.name = name;
      return r;
    }
    const rp = new RemotePlayer(ctx, id, name, 0, INK.RED);
    rp.onDamage = (t, amount, fromPos) => {
      if (!ctx.canHurt(t) || !t.alive) return;
      hud.hitmarker(false, false);
      net.sendTo(t.id, 'pdmg', {
        amount: Math.round(amount),
        from: fromPos ? fromPos.toArray().map((v) => +v.toFixed(1)) : null,
        by: net.id,
        src: 'grenade',
      });
    };
    remote.set(id, rp);
    return rp;
  }
  function removeRemote(id) {
    const r = remote.get(id);
    if (r) {
      r.dispose();
      remote.delete(id);
    }
    lobby.players.delete(id);
    scores.delete(id);
  }
  function lobbyRows() {
    return [...lobby.players.entries()].map(([id, p]) => ({ id, name: p.name }));
  }
  function broadcastLobby() {
    net.send('lobby', {
      players: lobbyRows(),
      hostId: net.id,
      isPublic: lobby.isPublic,
      map: lobby.map || runtime.state.mapKey,
      shown: net.aliasCode || net.code,
    });
    renderLobby();
  }

  net.onPeerLeave = (id) => {
    const nm = (lobby.players.get(id) || {}).name;
    removeRemote(id);
    broadcastLobby();
    if (inMatch()) {
      hud.kill((nm || 'someone') + ' left', 0);
      sendScores();
    }
  };
  net.onDisconnect = () => {
    if (lobby.order && lobby.order.some((id) => id !== lobby.hostId)) migrateHost();
    else leaveOnline('the host left the lobby');
  };
  // ---- host transfer: when the host goes, the earliest-joined player left takes over on a generation
  // code (the old code is slow to free up on the signalling server); everyone else rejoins there
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let migrating = false;
  async function migrateHost() {
    if (migrating) return;
    migrating = true;
    try {
      await _migrateHost();
    } finally {
      migrating = false;
    }
  }
  async function _migrateHost() {
    const oldHost = lobby.hostId,
      myId = net.id;
    const gen = (lobby.gen || 0) + 1;
    lobby.gen = gen;
    const base = (lobby.code || net.code || '').replace(/-\d+$/, '');
    const code = base + '-' + gen;
    const roster = (lobby.order || []).filter((id) => id !== oldHost && lobby.players.has(id));
    if (!roster.length || !base) {
      leaveOnline('the host left the lobby');
      return;
    }
    const successor = roster[0];
    const wasInMatch = inMatch();
    if (oldHost) {
      const r = remote.get(oldHost);
      if (r) r.dispose();
      remote.delete(oldHost);
      lobby.players.delete(oldHost);
      scores.delete(oldHost);
    }
    hud.message(
      'HOST LEFT',
      successor === myId ? 'you are hosting now' : 'moving to the new host…',
      2.6,
    );
    if (successor === myId) {
      let ok = false;
      for (let tries = 0; tries < 2 && !ok; tries++) {
        try {
          await net.host({ isPublic: lobby.isPublic, code });
          ok = true;
        } catch (e) {
          await sleep(800);
        }
      }
      if (!ok) {
        leaveOnline('could not take over the lobby');
        return;
      }
      const mine = lobby.players.get(myId) || { name: runtime.state.myName };
      lobby.players.delete(myId);
      lobby.players.set(net.id, mine);
      const ms = scores.get(myId);
      scores.delete(myId);
      if (ms) scores.set(net.id, ms);
      lobby.hostId = net.id;
      lobby.code = code;
      lobby.order = [net.id, ...roster.filter((id) => id !== myId)];
      net.accepting = true;
      game.clockStarted = runtime.state.clockRunning || runtime.state.matchLeft < FFA_TIME;
      net.onAlias = () => {
        broadcastLobby();
        hud.kill('lobby code ' + base + ' is back', 0);
      };
      net.claimAlias(base);
      if (game.state === 'over') {
        /* the results stay up; the host timer now runs here */
      } else if (wasInMatch) {
        if (game.state !== 'play' && game.state !== 'dying') game.state = 'play';
        refreshScoreHud();
      } else {
        game.state = 'lobby';
        runtime.state.screen = 'lobby';
        showStart();
      }
      broadcastLobby();
    } else {
      await sleep(1200);
      const deadline = performance.now() + 20000;
      let joined = false;
      while (!joined && performance.now() < deadline) {
        try {
          await net.join(code, { name: runtime.state.myName, prev: myId });
          joined = true;
        } catch (e) {
          await sleep(1200);
        }
      }
      if (!joined) {
        leaveOnline('lost the match when the host left');
        return;
      }
      lobby.code = code;
      if (!wasInMatch) {
        game.state = 'lobby';
        runtime.state.screen = 'lobby';
        showStart();
      }
    }
  }
  net.on('refused', (d) => leaveOnline(d.reason));
  net.hostName = runtime.state.myName;
  net.onPeerJoin = (from, meta) => {
    const name = typeof meta?.name === 'string' ? meta.name.slice(0, 14) : 'paper';
    if (meta && meta.prev && meta.prev !== from) {
      const sc = scores.get(meta.prev);
      if (sc) {
        scores.delete(meta.prev);
        scores.set(from, sc);
      }
      const r = remote.get(meta.prev);
      if (r) r.dispose();
      remote.delete(meta.prev);
      lobby.players.delete(meta.prev);
      if (lobby.order) lobby.order = lobby.order.filter((id) => id !== meta.prev);
    }
    lobby.players.set(from, { name });
    addRemote(from, name);
    broadcastLobby();
    if (game.state === 'play' || game.state === 'dying') {
      if (!scores.has(from)) scores.set(from, { name, kills: 0, deaths: 0 });
      net.sendTo(from, 'start', {
        late: true,
        spawn: farthestSpawnIndex(),
        map: lobby.map || runtime.state.mapKey,
        broken: runtime.state.level.breakables.filter((b) => !b.alive).map((b) => b.id),
      });
      sendScores();
      hud.kill(name + ' joined', 0);
    }
  };
  net.onHost('lobby', (d) => {
    lobby.hostId = d.hostId;
    lobby.isPublic = !!d.isPublic;
    lobby.code = net.code;
    lobby.shown = d.shown || net.code;
    if (d.map) lobby.map = knownMap(d.map);
    lobby.order = d.players.map((p) => p.id);
    lobby.players.clear();
    for (const p of d.players) lobby.players.set(p.id, { name: p.name });
    for (const p of d.players) if (p.id !== net.id) addRemote(p.id, p.name);
    for (const id of [...remote.keys()]) if (!lobby.players.has(id)) removeRemote(id);
    if (inMatch()) {
      for (const p of d.players)
        if (!scores.has(p.id)) scores.set(p.id, { name: p.name, kills: 0, deaths: 0 });
      refreshScoreHud();
    }
    renderLobby();
  });
  net.onHost('leave', (d) => {
    const nm = (lobby.players.get(d.id) || {}).name;
    removeRemote(d.id);
    if (inMatch()) hud.kill((nm || 'someone') + ' left', 0);
    renderLobby();
  });
  net.onHost('start', (d) => {
    if (net.isHost) return;
    if (d.map) lobby.map = knownMap(d.map);
    startMatch(!!d.late, d.spawns ? d.spawns[net.id] : d.spawn);
    if (d.broken)
      for (const id of d.broken) {
        const br = runtime.state.level.breakables[id];
        if (br) breakProp(br, null, false, true);
      }
  });
  net.on('startreq', () => {
    if (net.isHost && game.state === 'lobby') hostStart();
  });
  net.onHost('end', (d) => endMatch(d));
  net.onHost('backtolobby', () => {
    if (!net.isHost) toLobbyScreen();
  });
  net.onHost('pickup', (d) => {
    if (!net.isHost) spawnPickup(d.kind, new THREE.Vector3().fromArray(d.pos), d.id);
  });
  net.onHost('taken', (d) => {
    const p = runtime.state.pickups.find((x) => x.id === d.id);
    if (p) removePickup(p);
  });
  net.on('take', (d) => {
    if (!net.isHost) return;
    const p = runtime.state.pickups.find((x) => x.id === d.id);
    if (p) {
      removePickup(p);
      net.send('taken', { id: d.id });
    }
  });
  net.on('ps', (d, from) => {
    const r = remote.get(from);
    if (r) {
      r.push(d, performance.now() / 1000);
      r.lastSeen = performance.now();
    }
  });
  net.on('pdmg', (d, from) => {
    if (!player.alive || game.state !== 'play' || player.shieldT > 0) return;
    player.lastHitBy = from || null;
    player.lastHit = { from: d.from || null, crit: !!d.crit, amount: d.amount, src: d.src };
    player.takeDamage(d.amount, d.from ? new THREE.Vector3().fromArray(d.from) : null);
  });
  net.on('pdead', (d, from) => {
    const r = remote.get(from);
    const vn = r ? r.name : 'someone';
    const kn = d.killer && scores.get(d.killer) ? scores.get(d.killer).name : null;
    if (r) {
      r.ragdoll(d.dir ? new THREE.Vector3().fromArray(d.dir) : null, !!d.over);
      audio.enemyDie(r.center);
    }
    const how = d.how ? ' · ' + d.how + (d.crit ? ' headshot' : '') : '';
    if (d.killer === net.id) {
      game.kills++;
      game.addScore(100, 'ERASED ' + vn + how);
      audio.kill(true);
    } else hud.kill(kn ? kn + ' erased ' + vn + how : vn + ' fell off the page', 0);
    if (net.isHost) tallyDeath(from, d.killer);
  });
  net.on('nade', (d) => player.throwGrenade(d));
  net.on('brk', (d) => {
    const br = runtime.state.level.breakables[d.id];
    if (br) breakProp(br, null, false);
  });
  net.on('parry', (d) => {
    audio.shieldHit(player.center);
    input.rumble(0.35, 0.3, 60);
    effects.strokeBurst(player.eye.clone().addScaledVector(player.forward, 0.5), INK.ORANGE, 8, 5, {
      life: 0.2,
      size: 0.03,
    });
    hud.kill(d.ret ? 'RETURN TO SENDER' : 'DEFLECTED', d.ret ? 25 : 0);
  });
  net.on('shots', (d, from) => {
    const r = remote.get(from);
    if (!r || !r.root || !r.alive) return;
    _sm.set(
      r.body.pos.x + r.right.x * 0.3 + r.forward.x * 0.8,
      r.body.pos.y + 1.35 + r.forward.y * 0.8,
      r.body.pos.z + r.right.z * 0.3 + r.forward.z * 0.8,
    );
    const th = TRACER_THICK[d.k] || 0.02;
    const e = d.e || [];
    for (let i = 0; i + 2 < e.length; i += 3) {
      _se.set(e[i], e[i + 1], e[i + 2]);
      effects.tracer(_sm, _se, INK.BLUE, th, 0.06);
    }
    r.flash();
    audio.remoteShot(d.k, _sm);
  });
  net.on('cut', () => {
    if (player.grapple.state !== 'idle') {
      player.detachGrapple(false);
      effects.strokeBurst(player.center, INK.ORANGE, 8, 4, { life: 0.25, size: 0.03 });
      hud.tip('your rope got cut', 1.3);
      input.rumble(0.5, 0.3, 80);
    }
  });
  net.onHost('score', (rows) => {
    if (!net.isHost) applyScores(rows);
  });
  net.on('fell', (d, from) => {
    if (!net.isHost) return;
    const sc = scores.get(from);
    if (sc) {
      sc.kills = Math.max(0, sc.kills - 1);
      sendScores();
      net.send('feed', { text: sc.name + ' fell off the page · -1' });
      hud.kill(sc.name + ' fell off the page · -1', 0);
    }
  });
  net.onHost('feed', (d) => hud.kill(String(d.text || ''), 0));
  player.onFall = () => {
    if (!online() || !inMatch()) return;
    hud.kill('fell off the page · -1 kill', 0);
    if (net.isHost) {
      const sc = scores.get(net.id);
      if (sc) {
        sc.kills = Math.max(0, sc.kills - 1);
        sendScores();
        net.send('feed', { text: sc.name + ' fell off the page · -1' });
      }
    } else net.send('fell', {});
  };
  net.onHost('clock', (d) => {
    if (!net.isHost) {
      runtime.state.matchLeft = d.left;
      runtime.state.clockRunning = !!d.on;
    }
  });

  // ---- idle players: a warning, then out; a lobby with nobody active in it shuts down ----
  const IDLE_FLAG = 30,
    IDLE_MATCH = 150,
    IDLE_LOBBY = 300,
    IDLE_WARN = 20;
  let idleWarned = false,
    idleCheckT = 0;
  function idleUpdate(dt) {
    if (!net.active) {
      idleWarned = false;
      return;
    }
    idleCheckT -= dt;
    if (idleCheckT > 0) return;
    idleCheckT = 1;
    const limit = inMatch() ? IDLE_MATCH : IDLE_LOBBY;
    const idle = input.idleSeconds;
    const othersActive = [...remote.values()].some((r) => !r.idle);
    // a host that still has active players stays; kicking it would end their match
    const canDrop = !net.isHost || !othersActive;
    if (idle > limit - IDLE_WARN && !idleWarned && canDrop) {
      idleWarned = true;
      hud.message('STILL THERE?', 'move or you get kicked for inactivity', 3);
      audio.empty();
    }
    if (idle <= limit - IDLE_WARN) idleWarned = false;
    if (idle > limit && canDrop) {
      const back = net.isHost ? null : String(net.aliasCode || net.code || '').replace(/-\d+$/, '');
      leaveOnline(net.isHost ? 'lobby closed: everyone was idle' : 'kicked for inactivity');
      lobby.rejoinCode = back;
      if (back) showStart();
      return;
    }
    // the host also clears out a client that has sat idle past the limit, in case its tab cannot do it itself
    if (net.isHost)
      for (const [id, r] of remote)
        if (
          r.idle &&
          r.idleSince &&
          performance.now() / 1000 - r.idleSince > limit - IDLE_FLAG + 15
        ) {
          net.sendTo(id, 'kick', { reason: 'kicked for inactivity' });
          const c = net.conns.get(id);
          setTimeout(() => {
            try {
              c?.close();
            } catch (e) {
              /* ignore */
            }
          }, 500);
        }
  }
  net.onHost('kick', (d) => {
    const back = String(net.aliasCode || net.code || '').replace(/-\d+$/, '');
    leaveOnline((d && d.reason) || 'kicked');
    lobby.rejoinCode = back;
    if (back) showStart();
  });
  let syncTick = 0;
  function netUpdate(dt) {
    idleUpdate(dt);
    if (!net.active) return;
    const now = performance.now() / 1000;
    syncTick++;
    for (const r of remote.values()) r.update(dt, now);
    // a connection that died without saying so leaves a figure standing around: drop anyone silent too long
    if (inMatch() && !migrating)
      for (const [id, r] of remote) {
        if (r.lastSeen && performance.now() - r.lastSeen > 9000) {
          if (!net.isHost && id === net.hostId) {
            net.leave();
            migrateHost();
            break;
          }
          const nm = r.name;
          removeRemote(id);
          hud.kill(nm + ' lost connection', 0);
          if (net.isHost) {
            const c = net.conns.get(id);
            if (c) {
              try {
                c.close();
              } catch (e) {
                /* ignore */
              }
              net.conns.delete(id);
            }
            net.send('leave', { id });
            broadcastLobby();
            sendScores();
          }
        }
      }
    if (syncTick % 3 === 0 && inMatch())
      net.send(
        'ps',
        encodeLocal(player, player.weaponIndex, {
          firing: player.firing,
          idle: input.idleSeconds > IDLE_FLAG,
        }),
        true,
      );
    if (shotQueue.length) net.broadcast('shots', { k: player.weapon.kind, e: shotQueue.splice(0) });
    if (net.isHost && inMatch() && remote.size > 0) game.clockStarted = true;
    const clockOn =
      inMatch() && !game.over && (net.isHost ? !!game.clockStarted : runtime.state.clockRunning);
    if (inMatch() && !game.over) {
      if (clockOn) runtime.state.matchLeft = Math.max(0, runtime.state.matchLeft - dt);
      if (net.isHost) {
        runtime.state.clockT -= dt;
        if (runtime.state.clockT <= 0) {
          runtime.state.clockT = 2;
          net.send('clock', { left: Math.round(runtime.state.matchLeft), on: clockOn });
        }
      }
      hud.setTimer(clockOn ? mmss(runtime.state.matchLeft) : 'clock starts when someone joins');
    }
    if (net.isHost && clockOn) {
      game.matchT += dt;
      if (runtime.state.matchLeft <= 0) {
        const rows = sortedScores();
        const w = rows.length
          ? { id: rows[0][0], name: rows[0][1].name }
          : { id: net.id, name: runtime.state.myName };
        net.send('end', w);
        endMatch(w);
      }
    }
  }
  function leaveOnline(reason) {
    net.leave();
    for (const id of [...remote.keys()]) removeRemote(id);
    lobby.players.clear();
    scores.clear();
    hud.setBoard(null);
    if (game.state !== 'start') {
      game.state = 'start';
      game.mode = 'solo';
      setArena(false);
      resetGame();
      hud.setGameplayVisible(false);
    }
    game.menu = false;
    lobby.status = reason || '';
    runtime.state.screen = 'online';
    showStart();
  }
  async function createLobby(isPublic) {
    setStatus('opening a lobby…');
    try {
      await net.host({ isPublic });
    } catch (err) {
      setStatus(friendlyError(err));
      unlockButtons();
      return;
    }
    lobby.isPublic = isPublic;
    lobby.map = runtime.state.mapKey;
    lobby.players.clear();
    lobby.players.set(net.id, { name: runtime.state.myName });
    lobby.hostId = net.id;
    lobby.status = '';
    game.state = 'lobby';
    runtime.state.screen = 'lobby';
    showStart();
  }
  async function joinLobby(code) {
    setStatus('connecting…');
    try {
      await net.join(code, { name: runtime.state.myName });
    } catch (err) {
      setStatus(friendlyError(err));
      unlockButtons();
      return;
    }
    lobby.isPublic = net.isPublic;
    lobby.status = '';
    game.state = 'lobby';
    runtime.state.screen = 'lobby';
    showStart();
  }
  async function quickPlay() {
    try {
      await net.quickJoin({ name: runtime.state.myName }, setStatus);
      lobby.isPublic = true;
      lobby.status = '';
      game.state = 'lobby';
      runtime.state.screen = 'lobby';
      showStart();
      return;
    } catch (err) {
      if (!/no open public/.test(String(err.message))) {
        setStatus(friendlyError(err));
        unlockButtons();
        return;
      }
    }
    setStatus('no open lobbies · opening a public one for you…');
    await createLobby(true);
  }
  function friendlyError(err) {
    const m = String((err && err.message) || err || '');
    if (!m) return 'something went wrong';
    if (/networking library/.test(m))
      return 'could not load the networking library · check your connection and reload';
    if (/timed out|signalling/.test(m))
      return 'could not reach the matchmaking server · check your connection';
    if (/no lobby with that code/.test(m))
      return 'no lobby with that code · check it with your friend';
    if (/no answer/.test(m))
      return 'found the lobby but could not connect · one of you may be on a network that blocks it';
    if (/full/.test(m)) return 'that lobby is full · try another code';
    if (/leave the lobby/.test(m)) return 'leave your lobby first';
    return m;
  }
  function setStatus(t) {
    lobby.status = t;
    const el = hud.el.panel.querySelector('#status');
    if (el) el.textContent = t;
  }

  return {
    addRemote,
    removeRemote,
    lobbyRows,
    broadcastLobby,
    sleep,
    migrateHost,
    _migrateHost,
    idleUpdate,
    netUpdate,
    leaveOnline,
    createLobby,
    joinLobby,
    quickPlay,
    friendlyError,
    setStatus,
  };
}
