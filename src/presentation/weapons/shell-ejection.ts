import { Vector3, type Object3D } from 'three';
import { rand } from '../../engine/math.js';
interface EjectionPose {
  right: Vector3;
  forward: Vector3;
}
export class ShellEjection {
  private readonly position = new Vector3();
  private readonly velocity = new Vector3();
  constructor(
    private readonly point: Object3D,
    private readonly shell: [number, number] | null,
    private readonly pose: () => EjectionPose,
    private readonly emit: (point: Vector3, velocity: Vector3, ink: number, size: number) => void,
  ) {}
  eject(spread = 1) {
    if (!this.shell) return;
    const pose = this.pose();
    this.point.getWorldPosition(this.position);
    this.velocity
      .copy(pose.right)
      .multiplyScalar(rand(1.5, 2.5) * spread)
      .addScaledVector(pose.forward, rand(-0.5, 0.5));
    this.velocity.y += rand(1.5, 2.8);
    this.emit(this.position, this.velocity, this.shell[1], this.shell[0]);
  }
}
