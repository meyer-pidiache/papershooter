# 0003: Modular architecture and typing

Date: 2026-11-14. Status: accepted.

## Context

The original bootstrap mixed rendering, persistent settings, UI HTML, waves, combat, networking,
match clocks and pickups in one module. Map construction and reusable character models were also
coupled to individual maps and enemy AI.

## Decision

Use a modular monolith with explicit composition. Application controllers coordinate gameplay
systems. Domain functions describe deterministic rules without DOM, storage, HTTP or rendering.
Adapters own browser persistence, PeerJS, HTTP and credential providers. Maps consume a shared
construction kit and return the same level contract; reusable character geometry is independent of
enemy behavior. Rendering, input and audio remain separate presentation/platform services.

Use TypeScript strict mode for domain, physics/math, map registry, configuration and backend boundaries.
Retain JavaScript for
the existing procedural engine and scene controllers during this behavior-preserving migration.
Moving those files into typed contracts is incremental work, not achieved by renaming files or
adding `any`/`ts-nocheck`. `allowJs` permits interoperation; `checkJs: false` means those JavaScript
modules are not statically type safe. Tests and architecture checks still include them.

Use pure functions for rules and validation, stateful objects for resources with identity/lifetime
(physics world, renderer, connections), and small factories for application systems. Supply narrow
dependencies at composition time. Avoid an ECS, DI container, generic event bus or class hierarchy
without a concrete use case. Mutable vectors and reusable pools remain in frame-sensitive code.

## Consequences

Map geometry, spawn positions, wave balance, weapon behavior, shader output and wire messages are
preserved. Map registration and the shared builder make additional maps possible without changing
existing geometry. Behavior tests guard both maps and both solo/arena variants. GPU output still
needs browser review; type checking cannot validate shaders or network reachability.
