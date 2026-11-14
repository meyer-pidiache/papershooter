import { SceneResources } from '../engine/resources.js';
import { Decals } from './effects/decals.js';
import { ParticleRenderer } from './effects/particle-renderer.js';
import { ParticleSimulation } from './effects/particles.js';
import { DebrisSimulation } from './effects/debris.js';
import * as recipes from './effects/particle-recipes.js';
import * as blasts from './effects/blast-recipes.js';
import { INK } from '../shared/ink.js';
import { rand } from '../engine/math.js';
export class Effects {
  constructor(scene, world, resources = new SceneResources()) {
    this.renderer = new ParticleRenderer(scene, resources);
    this.decals = new Decals(scene, world, resources);
    this.simulation = new ParticleSimulation(world, this.decals);
    this.fragments = new DebrisSimulation(scene, world, resources, this.decals, this.simulation);
    this.shakeAmt = 0;
    this.disposed = false;
  }
  get particles() {
    return this.simulation.list;
  }
  get debrisList() {
    return this.fragments.list;
  }
  get gibsAlive() {
    return this.fragments.gibsAlive;
  }
  clear() {
    this.simulation.clear();
    this.decals.clear();
    this.fragments.clear();
    this.renderer.clear();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.decals.dispose();
    this.renderer.dispose();
  }
  update(dt) {
    this.simulation.update(dt);
    this.decals.update(dt);
    this.fragments.update(dt);
    this.renderer.render(this.simulation.list);
  }
  particle(...args) {
    return this.simulation.spawn(...args);
  }
  debris(...args) {
    return this.fragments.spawn(...args);
  }
  decal(point, normal, ink = INK.RED, size = 0.3, kind = 'splat', dir = null, stretch = 1) {
    return this.decals.decal(point, normal, ink, size, kind, dir, stretch);
  }
  splat(point, normal, ink = INK.RED, size = 0.5, dir = null, cluster = 3) {
    return this.decals.splat(point, normal, ink, size, dir, cluster);
  }
  bloodPool(pos, size = 1.3, ink = INK.RED) {
    return this.decals.bloodPool(pos, size, ink);
  }
  sparks(point, normal, ink = INK.BLUE, n = 6, speed = 7) {
    return recipes.sparks(this.simulation, point, normal, ink, n, speed);
  }
  strokeBurst(pos, ink, n = 16, speed = 6, opts = {}) {
    return recipes.strokeBurst(this.simulation, pos, ink, n, speed, opts);
  }
  tracer(from, to, ink = INK.BLUE, thick = 0.022, life = 0.06) {
    return recipes.tracer(this.simulation, from, to, ink, thick, life);
  }
  blood(pos, dir, amount = 1, opts = {}) {
    return recipes.blood(this.simulation, pos, dir, amount, opts);
  }
  drip(pos, amount = 1) {
    return recipes.drip(this.simulation, pos, amount);
  }
  fountain(pos, dir, dur = 0.8, ink = INK.RED) {
    return recipes.fountain(this.simulation, pos, dir, dur, ink);
  }
  shell(pos, vel, ink = INK.ORANGE, size = 0.02) {
    return recipes.shell(this.simulation, pos, vel, ink, size);
  }
  smoke(pos, dir, n = 3) {
    return recipes.smoke(this.simulation, pos, dir, n);
  }
  boom(pos, radius = 5) {
    this.shakeAmt += blasts.boom(this.simulation, this.decals, pos, radius);
  }
  explosion(pos, radius = 4, ink = INK.BLACK) {
    this.shakeAmt += blasts.explosion(this.simulation, this.decals, pos, radius, ink);
  }
  bulletImpact(point, normal, ink = INK.BLUE) {
    this.decal(point, normal, ink, rand(0.06, 0.1), 'hole');
    this.sparks(point, normal, ink, 5);
  }
}
