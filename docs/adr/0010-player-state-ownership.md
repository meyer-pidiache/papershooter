# 0010 — Own player state in independent components

Status: Accepted. Date: 2026-11-14.

## Context

A player combines several update phases, but their state has different lifetimes and invariants.
Extracting methods into helpers receiving the whole player would preserve the original coupling.
Locomotion also shares a physics body with the grapple, so replacing it with disconnected copies
would change rope constraints, jump timing and collision behavior.

## Decision

Keep one explicit phase coordinator and compose checked components with owned state:

| Owner             | Responsibility                                              | Collaborators                                                       |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `Locomotion`      | Posture, sprint/slide/dash/mantle, body integration         | Input, world/spawn, grapple commands, motion feedback               |
| `Jumps`           | Jump buffer, ground grace, wall contact and extra air jump  | Physics body, movement frame, grapple detach command                |
| `Grapple`         | Hook transitions, rope constraints, stamina and recovery    | Physics body/pose, geometry/target queries, view, feedback          |
| `Grenades`        | Inventory, charge, throw packets and projectile lifetime    | Pose, ray queries, visual adapter, feedback, blast outcome callback |
| `Equipment`       | Weapon selection, temporary melee return and input dispatch | Weapon commands, input, pose frame, selected/sights feedback        |
| `PlayerCombat`    | HP/recovery, death and guard windows                        | Physics body/pose, current guard state, outcome feedback            |
| `FirstPersonView` | Look pose, stride, recoil/landing springs and projection    | Camera/body, shake sample, footstep command                         |

Planar acceleration is a deterministic domain calculation operating only on velocity and a numeric
frame. Grenade blast damage is an application combat policy; projectile simulation reports the
blast position and local ownership without traversing the game runtime.

The body and pose vectors are shared explicitly as physics/read-model data. Components receive no
complete player, arbitrary runtime lookup, mutable controller action bag or callback that exposes
their former owner's state. Feedback adapters translate specific outcomes into existing commands.
They own no gameplay state and do not call movement/weapon transitions in return.

Preserve the order of look, movement input, acceleration, jumping, body/grapple integration,
recovery/view update, grenade input/projectiles and weapon input. Keep preallocated frame records
and scratch vectors in hot paths. Preserve the original random-draw order.

## Alternatives and consequences

An ECS would add a broad framework without a demonstrated query/composition requirement. Inheritance,
prototype patches and method chunks bound to `Player` would obscure state ownership. Explicit
components introduce contracts and forwarding code, but can be exercised without DOM, audio,
networking or full application setup.

The legacy `Player` entry point currently remains JavaScript. Its public actor commands/properties
are used by targeting, weapons and application controllers. Checking the components does not check
that composition; completing its consumer contracts is part of review finding R5.

## Temporary coordinator exception

At this checkpoint, `player.js` is 428 physical / 415 code lines and its constructor is 118 code
lines. Those exceed the normal review signals. Its remaining role is composition, phase ordering
and the existing actor facade; the calculations above are independently owned. There are no
remaining function-complexity findings in this coordinator or its extracted player components.

Temporarily retain explicit forwarding and construction together while R5 replaces the unchecked
composition contract. Splitting the facade through mixins or forwarding-method files would make
navigation harder without separating another responsibility. This exception permits no new gameplay
calculation in the coordinator. Reassess it during R5, whenever another component/public command is
added, or if a second actor consumer needs a different interface. It does not waive the outstanding
enemy/weapon decomposition or certify the complete refactor.

## Evidence

Pre-extraction movement, grapple, grenade and camera traces remain unchanged. They cover hook flight,
attachment/reeling/jump release; charged/remote throws, bounce, blast damage and reset; camera
projection, recoil, guard flash, damage and death. Component tests additionally cover obstruction,
fall/mantle/focus boundaries, targeting precedence/occlusion, target death, stamina, loadout return
cancellation, recovery timing and guard cones/cooldown. Preserve these baselines when changing source
layout; do not regenerate them to accept unexplained behavior changes.
