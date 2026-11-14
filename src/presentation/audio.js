import { SoundSynth } from './audio/synth.js';
import { MusicScheduler } from './audio/music.js';
import { ReelSound } from './audio/reel.js';
import * as weapons from './audio/weapons-sounds.js';
import * as movement from './audio/movement-sounds.js';
import * as feedback from './audio/feedback-sounds.js';

// Gameplay-facing audio commands. Each stateful subsystem owns its own lifetime.
export class Sfx {
  constructor() {
    this.synth = new SoundSynth();
    this.music = new MusicScheduler(this.synth);
    this.reel = new ReelSound(this.synth);
  }
  get ctx() {
    return this.synth.ctx;
  }
  init() {
    this.synth.init();
  }
  resume() {
    this.synth.resume();
  }
  dispose() {
    this.music.dispose();
    this.reel.dispose();
    this.synth.dispose();
  }
  setListener(pos, right) {
    this.synth.setListener(pos, right);
  }
  musicOn(on) {
    this.music.setPlaying(on);
  }
  get musicPlaying() {
    return this.music.playing;
  }
  setIntensity(value) {
    this.music.setIntensity(value);
  }
  setTune(key) {
    this.music.setTune(key);
  }
  reelLoop(on) {
    this.reel.setPlaying(on);
  }
  shot() {
    weapons.shot(this.synth);
  }
  remoteShot(kind, pos) {
    weapons.remoteShot(this.synth, kind, pos);
  }
  enemyShot(pos) {
    weapons.enemyShot(this.synth, pos);
  }
  shotgun(pos) {
    weapons.shotgun(this.synth, pos);
  }
  sniperShot(pos) {
    weapons.sniperShot(this.synth, pos);
  }
  sniperAim(pos) {
    weapons.sniperAim(this.synth, pos);
  }
  empty() {
    weapons.empty(this.synth);
  }
  reload() {
    weapons.reload(this.synth);
  }
  katanaSwing() {
    weapons.katanaSwing(this.synth);
  }
  katanaHit() {
    weapons.katanaHit(this.synth);
  }
  parry() {
    weapons.parry(this.synth);
  }
  perfectParry() {
    weapons.perfectParry(this.synth);
  }
  shotgunFire() {
    weapons.shotgunFire(this.synth);
  }
  revolver() {
    weapons.revolver(this.synth);
  }
  sniperFire() {
    weapons.sniperFire(this.synth);
  }
  focusIn() {
    weapons.focusIn(this.synth);
  }
  focusSlash() {
    weapons.focusSlash(this.synth);
  }
  pump() {
    weapons.pump(this.synth);
  }
  shell() {
    weapons.shell(this.synth);
  }
  cylinder() {
    weapons.cylinder(this.synth);
  }
  winded() {
    movement.winded(this.synth);
  }
  grappleFire() {
    movement.grappleFire(this.synth);
  }
  grappleHit() {
    movement.grappleHit(this.synth);
  }
  grappleRelease() {
    movement.grappleRelease(this.synth);
  }
  footstep(speedFrac = 1) {
    movement.footstep(this.synth, speedFrac);
  }
  jump() {
    movement.jump(this.synth);
  }
  land(hard = 0.5) {
    movement.land(this.synth, hard);
  }
  slide() {
    movement.slide(this.synth);
  }
  wallJump() {
    movement.wallJump(this.synth);
  }
  mantle() {
    movement.mantle(this.synth);
  }
  dash() {
    movement.dash(this.synth);
  }
  lunge(pos) {
    movement.lunge(this.synth, pos);
  }
  hurt() {
    feedback.hurt(this.synth);
  }
  death() {
    feedback.death(this.synth);
  }
  hitEnemy(pos) {
    feedback.hitEnemy(this.synth, pos);
  }
  headshot(pos) {
    feedback.headshot(this.synth, pos);
  }
  kill(strong = false) {
    feedback.kill(this.synth, strong);
  }
  enemyDie(pos) {
    feedback.enemyDie(this.synth, pos);
  }
  gib(pos) {
    feedback.gib(this.synth, pos);
  }
  splat(pos) {
    feedback.splat(this.synth, pos);
  }
  spawn(pos) {
    feedback.spawn(this.synth, pos);
  }
  bulletImpact(pos) {
    feedback.bulletImpact(this.synth, pos);
  }
  ricochet(pos) {
    feedback.ricochet(this.synth, pos);
  }
  pickup() {
    feedback.pickup(this.synth);
  }
  wave() {
    feedback.wave(this.synth);
  }
  waveClear() {
    feedback.waveClear(this.synth);
  }
  tick() {
    feedback.tick(this.synth);
  }
  hitstop() {
    feedback.hitstop(this.synth);
  }
  switchWeapon() {
    feedback.switchWeapon(this.synth);
  }
  heartbeat() {
    feedback.heartbeat(this.synth);
  }
  explosion(pos) {
    feedback.explosion(this.synth, pos);
  }
  fuse(pos) {
    feedback.fuse(this.synth, pos);
  }
  flyerDive(pos) {
    feedback.flyerDive(this.synth, pos);
  }
  flyerBuzz(pos) {
    feedback.flyerBuzz(this.synth, pos);
  }
  stomp(pos) {
    feedback.stomp(this.synth, pos);
  }
  bossRoar(pos) {
    feedback.bossRoar(this.synth, pos);
  }
  shieldHit(pos) {
    feedback.shieldHit(this.synth, pos);
  }
  airdrop() {
    feedback.airdrop(this.synth);
  }
  crateLand(pos) {
    feedback.crateLand(this.synth, pos);
  }
  smash(pos, big = false) {
    feedback.smash(this.synth, pos, big);
  }
}
