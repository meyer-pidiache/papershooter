import type { Vector3 } from 'three';
export interface RecoilPort {
  kick(x: number, y: number, z: number): void;
}
export interface WeaponFeedbackPort {
  recoil: RecoilPort;
  recoilRot: RecoilPort;
}
export interface CameraFeedbackPort {
  kickFov(amount: number): void;
  kickLand(amount: number): void;
  addRoll(amount: number): void;
  hurt(amount: number): void;
  flash(amount: number): void;
}
export interface MotionFeedbackPose {
  center: Vector3;
  right: Vector3;
}
export interface PlayerAudioFeedback {
  grappleFire(): void;
  shell(): void;
  winded(): void;
  empty(): void;
  grappleHit(): void;
  reelLoop(on: boolean): void;
  jump(): void;
  grappleRelease(): void;
  wallJump(): void;
  slide(): void;
  dash(): void;
  mantle(): void;
  land(impact: number): void;
  hurt(): void;
  death(): void;
  parry(): void;
  perfectParry(): void;
}
export interface PlayerFeedbackPorts {
  audio: PlayerAudioFeedback;
  input: { rumble(strong: number, weak: number, duration: number): void };
  hud: {
    tip(text: string, duration: number): void;
    message(title: string, subtitle: string, duration: number): void;
    grappleTarget(mode: number): void;
    damageFrom(angle: number): void;
  };
  effects: {
    shakeAmt: number;
    sparks(point: Vector3, normal: Vector3, ink: number, count: number, speed: number): void;
    strokeBurst(
      position: Vector3,
      ink: number,
      count: number,
      speed: number,
      options: { life: number; size: number; gravity?: number },
    ): void;
  };
  score(points: number, label: string): void;
  hitstop(duration: number, scale: number): void;
}

export interface GuardResponsePort {
  onDeflect?(perfect: boolean): void;
}
