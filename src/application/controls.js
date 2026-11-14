import { FFA_TARGET, FFA_TIME } from '../domain/match';

export function createControls(runtime, actions = {}) {
  const audio = runtime.audio;
  const listeners = [];
  function listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  }
  function dispose() {
    for (const remove of listeners) remove();
    input.onLockChange = null;
    input.onDeviceChange = null;
    hud.onScreenClick = null;
  }

  const {
    setLevel,
    enemies,
    effects,
    R,
    player,
    online,
    hud,
    game,
    input,
    setArena,
    scores,
    lobby,
    net,
    remote,
    canvas,
    applySettings,
  } = runtime;
  const {
    endFocus,
    startWave,
    spawnSpots,
    sendScores,
    arenaSpawn,
    refreshScoreHud,
    showClickToPlay,
    showPause,
    updateWaves,
    spawnPickup,
    focusCandidate,
    enterFocus,
    pickSpawn,
    createLobby,
    joinLobby,
    quickPlay,
    leaveOnline,
    toLobbyScreen,
    showStart,
  } = actions;
  // ---------------- run control ----------------
  function resetGame() {
    if (runtime.state.level.breakables.some((b) => !b.alive))
      setLevel(runtime.state.loadedKey, runtime.state.arenaLoaded, true);
    enemies.clear();
    effects.clear();
    for (const p of runtime.state.pickups) R.scene.remove(p.mesh);
    runtime.state.pickups.length = 0;
    runtime.state.pickupClock = 0;
    player.maxHp = online() ? 110 : 120;
    player.regenDelay = online() ? 4 : 4.5;
    player.regenRate = online() ? 14 : 11;
    player.reset(runtime.state.level.playerStart);
    player.name = runtime.state.myName;
    player.lastHitBy = null;
    player.lastHit = null;
    enemies.mods.speed = 1;
    enemies.mods.damage = 1;
    hud.setModifier('');
    hud.setBoss(null, null);
    game.boss = null;
    endFocus();
    game.katanaStreak = 0;
    game.score = 0;
    game.kills = 0;
    game.combo = 0;
    game.wave = 0;
    game.intermission = 0;
    game.queue = [];
    game.time = 0;
    game.over = null;
    game.matchT = 0;
    hud.setScore(0, 0);
    hud.setTimer('');
    hud.setPvpScore(null);
    hud.setWave(1, 0);
    hud.setBoard(null);
  }
  function beginCommon() {
    audio.init();
    audio.resume();
    if (!input.usingGamepad) input.requestLock();
    if (runtime.state.musicWanted && !audio.musicPlaying) audio.musicOn(true);
    hud.hideScreen();
    hud.setGameplayVisible(true);
    game.menu = false;
  }
  function begin() {
    game.mode = 'solo';
    setArena(false);
    beginCommon();
    if (game.state === 'start' || game.state === 'dead') {
      resetGame();
      startWave(1);
    }
    game.state = 'play';
  }
  function beginAtWave(n) {
    game.mode = 'solo';
    setArena(false);
    beginCommon();
    resetGame();
    startWave(n);
    game.state = 'play';
  }
  function jumpToWave(n) {
    enemies.clear();
    effects.clear();
    enemies.mods.speed = 1;
    enemies.mods.damage = 1;
    endFocus();
    game.intermission = 0;
    game.queue = [];
    startWave(n);
    hud.hideScreen();
    hud.setGameplayVisible(true);
    game.state = 'play';
    game.menu = false;
    audio.reelLoop(false);
  }
  function hostStart() {
    scores.clear();
    for (const [id, p] of lobby.players) scores.set(id, { name: p.name, kills: 0, deaths: 0 });
    // deal everyone a different spot, shuffled so the same people do not always start together
    setArena(true);
    const order = spawnSpots().map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const spawns = {};
    [...lobby.players.keys()].forEach((id, i) => {
      spawns[id] = order[i % order.length];
    });
    net.send('start', { spawns, map: lobby.map || runtime.state.mapKey });
    startMatch(false, spawns[net.id]);
    sendScores();
  }
  function startMatch(late, spawnIdx) {
    net.inMatch = true;
    game.mode = 'ffa';
    setArena(true);
    resetGame();
    runtime.state.matchLeft = FFA_TIME;
    runtime.state.clockT = 0;
    game.clockStarted = false;
    // nobody sends snapshots in the lobby, so the silence clock restarts here or the sweep would drop everyone
    for (const r of remote.values()) r.lastSeen = performance.now();
    if (!scores.size)
      for (const [id, p] of lobby.players) scores.set(id, { name: p.name, kills: 0, deaths: 0 });
    const spots = spawnSpots();
    player.reset(spawnIdx != null && spots[spawnIdx] ? spots[spawnIdx].clone() : arenaSpawn());
    beginCommon();
    game.state = 'play';
    runtime.state.screen = 'lobby';
    player.shieldT = 2;
    refreshScoreHud();
    hud.message(
      'FREE FOR ALL',
      late
        ? 'you joined a match in progress'
        : 'first to ' +
            FFA_TARGET +
            ' · ' +
            Math.round(FFA_TIME / 60) +
            ' minutes · everyone is fair game',
      3,
    );
    hud.tip(`hold <b>${hud.key('score')}</b> for the scoreboard`, 5);
    // a match started by someone else's click cannot grab the mouse: ask for a click
    setTimeout(() => {
      if (game.state === 'play' && !input.pointerLocked && !input.usingGamepad) {
        game.menu = true;
        showClickToPlay();
      }
    }, 250);
  }
  function pause() {
    if ((game.state !== 'play' && !(game.state === 'dying' && online())) || game.menu) return;
    if (!online()) game.state = 'pause';
    game.menu = true;
    showPause();
    audio.reelLoop(false);
  }
  function resume() {
    if (online()) {
      game.menu = false;
      if (game.state === 'dying' && game.respawnT <= 0) game.respawnArm = input.lastActive;
      hud.hideScreen();
      hud.setGameplayVisible(true);
      if (!input.usingGamepad) input.requestLock();
      return;
    }
    begin();
  }
  Object.assign(window.__game, {
    startWave,
    updateWaves,
    begin,
    beginAtWave,
    jumpToWave,
    resetGame,
    spawnPickup,
    focusCandidate,
    enterFocus,
    pickSpawn,
    startMatch,
    createLobby,
    joinLobby,
    quickPlay,
    leaveOnline,
    hostStart,
  });
  hud.onScreenClick = () => {
    const st = game.state;
    if (st === 'over') {
      if (net.isHost) {
        net.send('backtolobby', {});
        toLobbyScreen();
      }
      return;
    }
    if (st === 'lobby') return;
    if (st === 'start') {
      if (runtime.state.screen === 'main') begin();
      return;
    }
    if ((st === 'play' || st === 'dying') && game.menu) {
      resume();
      return;
    }
    if (st === 'pause' || st === 'dead') resume();
  };
  listen(canvas, 'click', () => {
    if (game.state === 'play' && !game.menu && !input.pointerLocked && !input.usingGamepad)
      input.requestLock();
  });
  input.onLockChange = (locked) => {
    if (
      !locked &&
      (game.state === 'play' || (game.state === 'dying' && online())) &&
      !game.menu &&
      !input.usingGamepad
    )
      pause();
  };
  input.onDeviceChange = (pad) => {
    hud.setDevice(pad);
    hud.setWeapon(player.weapon.name, player.weapon.hint);
  };
  listen(window, 'pagehide', () => {
    if (net.active) net.leave();
  });
  // browsers only let audio start on a gesture; any press wakes the context if it went to sleep
  for (const ev of ['pointerdown', 'keydown'])
    listen(
      window,
      ev,
      () => {
        audio.init();
        audio.resume();
      },
      { passive: true },
    );
  hud.setDevice(input.usingGamepad);
  applySettings();
  hud.setWeapon(player.weapon.name, player.weapon.hint);
  showStart();

  return {
    dispose,
    resetGame,
    beginCommon,
    begin,
    beginAtWave,
    jumpToWave,
    hostStart,
    startMatch,
    pause,
    resume,
  };
}
