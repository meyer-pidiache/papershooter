import { Vector3, type Object3D } from 'three';
import { rand } from '../../engine/math.js';
import type { RaycastPort } from '../../engine/ports.js';

export interface GrenadePose {
  eye: Vector3;
  forward: Vector3;
  right: Vector3;
  velocity: Vector3;
}
export interface GrenadePacket {
  pos: number[];
  vel: number[];
}
export interface GrenadeVisualPort {
  create(position: Vector3): Object3D;
  remove(model: Object3D): void;
  hideArc(): void;
  showArc(charge: number, position: Vector3, velocity: Vector3): void;
}
export interface GrenadeProjectile {
  mesh: Object3D;
  pos: Vector3;
  vel: Vector3;
  ang: Vector3;
  fuse: number;
  mine: boolean;
  rest: boolean;
  tick: number;
}
export interface GrenadeFeedback {
  thrown(packet: GrenadePacket): void;
  bounce(): void;
  fuse(position: Vector3): void;
}

// Owns inventory, charging and projectile lifetime. No access to Player, weapons or match state.
export class Grenades {
  stock = 3;
  readonly maximum = 5;
  charge = 0;
  private held = false;
  private cooldown = 0;
  readonly projectiles: GrenadeProjectile[] = [];
  onThrow: ((packet: GrenadePacket) => void) | null = null;
  onExplosion: ((position: Vector3, mine: boolean) => void) | null = null;
  private readonly previous = new Vector3();
  private readonly direction = new Vector3();
  private readonly previewPosition = new Vector3();
  private readonly previewVelocity = new Vector3();
  constructor(
    private readonly world: RaycastPort,
    private readonly visuals: GrenadeVisualPort,
    private readonly feedback: GrenadeFeedback,
  ) {}
  reset() {
    this.cancelCharge();
    this.stock = 3;
    this.clear();
  }
  cancelCharge() {
    this.charge = 0;
    this.held = false;
    this.visuals.hideArc();
  }
  clear() {
    for (const projectile of this.projectiles) this.visuals.remove(projectile.mesh);
    this.projectiles.length = 0;
  }
  updateInput(dt: number, pressed: boolean, alive: boolean, locked: boolean, pose: GrenadePose) {
    this.cooldown -= dt;
    if (pressed && this.stock > 0 && this.cooldown <= 0 && alive && !locked) {
      this.charge = Math.min(1, this.charge + dt / 1.1);
      this.held = true;
    } else if (this.held) {
      this.held = false;
      if (this.stock > 0 && this.cooldown <= 0 && alive) this.throw(null, this.charge, pose);
      this.charge = 0;
    }
    this.updateArc(this.held ? this.charge : -1, pose);
    this.update(dt);
  }
  private launch(charge: number, pose: GrenadePose, position: Vector3, velocity: Vector3) {
    position.copy(pose.eye).addScaledVector(pose.right, 0.25).addScaledVector(pose.forward, 0.6);
    position.y -= 0.15;
    velocity
      .copy(pose.forward)
      .multiplyScalar(9 + 20 * charge)
      .addScaledVector(pose.velocity, 0.5);
    velocity.y += 3.5 + 2.5 * charge;
  }
  throw(remote: GrenadePacket | null, charge: number, pose: GrenadePose) {
    const pos = new Vector3(),
      vel = new Vector3();
    if (remote) {
      pos.fromArray(remote.pos);
      vel.fromArray(remote.vel);
    } else {
      this.stock--;
      this.cooldown = 0.55;
      this.launch(charge, pose, pos, vel);
      const packet = {
        pos: pos.toArray().map((v) => +v.toFixed(2)),
        vel: vel.toArray().map((v) => +v.toFixed(2)),
      };
      this.feedback.thrown(packet);
      this.onThrow?.(packet);
    }
    const mesh = this.visuals.create(pos);
    this.projectiles.push({
      mesh,
      pos,
      vel,
      ang: new Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)),
      fuse: 1.7,
      mine: !remote,
      rest: false,
      tick: 0,
    });
  }
  updateArc(charge: number, pose: GrenadePose) {
    if (charge >= 0) this.launch(charge, pose, this.previewPosition, this.previewVelocity);
    this.visuals.showArc(charge, this.previewPosition, this.previewVelocity);
  }
  update(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      projectile.fuse -= dt;
      projectile.tick += dt;
      if (!projectile.rest) this.integrate(projectile, dt);
      const frequency = projectile.fuse < 0.8 ? 14 : 5;
      if (
        Math.floor(projectile.tick * frequency) !== Math.floor((projectile.tick - dt) * frequency)
      )
        this.feedback.fuse(projectile.pos);
      if (projectile.fuse <= 0) {
        const point = projectile.pos.clone();
        point.y += 0.25;
        this.onExplosion?.(point, projectile.mine);
        this.visuals.remove(projectile.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }
  private integrate(projectile: GrenadeProjectile, dt: number) {
    const n = projectile;
    n.vel.y -= 22 * dt;
    this.previous.copy(n.pos);
    n.pos.addScaledVector(n.vel, dt);
    this.direction.subVectors(n.pos, this.previous);
    const len = this.direction.length();
    if (len > 1e-6) {
      this.direction.divideScalar(len);
      const hit = this.world.raycast(this.previous, this.direction, len + 0.16);
      if (hit) {
        n.pos.copy(hit.point).addScaledVector(hit.normal, 0.16);
        const vn = n.vel.dot(hit.normal);
        if (vn < 0) {
          n.vel.addScaledVector(hit.normal, -1.45 * vn);
          n.vel.multiplyScalar(0.55);
          n.ang.multiplyScalar(0.6);
          this.feedback.bounce();
        }
        if (n.vel.length() < 1.2 && hit.normal.y > 0.5) {
          n.rest = true;
          n.vel.set(0, 0, 0);
        }
      }
    }
    n.mesh.rotation.x += n.ang.x * dt;
    n.mesh.rotation.y += n.ang.y * dt;
    n.mesh.rotation.z += n.ang.z * dt;
    n.mesh.position.copy(n.pos);
  }
}
