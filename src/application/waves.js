import { KATANA_CHARGE_KILLS } from '../domain/focus.js';
import * as THREE from 'three';
import { BOSSES } from '../gameplay/enemies.js';
import { choose, clamp } from '../engine/math.js';
import { planWave, bossFor, enemyName } from '../domain/waves';

export function createWaves(runtime, actions = {}) {
  const audio = runtime.audio;
  const { hud, game, enemies, player, preferences, world, net } = runtime;
  const { spawnPickup, enterFocus } = actions;
  // ---------------- solo waves ----------------
  const tips = () => [
    `hold <b>${hud.key('grapple')}</b> to reel in · tap it again to let go mid-swing`,
    `block with <b>${hud.key('block')}</b> and some of their bullets go back at them`,
    'kills in the air are worth more · stay off the floor',
    `<b>${hud.key('grenade')}</b> lobs a grenade · pickups give you more`,
    `press <b>${hud.key('jump')}</b> again in the air for a double jump`,
  ];
  function startWave(n) {
    game.wave = n;
    game.queue = [];
    game.spawnT = 2;
    game.intermission = 0;
    game.boss = null;
    hud.setBoss(null, null);
    const plan = planWave(n);
    const { boss } = plan;
    game.queue = plan.queue;
    game.maxAlive = plan.maxAlive;
    enemies.mods.speed = plan.speed;
    enemies.mods.damage = plan.damage;
    const mod = { name: plan.modifier };
    hud.setModifier(mod.name);
    if (boss) {
      hud.message('WAVE ' + n, enemyName(bossFor(n)) + ' IS COMING', 3);
      audio.bossRoar(player.center);
    } else
      hud.message(
        'WAVE ' + n,
        n === 1
          ? 'they are crawling off the page'
          : mod.name ||
              choose([
                'ink harder',
                'keep scribbling',
                'stay off the ground',
                'swing for it',
                'return their bullets',
              ]),
        2.6,
      );
    audio.wave();
    if (n <= tips().length) hud.tip(tips()[n - 1], 7);
    player.grenades = Math.min(player.maxGrenades, player.grenades + 1);
    for (let i = 0; i < 7; i++)
      spawnPickup(i < 5 ? 'ammo' : 'health', choose(runtime.state.level.pickups));
    if (n >= 5 && n % 5 === 0 && n > runtime.state.checkpoint) {
      runtime.state.checkpoint = n;
      preferences.write('checkpoint', String(n));
      hud.kill('CHECKPOINT · WAVE ' + n, 0);
    }
  }
  function pickSpawn(type) {
    const spots = type === 'sniper' ? runtime.state.level.snipers : runtime.state.level.spawns;
    const pp = player.body.pos;
    if (type === 'flyer') {
      const a = Math.random() * Math.PI * 2,
        r = 22 + Math.random() * 10;
      return new THREE.Vector3(
        clamp(
          pp.x + Math.cos(a) * r,
          runtime.state.level.bounds.minX + 4,
          runtime.state.level.bounds.maxX - 4,
        ),
        pp.y + 12 + Math.random() * 6,
        clamp(
          pp.z + Math.sin(a) * r,
          runtime.state.level.bounds.minZ + 4,
          runtime.state.level.bounds.maxZ - 4,
        ),
      );
    }
    if (BOSSES.includes(type)) {
      const fits = (sp) =>
        !world.overlapsAABB(
          { x: sp.x - 1.1, y: sp.y + 0.1, z: sp.z - 1.1 },
          { x: sp.x + 1.1, y: sp.y + 5.2, z: sp.z + 1.1 },
        );
      const open = spots.filter((sp) => fits(sp));
      const far = open.filter((sp) => sp.distanceTo(pp) > 20);
      if (far.length) return choose(far).clone();
      if (open.length) return choose(open).clone();
      for (let i = 0; i < 200; i++) {
        const a = Math.random() * Math.PI * 2,
          r = 22 + Math.random() * 18;
        const c = new THREE.Vector3(
          clamp(pp.x + Math.cos(a) * r, -44, 44),
          0,
          clamp(pp.z + Math.sin(a) * r, -44, 44),
        );
        c.y = world.groundBelow(c.x, 30, c.z, 40);
        if (c.y > -3 && fits(c)) return c;
      }
      return runtime.state.level.playerStart.clone();
    }
    let cands = spots.filter((s) => {
      const d = s.distanceTo(pp);
      return d > 14 && d < 48;
    });
    if (cands.length < 2) cands = spots.filter((s) => s.distanceTo(pp) > 14);
    const hidden = cands.filter(
      (s) => !world.hasLineOfSight(player.eye, new THREE.Vector3(s.x, s.y + 1.2, s.z)),
    );
    return choose(hidden.length ? hidden : cands.length ? cands : spots).clone();
  }
  function updateWaves(dt) {
    if (game.intermission > 0) {
      game.intermission -= dt;
      hud.setTimer('next wave in ' + Math.ceil(game.intermission));
      if (game.intermission <= 0) {
        hud.setTimer('');
        startWave(game.wave + 1);
      }
      return;
    }
    if (game.queue.length && enemies.alive < game.maxAlive) {
      game.spawnT -= dt;
      if (game.spawnT <= 0) {
        game.spawnT = Math.max(0.7, 2.9 - game.wave * 0.13);
        const t = game.queue.shift();
        const e = enemies.spawn(t, pickSpawn(t));
        if (e.T.boss) {
          const mul = 1 + 0.35 * Math.floor((game.wave - 5) / 15);
          e.hp = e.maxHp = Math.round(e.T.hp * mul);
        }
      }
    }
    if (!game.queue.length && enemies.alive === 0) {
      game.intermission = 8;
      hud.message('WAVE ' + game.wave + ' CLEARED', 'catch your breath · +' + 200 * game.wave, 2.5);
      game.addScore(200 * game.wave, null);
      audio.waveClear();
      player.hp = Math.min(player.maxHp, player.hp + 40);
    }
    hud.setWave(game.wave, enemies.alive + game.queue.length);
  }
  enemies.onKill = (e, info, over) => {
    game.kills++;
    game.combo++;
    game.comboT = 3.5;
    let label = e.T.name,
      pts = e.T.score;
    if (info.crit) {
      label = 'HEADSHOT';
      pts += 60;
    }
    if (info.source === 'katana') {
      label = over ? 'SLICED' : 'CUT DOWN';
      pts += 50;
    }
    if (info.source === 'focus') {
      label = 'EXECUTED';
      pts += 150;
    }
    if (info.source === 'katana' || info.source === 'focus') {
      game.katanaStreak++;
      player.weapons[player.katanaIndex].addBlood(0.42);
      if (game.katanaStreak >= KATANA_CHARGE_KILLS) enterFocus();
    } else if (info.source !== 'blast') game.katanaStreak = 0;
    if (info.source === 'deflect') {
      label = 'RETURN TO SENDER';
      pts += 120;
    }
    if (info.source === 'fall') label = 'FELL OFF THE PAGE';
    else if (!player.body.onGround && info.source !== 'deflect') {
      label += ' · AIRBORNE';
      pts += 40;
    }
    game.addScore(pts, label);
    audio.kill(!!info.crit || e.T.boss);
    const r = Math.random();
    if (r < 0.5) spawnPickup('ammo', e.body.pos);
    else if (r < 0.62) spawnPickup('health', e.body.pos);
  };
  enemies.onBoss = (e) => {
    if (!e.alive) {
      hud.setBoss(null, null);
      game.boss = null;
    } else {
      game.boss = e;
      hud.setBoss(e.T.name, e.hp / e.maxHp);
    }
  };
  player.onThrow = (d) => {
    if (net.active) net.broadcast('nade', d);
  };

  return { tips, startWave, pickSpawn, updateWaves };
}
