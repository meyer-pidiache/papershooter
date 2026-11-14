export interface WeaponFrame {
  fire: boolean;
  firePressed: boolean;
  aim: boolean;
  reloadPressed: boolean;
  meleePressed: boolean;
  sprinting: boolean;
  grounded: boolean;
  speed: number;
  sliding: boolean;
  lookDelta: { x: number; y: number };
  strafe: number;
  bobPhase: number;
  bobAmt: number;
  landDip: number;
  slideTilt: number;
  blockFire: boolean;
}
export interface WeaponPose {
  aiming: boolean;
  sprinting: boolean;
  grounded: boolean;
  speed: number;
  sliding: boolean;
  lookDelta: { x: number; y: number };
  strafe: number;
  bobPhase: number;
  bobAmt: number;
  landDip: number;
  alive: boolean;
}

export interface PumpFrame {
  progress: number;
  finished: boolean;
}

export interface SwingFrame {
  progress: number;
  direction: 1 | -1;
  hit: boolean;
}
