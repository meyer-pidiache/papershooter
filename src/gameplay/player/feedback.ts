import type { CombatPose, PlayerCombatFeedback } from './combat-state.js';
import type { GuardResponsePort } from './feedback-contracts.js';
import { Vector3 } from 'three';
import { INK } from '../../shared/ink.js';
import type { MovementFeedback } from './movement-contracts.js';
import type { GrenadeFeedback } from './grenades.js';
import type { GrappleFeedback } from './grapple-contracts.js';
import type {
  CameraFeedbackPort,
  MotionFeedbackPose,
  PlayerFeedbackPorts,
  WeaponFeedbackPort,
} from './feedback-contracts.js';
const _v = new Vector3(),
  _v2 = new Vector3();
export function makeGrenadeFeedback(
  ports: PlayerFeedbackPorts,
  weapon: () => WeaponFeedbackPort,
): GrenadeFeedback {
  return {
    thrown: () => {
      weapon().recoil.kick(-0.4, 0.5, 1.2);
      weapon().recoilRot.kick(-3, 0, -1.5);
      ports.audio.grappleFire();
      ports.input.rumble(0.2, 0.4, 50);
    },
    bounce: () => ports.audio.shell(),
    fuse: (position) =>
      ports.effects.strokeBurst(position.clone().add(_v.set(0, 0.22, 0)), INK.ORANGE, 2, 2.5, {
        life: 0.12,
        size: 0.02,
      }),
  };
}
export function makeGrappleFeedback(
  ports: PlayerFeedbackPorts,
  camera: CameraFeedbackPort,
  weapon: () => WeaponFeedbackPort,
): GrappleFeedback {
  return {
    target: (mode) => ports.hud.grappleTarget(mode),
    outOfBreath: () => {
      ports.audio.winded();
      ports.hud.tip('grapple needs a breather', 0.9);
    },
    missed: () => ports.audio.empty(),
    fired: () => {
      ports.audio.grappleFire();
      ports.input.rumble(0.15, 0.4, 40);
      weapon().recoil.kick(-0.3, 0.2, 0.5);
    },
    yanked: () => {
      ports.score(30, 'YANKED');
      ports.audio.grappleHit();
      ports.input.rumble(0.5, 0.5, 90);
    },
    attached: () => {
      ports.audio.grappleHit();
      ports.audio.reelLoop(true);
      ports.hud.grappleTarget(2);
      ports.input.rumble(0.3, 0.6, 60);
    },
    stopped: () => {
      ports.audio.reelLoop(false);
      ports.hud.grappleTarget(0);
    },
    released: (boost) => {
      if (boost) {
        ports.audio.jump();
        camera.kickFov(3);
      } else ports.audio.grappleRelease();
    },
    exhausted: () => ports.hud.tip('out of breath · land to recover', 1.4),
  };
}
export function makeMovementFeedback(
  ports: PlayerFeedbackPorts,
  pose: MotionFeedbackPose,
  camera: CameraFeedbackPort,
  onFall: () => void,
): MovementFeedback {
  return {
    jump: () => {
      ports.audio.jump();
      camera.kickLand(-1.2);
    },
    wallJump: (roll) => {
      ports.audio.wallJump();
      camera.addRoll(roll);
      camera.kickFov(2);
      camera.kickLand(-1.5);
    },
    airJump: () => {
      ports.audio.jump();
      camera.kickFov(1.6);
      camera.kickLand(-1.4);
      _v2.copy(pose.center);
      _v2.y -= 0.7;
      ports.effects.strokeBurst(_v2, INK.BLUE, 9, 4.5, { life: 0.28, size: 0.028, gravity: -2 });
    },
    slide: () => {
      ports.audio.slide();
      camera.kickFov(2.5);
      camera.kickLand(-2.5);
    },
    dash: (direction) => {
      ports.audio.dash();
      camera.kickFov(4);
      ports.input.rumble(0.3, 0.6, 70);
      camera.addRoll((direction.x * pose.right.x + direction.z * pose.right.z) * 0.08);
      _v2.copy(pose.center).addScaledVector(direction, -0.6);
      ports.effects.strokeBurst(_v2, INK.BLUE, 10, 5, { life: 0.25, size: 0.03 });
    },
    mantle: () => {
      ports.audio.mantle();
      camera.kickLand(-2.5);
      camera.kickFov(1.5);
    },
    land: (impact) => {
      camera.kickLand(-impact * 6 - 0.5);
      ports.audio.land(impact);
      if (impact > 0.8) {
        ports.effects.shakeAmt += impact * 0.15;
        ports.input.rumble(impact * 0.4, 0.2, 80);
      }
    },
    fell: () => {
      onFall();
      ports.hud.message('OFF THE PAGE', 'redrawn at the start', 1.8);
    },
  };
}

export function makeCombatFeedback(
  ports: PlayerFeedbackPorts,
  pose: CombatPose,
  camera: CameraFeedbackPort,
  weapon: () => GuardResponsePort,
  onDeath: () => void,
): PlayerCombatFeedback {
  return {
    hurt: (amount, from) => {
      camera.hurt(amount);
      ports.effects.shakeAmt += 0.2 + amount / 80;
      ports.audio.hurt();
      ports.input.rumble(0.8, 0.5, 160);
      if (from) {
        _v.subVectors(from, pose.eye);
        ports.hud.damageFrom(Math.atan2(_v.dot(pose.right), _v.dot(pose.forward)));
      }
    },
    deflected: (projectile, perfect) => {
      weapon().onDeflect?.(perfect);
      if (perfect) ports.audio.perfectParry();
      else ports.audio.parry();
      ports.effects.sparks(
        projectile.pos,
        _v2.copy(projectile.vel).normalize().negate(),
        INK.ORANGE,
        perfect ? 14 : 8,
        10,
      );
      ports.effects.strokeBurst(projectile.pos, INK.BLUE, perfect ? 8 : 5, 4.5, {
        life: 0.2,
        size: 0.028,
      });
      ports.input.rumble(0.4, 0.6, 70);
      ports.hitstop(perfect ? 0.07 : 0.025, 0.18);
      ports.effects.shakeAmt += 0.06;
      camera.flash(perfect ? 0.35 : 0.1);
      ports.score(perfect ? 60 : 15, perfect ? 'PERFECT PARRY' : 'BLOCKED');
    },
    meleeBlocked: () => {
      weapon().onDeflect?.(true);
      ports.audio.parry();
      ports.hitstop(0.06, 0.15);
      ports.effects.sparks(
        _v2.copy(pose.eye).addScaledVector(pose.forward, 0.8),
        pose.forward.clone().negate(),
        INK.ORANGE,
        12,
        8,
      );
      ports.score(40, 'BLOCKED');
      ports.input.rumble(0.6, 0.6, 100);
    },
    died: () => {
      ports.audio.death();
      onDeath();
    },
  };
}
