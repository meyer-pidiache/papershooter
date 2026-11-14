import { createRuntime } from './runtime.js';
import { disposeObjects } from '../engine/resources.js';
import { audio } from '../presentation/audio.js';
import { createPickups } from './pickups.js';
import { createCombat } from './combat.js';
import { createFocus } from './focus.js';
import { createWaves } from './waves.js';
import { createMatch } from './match.js';
import { createScreens } from './screens.js';
import { createMultiplayer } from './multiplayer.js';
import { createControls } from './controls.js';
import { createLoop } from './loop.js';

// Callbacks connect controllers explicitly; factories register callbacks but do not start the loop.
export function createApplication(options = {}) {
  const runtime = createRuntime(options);
  const debug = {
    ...runtime,
    get level() {
      return runtime.state.level;
    },
    get nav() {
      return runtime.state.nav;
    },
    inspect() {
      return {
        state: runtime.game.state,
        mode: runtime.game.mode,
        map: runtime.state.level.key,
        wave: runtime.game.wave,
        hp: runtime.player.hp,
        alive: runtime.enemies.alive,
        weapon: runtime.player.weapon.kind,
      };
    },
  };
  window.__game = debug;
  const pickups = createPickups(runtime, {});
  const combat = createCombat(runtime, {
    spawnPickup: (...args) => pickups.spawnPickup(...args),
  });
  const focus = createFocus(runtime, {});
  const waves = createWaves(runtime, {
    spawnPickup: (...args) => pickups.spawnPickup(...args),
    enterFocus: (...args) => focus.enterFocus(...args),
  });
  const match = createMatch(runtime, {
    endFocus: (...args) => focus.endFocus(...args),
  });
  const screens = createScreens(runtime, {
    lobbyRows: (...args) => multiplayer.lobbyRows(...args),
    friendlyError: (...args) => multiplayer.friendlyError(...args),
    quickPlay: (...args) => multiplayer.quickPlay(...args),
    createLobby: (...args) => multiplayer.createLobby(...args),
    setStatus: (...args) => multiplayer.setStatus(...args),
    joinLobby: (...args) => multiplayer.joinLobby(...args),
    broadcastLobby: (...args) => multiplayer.broadcastLobby(...args),
    hostStart: (...args) => controls.hostStart(...args),
    leaveOnline: (...args) => multiplayer.leaveOnline(...args),
    beginAtWave: (...args) => controls.beginAtWave(...args),
    begin: (...args) => controls.begin(...args),
    sortedScores: (...args) => match.sortedScores(...args),
    resetGame: (...args) => controls.resetGame(...args),
  });
  const multiplayer = createMultiplayer(runtime, {
    renderLobby: (...args) => screens.renderLobby(...args),
    sendScores: (...args) => match.sendScores(...args),
    refreshScoreHud: (...args) => match.refreshScoreHud(...args),
    showStart: (...args) => screens.showStart(...args),
    farthestSpawnIndex: (...args) => match.farthestSpawnIndex(...args),
    startMatch: (...args) => controls.startMatch(...args),
    breakProp: (...args) => combat.breakProp(...args),
    hostStart: (...args) => controls.hostStart(...args),
    endMatch: (...args) => match.endMatch(...args),
    toLobbyScreen: (...args) => screens.toLobbyScreen(...args),
    spawnPickup: (...args) => pickups.spawnPickup(...args),
    removePickup: (...args) => pickups.removePickup(...args),
    tallyDeath: (...args) => match.tallyDeath(...args),
    applyScores: (...args) => match.applyScores(...args),
    sortedScores: (...args) => match.sortedScores(...args),
    resetGame: (...args) => controls.resetGame(...args),
    unlockButtons: (...args) => screens.unlockButtons(...args),
  });
  const controls = createControls(runtime, {
    endFocus: (...args) => focus.endFocus(...args),
    startWave: (...args) => waves.startWave(...args),
    spawnSpots: (...args) => match.spawnSpots(...args),
    sendScores: (...args) => match.sendScores(...args),
    arenaSpawn: (...args) => match.arenaSpawn(...args),
    refreshScoreHud: (...args) => match.refreshScoreHud(...args),
    showClickToPlay: (...args) => screens.showClickToPlay(...args),
    showPause: (...args) => screens.showPause(...args),
    updateWaves: (...args) => waves.updateWaves(...args),
    spawnPickup: (...args) => pickups.spawnPickup(...args),
    focusCandidate: (...args) => focus.focusCandidate(...args),
    enterFocus: (...args) => focus.enterFocus(...args),
    pickSpawn: (...args) => waves.pickSpawn(...args),
    createLobby: (...args) => multiplayer.createLobby(...args),
    joinLobby: (...args) => multiplayer.joinLobby(...args),
    quickPlay: (...args) => multiplayer.quickPlay(...args),
    leaveOnline: (...args) => multiplayer.leaveOnline(...args),
    toLobbyScreen: (...args) => screens.toLobbyScreen(...args),
    showStart: (...args) => screens.showStart(...args),
  });
  const loop = createLoop(runtime, {
    resume: (...args) => controls.resume(...args),
    pause: (...args) => controls.pause(...args),
    boardHTML: (...args) => match.boardHTML(...args),
    updateFocus: (...args) => focus.updateFocus(...args),
    endFocus: (...args) => focus.endFocus(...args),
    updatePickups: (...args) => pickups.updatePickups(...args),
    netUpdate: (...args) => multiplayer.netUpdate(...args),
    updateWaves: (...args) => waves.updateWaves(...args),
    updateArenaPickups: (...args) => pickups.updateArenaPickups(...args),
    respawnLocal: (...args) => match.respawnLocal(...args),
    showDead: (...args) => screens.showDead(...args),
    toLobbyScreen: (...args) => screens.toLobbyScreen(...args),
  });

  runtime.game.onPlayerDeath = () => {
    focus.endFocus();
    match.onLocalDeath();
  };
  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    loop.stop();
    controls.dispose();
    runtime.net.leave();
    runtime.input.dispose?.();
    runtime.player.clearNades();
    runtime.enemies.clear();
    runtime.effects.clear();
    for (const remote of runtime.remote.values()) remote.dispose();
    runtime.remote.clear();
    audio.musicOn(false);
    audio.reelLoop(false);
    disposeObjects([...runtime.R.scene.children], runtime.R.scene);
    runtime.R.dispose?.();
    if (window.__game === debug) delete window.__game;
  }
  if (options.autoStart !== false) loop.start();
  return {
    runtime,
    pickups,
    combat,
    focus,
    waves,
    match,
    screens,
    multiplayer,
    controls,
    loop,
    dispose,
  };
}
