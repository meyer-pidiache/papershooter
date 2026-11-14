import { FOCUS_SCALE, KATANA_CHARGE_KILLS } from '../domain/focus.js';
import { clamp } from '../engine/math.js';

export function createLoop(runtime, actions = {}) {
  const audio = runtime.audio;
  const { net, input, game, hud, online, preferences, player, enemies, effects, remote, R } =
    runtime;
  const {
    resume,
    pause,
    boardHTML,
    updateFocus,
    endFocus,
    updatePickups,
    netUpdate,
    updateWaves,
    updateArenaPickups,
    respawnLocal,
    showDead,
    toLobbyScreen,
  } = actions;
  // ---------------- loop ----------------
  let last = performance.now(),
    boardToggle = false,
    lockTipT = 0.5,
    musicHealT = 2;
  function tick(now) {
    if (!running) return;
    frameId = requestAnimationFrame(tick);
    step(now);
  }
  // browsers starve animation frames in hidden tabs; a host that alt-tabs would freeze everyone's
  // match, so a coarse timer runs extra steps (never extra frame chains) while that happens
  function handleMenuInput(st) {
    if (['start', 'pause', 'dead', 'over'].includes(st)) {
      if (
        input.pressed('jump') ||
        input.pressed('confirm') ||
        (st === 'pause' && input.pressed('pause'))
      )
        hud.onScreenClick();
      return;
    }
    if ((st === 'play' || (st === 'dying' && online())) && input.pressed('pause')) {
      if (game.menu) resume();
      else {
        pause();
        input.exitLock();
      }
      return;
    }
    if (
      (st === 'play' || st === 'dying') &&
      game.menu &&
      (input.pressed('jump') || input.pressed('confirm'))
    )
      resume();
  }

  function updateMusicInput() {
    if (!input.pressed('music')) return;
    runtime.state.musicWanted = !runtime.state.musicWanted;
    preferences.write('music', runtime.state.musicWanted ? '1' : '0');
    audio.musicOn(runtime.state.musicWanted);
    hud.tip(runtime.state.musicWanted ? 'music on' : 'music off', 1.5);
  }

  function updateBoard(playing) {
    if (!online() || !playing) {
      boardToggle = false;
      return;
    }
    if (input.usingGamepad && input.pressed('score')) boardToggle = !boardToggle;
    const want = ((input.down('score') && !input.usingGamepad) || boardToggle) && !game.menu;
    if (want !== !hud.el.board.hidden) hud.setBoard(want ? boardHTML() : null);
  }

  function updateCursorHint(st, dt) {
    if (st !== 'play' || game.menu || input.pointerLocked || input.usingGamepad) return;
    lockTipT -= dt;
    if (lockTipT <= 0) {
      lockTipT = 2.5;
      hud.tip('click the page to grab the mouse', 2);
    }
  }

  function timeScale(dt) {
    if (game.hitstopT > 0) {
      game.hitstopT -= dt;
      return game.hitstopScale;
    }
    return game.focus.active ? FOCUS_SCALE : 1;
  }

  function recoverMusic(st, dt) {
    musicHealT -= dt;
    if (musicHealT > 0) return;
    musicHealT = 2;
    if (runtime.state.musicWanted && st === 'play' && !audio.musicPlaying && audio.ctx)
      audio.musicOn(true);
    if (input.anyInput) audio.resume();
  }

  function enforceBounds() {
    const bounds = runtime.state.level.bounds;
    const pos = player.body.pos;
    if (
      pos.x < bounds.minX - 8 ||
      pos.x > bounds.maxX + 8 ||
      pos.z < bounds.minZ - 8 ||
      pos.z > bounds.maxZ + 8 ||
      pos.y > 150
    )
      pos.y = -100;
  }

  function updateCombo(dt) {
    if (game.comboT <= 0) return;
    game.comboT -= dt;
    if (game.comboT <= 0) {
      game.combo = 0;
      hud.setScore(game.score, 0);
    }
  }

  function updateRespawn(dt) {
    const before = Math.ceil(game.respawnT);
    game.respawnT -= dt;
    const left = Math.ceil(game.respawnT);
    if (left > 0) {
      if (left !== before || game.deathT <= dt)
        hud.message(String(left), 'back on the page in', 1.1);
      return;
    }
    if (before > 0) {
      game.respawnArm = input.lastActive;
      game.promptT = 0;
      return;
    }
    if (game.menu) return;
    game.promptT -= dt;
    if (game.promptT <= 0) {
      game.promptT = 1.4;
      hud.message('READY', `press ${hud.key('confirm')} · any button or click to respawn`, 1.5);
    }
    if (input.lastActive !== game.respawnArm && !input.pressed('pause') && !input.down('pause'))
      respawnLocal();
  }

  function updateDeath(st, dt) {
    if (st !== 'dying') return;
    game.deathT += dt;
    if (online()) updateRespawn(dt);
    else if (game.deathT > 1.7) {
      game.state = 'dead';
      showDead();
      input.exitLock();
    }
  }

  function updateSimulation(st, dt, sdt) {
    game.time += sdt;
    if (player.shieldT > 0) player.shieldT -= dt;
    recoverMusic(st, dt);
    enforceBounds();
    player.update(sdt);
    enemies.update(sdt);
    effects.update(sdt);
    updatePickups(sdt);
    netUpdate(dt);
    if (st === 'play' && !online()) updateWaves(sdt);
    if (online()) updateArenaPickups(dt);
    updateCombo(sdt);
    updateDeath(st, dt);
  }

  function updateIdle(st, dt) {
    game.time += dt;
    if (['start', 'dead', 'lobby', 'over'].includes(st)) player.idleCam(game.time);
    effects.update(dt);
    if (net.active) netUpdate(dt);
    if (st !== 'over') return;
    game.overT += dt;
    if (net.isHost && game.overT > 8) {
      net.send('backtolobby', {});
      toLobbyScreen();
    } else if (!net.isHost && game.overT > 15) toLobbyScreen();
  }

  function updateBossHud() {
    if (!game.boss) return;
    if (game.boss.alive) hud.setBoss(game.boss.T.name, game.boss.hp / game.boss.maxHp);
    else {
      hud.setBoss(null, null);
      game.boss = null;
    }
  }

  function updateHud(playing, dt) {
    const weapon = player.weapon;
    if (weapon.isGun) hud.setAmmo(weapon.mag, weapon.reserve, weapon.magSize, weapon.reloading);
    else hud.setKatana();
    hud.setSlots(
      player.weapons.map((item, index) => ({
        name: item.name,
        active: index === player.weaponIndex,
        ammo: item.isGun ? item.mag + '/' + item.reserve : '∞',
        empty: item.isGun && item.mag === 0 && item.reserve === 0,
      })),
    );
    hud.setGrenades(player.grenades);
    hud.setGrappleStamina(player.grapStam);
    hud.setHealth(player.hp, player.maxHp);
    hud.setSpread(weapon.spreadPx);
    hud.update(dt);
    if (online()) hud.setFocusMeter(playing, player.grapStam, false, 'GRAPPLE');
    else
      hud.setFocusMeter(
        playing && (weapon.kind === 'katana' || game.katanaStreak > 0 || game.focus.active),
        game.focus.active ? 1 : clamp(game.katanaStreak / KATANA_CHARGE_KILLS, 0, 1),
        game.focus.active,
        'KATANA',
      );
    updateBossHud();
  }

  function present(playing, dt, scale) {
    for (const animation of runtime.state.level.animated) animation.update(game.time);
    audio.setListener(player.eye, player.right);
    updateHud(playing, dt);
    audio.setIntensity(
      clamp((enemies.alive + game.queue.length + remote.size * 2) / 12, 0, 1) *
        (game.intermission > 0 ? 0.25 : 1),
    );
    R.render(game.time, {
      hurt: player.hurtFx,
      flash: player.flashFx,
      slow: scale < 1 ? 1 : 0,
      lowHp: player.alive && player.hp < 30 ? 1 - player.hp / 30 : 0,
    });
  }

  function step(now) {
    // Preserve the original variable step and its 50 ms cap; changing integration would change feel.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    input.update(dt);
    const st = game.state;
    const playing = st === 'play' || st === 'dying';
    handleMenuInput(st);
    updateMusicInput();
    updateBoard(playing);
    updateCursorHint(st, dt);
    const scale = timeScale(dt);
    if (st === 'play' && !online()) updateFocus(dt);
    else endFocus();
    if (playing) updateSimulation(st, dt, dt * scale);
    else updateIdle(st, dt);
    present(playing, dt, scale);
  }

  let running = false,
    frameId = 0,
    backgroundTimer = null;
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    frameId = requestAnimationFrame(tick);
    backgroundTimer = setInterval(() => {
      if (net.active && performance.now() - last > 300) step(performance.now());
    }, 250);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
    clearInterval(backgroundTimer);
  }

  return { tick, step, start, stop };
}
