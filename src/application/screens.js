import { LEVELS } from '../maps/index.js';
import { CONTROLS_HTML } from '../presentation/hud.js';
import { FFA_TARGET } from '../domain/match';
import { escapeHtml as esc } from '../presentation/html';

export function createScreens(runtime, actions = {}) {
  const audio = runtime.audio;
  const {
    hud,
    applySettings,
    preferences,
    player,
    net,
    lobby,
    game,
    online,
    setArena,
    input,
    remote,
  } = runtime;
  const {
    lobbyRows,
    friendlyError,
    quickPlay,
    createLobby,
    setStatus,
    joinLobby,
    broadcastLobby,
    hostStart,
    leaveOnline,
    beginAtWave,
    begin,
    sortedScores,
    resetGame,
  } = actions;
  // ---------------- screens ----------------
  function settingsHTML() {
    return `<div class="settings" id="settings">
    <label>look sensitivity <input type="range" id="setSens" min="25" max="250" step="5" value="${runtime.state.settings.sens}"><b id="setSensV">${runtime.state.settings.sens}%</b></label>
    <label><input type="checkbox" id="setInv" ${runtime.state.settings.invert ? 'checked' : ''}> invert vertical look</label>
    <label><input type="checkbox" id="setMus" ${runtime.state.musicWanted ? 'checked' : ''}> music <span class="k">(M)</span></label>
  </div>`;
  }
  function wireSettings() {
    const box = hud.el.panel.querySelector('#settings');
    if (!box) return;
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('keydown', (e) => e.stopPropagation());
    const sens = box.querySelector('#setSens'),
      out = box.querySelector('#setSensV');
    sens.addEventListener('input', () => {
      runtime.state.settings.sens = Number(sens.value);
      out.textContent = runtime.state.settings.sens + '%';
      applySettings();
    });
    box.querySelector('#setInv').addEventListener('change', (e) => {
      runtime.state.settings.invert = e.target.checked;
      applySettings();
    });
    box.querySelector('#setMus').addEventListener('change', (e) => {
      runtime.state.musicWanted = e.target.checked;
      preferences.write('music', runtime.state.musicWanted ? '1' : '0');
      audio.musicOn(runtime.state.musicWanted);
    });
  }
  function wireName(box) {
    const nb = box.querySelector('#setName');
    if (!nb) return;
    nb.addEventListener('input', (e) => {
      runtime.state.myName = e.target.value.trim().slice(0, 14) || runtime.state.myName;
      preferences.write('name', runtime.state.myName);
      player.name = runtime.state.myName;
      net.hostName = runtime.state.myName;
    });
  }
  function checkpointHTML() {
    if (runtime.state.checkpoint < 5) return '';
    let h = '<div class="checkpoints"><span>checkpoints</span>';
    for (let w = 5; w <= runtime.state.checkpoint; w += 5)
      h += `<button type="button" data-cp="${w}">WAVE ${w}</button>`;
    return h + '</div>';
  }
  function wireCheckpoints(onGo) {
    const box = hud.el.panel.querySelector('.checkpoints');
    if (!box) return;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('button');
      if (b) onGo(Number(b.dataset.cp));
    });
  }
  function mapHTML(sel, canPick) {
    if (LEVELS.length < 2) return '';
    return `<div class="mapsel" id="mapsel"><span>map</span>${LEVELS.map((m) => `<button type="button" class="mapbtn${m.key === sel ? ' on' : ''}" data-map="${m.key}" ${canPick ? '' : 'disabled'}>${m.name}<i>${m.blurb}</i></button>`).join('')}</div>`;
  }
  function wireMap(onPick) {
    const box = hud.el.panel.querySelector('#mapsel');
    if (!box) return;
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const b = e.target.closest('.mapbtn');
      if (b && !b.disabled) onPick(b.dataset.map);
    });
  }

  function mainHTML() {
    return `<h1>PAPER SHOOTER</h1><h2>a scribbled survival shooter</h2>
    <div class="mainbtns"><button type="button" class="start" id="soloBtn">START<i>solo · survive the waves</i></button><button type="button" id="onlineBtn">PLAY ONLINE<i>free for all · up to 10 players</i></button></div>
    ${mapHTML(runtime.state.mapKey, true)}${CONTROLS_HTML}${settingsHTML()}${checkpointHTML()}${runtime.state.best ? `<div class="beststat">best score: ${runtime.state.best}</div>` : ''}`;
  }
  function onlineHTML() {
    return `<h1>PLAY ONLINE</h1><h2>free for all · first to ${FFA_TARGET} · up to 10 players</h2>
    <div class="online" id="online">
      <div class="row"><span>your name</span><input type="text" class="namebox" id="setName" maxlength="14" value="${esc(runtime.state.myName)}"></div>
      <div class="row"><button type="button" class="big" id="quickBtn">QUICK PLAY</button><span class="hint">jumps into an open public lobby, or opens one for you</span></div>
      <div class="row split"><span>or</span></div>
      <div class="row"><button type="button" id="createBtn">CREATE LOBBY</button><div class="radio"><label><input type="radio" name="vis" value="public" ${lobby.isPublic ? 'checked' : ''}> public</label><label><input type="radio" name="vis" value="private" ${lobby.isPublic ? '' : 'checked'}> private · friends only</label></div></div>
      <div class="row"><span>have a code?</span><input type="text" id="codeBox" placeholder="CODE" maxlength="5" autocomplete="off"><button type="button" id="joinBtn">JOIN</button></div>
      <div class="lobbylist" id="lobbylist"><div class="row"><span>public lobbies</span><button type="button" class="alt" id="refreshBtn">REFRESH</button></div><div class="rows" id="lobbyRows">${lobbyListHTML()}</div></div>
      <div class="status" id="status">${esc(lobby.status || '')}</div>
      ${lobby.rejoinCode ? `<div class="row"><button type="button" class="big" id="rejoinBtn">REJOIN ${esc(lobby.rejoinCode)}</button></div>` : ''}
      <div class="row"><button type="button" class="alt" id="backBtn">BACK</button></div>
    </div>`;
  }
  function lobbyHTML() {
    const rows = lobbyRows();
    const host = net.isHost;
    const n = rows.length;
    return `<h1>LOBBY</h1><h2>free for all · first to ${FFA_TARGET} · ${n}/${net.maxPlayers} players</h2>
    <div class="online" id="online">
      <div class="row"><span>code</span><span class="code">${esc(String(net.isHost ? net.aliasCode || net.code : lobby.shown || net.code || '').replace(/-\d+$/, ''))}</span></div>
      ${mapHTML(lobby.map || runtime.state.mapKey, host)}
      <div class="hint">${lobby.isPublic ? 'this lobby is public: anyone can quick play in, or type the code' : 'private lobby: friends type this code under PLAY ONLINE → JOIN'}</div>
      <div class="plist">${rows.map((p) => `<div class="${p.id === lobby.hostId ? 'host' : ''}${p.id === net.id ? ' me' : ''}"><span>${esc(p.name)}</span><span>${p.id === net.id ? 'you' : ''}</span></div>`).join('')}</div>
      <div class="row"><button type="button" class="big" id="startBtn">START MATCH</button><button type="button" class="alt" id="leaveBtn">LEAVE</button></div>
      <div class="status" id="status">${esc(lobby.status || '')}</div><div class="hint">anyone can start · ${n < 2 ? 'people can still join once it is running' : n + ' players in'}</div>
    </div>`;
  }
  let lobbyList = null,
    listBusy = false;
  function lobbyListHTML() {
    if (listBusy) return '<div class="hint">looking…</div>';
    if (!lobbyList) return '<div class="hint">press refresh to look for open lobbies</div>';
    if (!lobbyList.length) return '<div class="hint">hit QUICK PLAY to join a lobby</div>';
    return lobbyList
      .map(
        (l) =>
          `<div class="lobbyrow"><span class="code">${esc(l.code)}</span><span>${esc(l.hostName || 'someone')}'s lobby</span><span>${esc(l.players)}/${esc(l.max)}${l.inMatch ? ' · in a match' : ''}</span>${l.full ? '<span class="status">full</span>' : `<button type="button" data-join="${esc(l.code)}">JOIN</button>`}</div>`,
      )
      .join('');
  }
  async function refreshLobbies() {
    if (listBusy || net.active) return;
    listBusy = true;
    const box = hud.el.panel.querySelector('#lobbyRows');
    if (box) box.innerHTML = lobbyListHTML();
    let err = null;
    try {
      lobbyList = await net.listLobbies({ name: runtime.state.myName });
    } catch (e) {
      lobbyList = [];
      err = e;
    }
    listBusy = false;
    const rows = hud.el.panel.querySelector('#lobbyRows');
    if (rows)
      rows.innerHTML = err
        ? `<div class="hint">could not look: ${esc(friendlyError(err))}</div>`
        : lobbyListHTML();
  }
  function wireOnline() {
    const box = hud.el.panel.querySelector('#online');
    if (!box) return;
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('keydown', (e) => e.stopPropagation());
    const q = (id) => box.querySelector('#' + id);
    wireName(box);
    if (q('quickBtn'))
      q('quickBtn').addEventListener('click', () => {
        lockButtons(box);
        quickPlay();
      });
    if (q('createBtn'))
      q('createBtn').addEventListener('click', () => {
        lockButtons(box);
        createLobby(box.querySelector('input[name=vis]:checked').value === 'public');
      });
    if (q('joinBtn')) {
      q('joinBtn').addEventListener('click', () => {
        const c = q('codeBox').value.trim().toUpperCase();
        if (!c) {
          setStatus('type the code your friend gave you');
          return;
        }
        lockButtons(box);
        joinLobby(c);
      });
      q('codeBox').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') q('joinBtn').click();
      });
    }
    if (q('rejoinBtn'))
      q('rejoinBtn').addEventListener('click', () => {
        const c = lobby.rejoinCode;
        lobby.rejoinCode = null;
        lockButtons(box);
        joinLobby(c);
      });
    if (q('backBtn'))
      q('backBtn').addEventListener('click', () => {
        lobby.status = '';
        lobby.rejoinCode = null;
        runtime.state.screen = 'main';
        showStart();
      });
    if (q('refreshBtn')) {
      q('refreshBtn').addEventListener('click', () => void refreshLobbies());
      if (!lobbyList && !listBusy) void refreshLobbies();
    }
    if (q('lobbyRows'))
      q('lobbyRows').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-join]');
        if (b) {
          lockButtons(box);
          joinLobby(b.dataset.join);
        }
      });
    wireMap((k) => {
      if (net.isHost) {
        lobby.map = k;
        broadcastLobby();
      }
    });
    if (q('startBtn'))
      q('startBtn').addEventListener('click', () => {
        if (net.isHost) hostStart();
        else {
          net.send('startreq', {});
          setStatus('asking the host to start…');
        }
      });
    if (q('leaveBtn'))
      q('leaveBtn').addEventListener('click', () => {
        lobby.rejoinCode = null;
        leaveOnline('');
      });
  }
  function lockButtons(box) {
    for (const b of box.querySelectorAll('button')) if (b.id !== 'backBtn') b.disabled = true;
  }
  function unlockButtons() {
    const box = hud.el.panel.querySelector('#online');
    if (box) for (const b of box.querySelectorAll('button')) b.disabled = false;
  }
  function renderLobby() {
    if (game.state === 'lobby') showStart();
  }
  function showStart() {
    hud.setGameplayVisible(false);
    if (game.state === 'lobby') runtime.state.screen = 'lobby';
    const html =
      runtime.state.screen === 'lobby'
        ? lobbyHTML()
        : runtime.state.screen === 'online'
          ? onlineHTML()
          : mainHTML();
    hud.showScreen(html);
    const p = hud.el.panel;
    if (runtime.state.screen === 'main') {
      wireSettings();
      wireCheckpoints((w) => beginAtWave(w));
      wireMap((k) => {
        runtime.state.mapKey = k;
        preferences.write('map', k);
        showStart();
      });
      p.querySelector('#soloBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        begin();
      });
      p.querySelector('#onlineBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        runtime.state.screen = 'online';
        showStart();
      });
    } else wireOnline();
  }
  function showPause() {
    if (online()) {
      hud.showScreen(
        `<h1>MENU</h1><h2>free for all · lobby ${esc(String(net.aliasCode || net.code || '').replace(/-\d+$/, ''))}</h2><div class="scoreboard">${sortedScores()
          .map(
            ([id, s]) =>
              `<div class="${id === net.id ? 'me' : ''}"><span>${esc(s.name)}</span><span>${esc(s.kills)} K · ${esc(s.deaths)} D</span></div>`,
          )
          .join(
            '',
          )}</div>${CONTROLS_HTML}${settingsHTML()}<div class="online" id="online"><div class="row"><button type="button" class="alt" id="leaveBtn">LEAVE MATCH</button></div></div><div class="go">CLICK ANYWHERE (or press ${hud.key('confirm')}) TO KEEP PLAYING</div>`,
      );
      wireSettings();
      wireOnline();
      return;
    }
    hud.showScreen(
      `<h1>PAUSED</h1><h2>wave ${game.wave} · score ${game.score}</h2>${CONTROLS_HTML}${settingsHTML()}${menuBtnHTML()}<div class="go">CLICK ANYWHERE (or press ${hud.key('confirm')}) TO RESUME</div>`,
    );
    wireSettings();
    wireMenuBtn();
  }
  function showClickToPlay() {
    hud.showScreen(
      `<h1>MATCH ON</h1><h2>free for all · first to ${FFA_TARGET}</h2><div class="go">CLICK ANYWHERE (or press ${hud.key('confirm')}) TO PLAY</div>`,
    );
  }
  function showDead() {
    hud.setGameplayVisible(false);
    const nb = game.score > runtime.state.best;
    if (nb) {
      runtime.state.best = game.score;
      preferences.write('best', String(runtime.state.best));
    }
    hud.showScreen(
      `<h1>ERASED</h1><div class="stats">you survived <b>${game.wave}</b> wave${game.wave === 1 ? '' : 's'} · <b>${game.kills}</b> kills · score <b>${game.score}</b>${nb ? ' · <b>NEW BEST</b>' : ` · best ${runtime.state.best}`}</div>${checkpointHTML()}${menuBtnHTML()}<div class="go">CLICK (or press ${hud.key('confirm')}) TO DRAW AGAIN</div>`,
    );
    wireCheckpoints((w) => beginAtWave(w));
    wireMenuBtn();
  }
  function menuBtnHTML() {
    return '<div class="online menubtn"><div class="row"><button type="button" class="alt" id="menuBtn">MAIN MENU</button></div></div>';
  }
  function wireMenuBtn() {
    const b = hud.el.panel.querySelector('#menuBtn');
    if (b)
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        toMainMenu();
      });
  }
  function toMainMenu() {
    game.state = 'start';
    game.mode = 'solo';
    game.menu = false;
    setArena(false);
    resetGame();
    audio.reelLoop(false);
    input.exitLock();
    hud.setGameplayVisible(false);
    runtime.state.screen = 'main';
    showStart();
  }
  function toLobbyScreen() {
    net.inMatch = false;
    for (const r of remote.values()) r.lastSeen = performance.now();
    setArena(true);
    resetGame();
    game.state = 'lobby';
    game.over = null;
    game.menu = false;
    hud.setGameplayVisible(false);
    hud.setBoard(null);
    runtime.state.screen = 'lobby';
    showStart();
  }

  return {
    settingsHTML,
    wireSettings,
    wireName,
    checkpointHTML,
    wireCheckpoints,
    mapHTML,
    wireMap,
    mainHTML,
    onlineHTML,
    lobbyHTML,
    lobbyListHTML,
    refreshLobbies,
    wireOnline,
    lockButtons,
    unlockButtons,
    renderLobby,
    showStart,
    showPause,
    showClickToPlay,
    showDead,
    menuBtnHTML,
    wireMenuBtn,
    toMainMenu,
    toLobbyScreen,
  };
}
