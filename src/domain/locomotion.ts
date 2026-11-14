interface PlanarVelocity {
  x: number;
  z: number;
}
interface PlanarFrame {
  grounded: boolean;
  sliding: boolean;
  landGraceT: number;
  wish: { x: number; z: number };
  wishLen: number;
  maxSpeed: number;
  hspeed: number;
}

// Deterministic planar forces. Mutates only the supplied velocity; no input/browser/entity access.
export function acceleratePlanar(velocity: PlanarVelocity, frame: PlanarFrame, dt: number) {
  const { hspeed, wish, wishLen, maxSpeed } = frame;
  if (!frame.grounded) {
    if (wishLen <= 0) return;
    const current = velocity.x * wish.x + velocity.z * wish.z;
    const add = Math.min(7.5 * wishLen - current, 36 * dt);
    if (add > 0) {
      velocity.x += wish.x * add;
      velocity.z += wish.z * add;
    }
    return;
  }
  if (frame.sliding) {
    if (hspeed > 0) {
      const next = Math.max(0, hspeed - 6.5 * dt) / hspeed;
      velocity.x *= next;
      velocity.z *= next;
    }
    if (wishLen > 0) {
      velocity.x += wish.x * 6 * dt;
      velocity.z += wish.z * 6 * dt;
      const next = Math.hypot(velocity.x, velocity.z);
      if (next > hspeed && next > 0) {
        velocity.x *= hspeed / next;
        velocity.z *= hspeed / next;
      }
    }
    return;
  }
  const friction = 8 * (frame.landGraceT > 0 ? 0.25 : 1);
  if (hspeed > 0) {
    const next = Math.max(0, hspeed - hspeed * friction * dt) / hspeed;
    velocity.x *= next;
    velocity.z *= next;
  }
  if (wishLen > 0) {
    const current = velocity.x * wish.x + velocity.z * wish.z;
    const add = Math.min(maxSpeed * wishLen - current, 140 * dt);
    if (add > 0) {
      velocity.x += wish.x * add;
      velocity.z += wish.z * add;
    }
  }
}
