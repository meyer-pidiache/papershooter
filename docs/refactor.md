# Refactor work record

Baseline: `c74df47` on `main`. Work branch: `refactor/maintainable-game-architecture`.

## Sequence

1. Inspect behavior, network dependencies and the current Sonar report; record decisions.
2. Pin tooling/dependencies and establish map, physics and browser behavior baselines.
3. Extract typed domain/configuration contracts; make signaling and ICE provider independent.
4. Separate credential providers, HTTP handling, configuration and process startup.
5. Extract shared map/model kits and application systems without changing map content or game balance.
6. Expand tests, measure coverage, connect LCOV to Sonar and pin CI actions.
7. Build deployment targets, document operations and record actual verification results.
8. Review remaining size, complexity and semantic coupling; record the next extraction priorities
   and adopt a documented engineering standard with reproducible advisory reports.
9. Implement the open review findings in focused commits, then obtain an independent quality review
   from a subagent with a fresh context, without providing earlier conclusions. Review source for
   best practices, clarity/style, correctness, ownership and performance; address valid findings
   before concluding the refactor.

Use focused commits in this single branch. Dependency upgrades and map redesign are separate work.
The original upstream rights/attribution notice remains applicable to inherited source.

## Baseline findings

- 15 browser modules, roughly 5,000 dense lines, with an 831-line bootstrap.
- Three.js r170 and PeerJS 1.5.4 were manually copied into `vendor/`.
- Solo and multiplayer run in the browser; the host browser keeps scores and migrates authority.
- Public PeerServer signaling is still required even when a game uses STUN/TURN directly.
- The Node API only exposes ICE configuration and mints temporary Cloudflare TURN credentials.
- Client fallback STUN hosts and Cloudflare TURN selection were hardcoded.
- CI checked syntax and Compose; there was no gameplay test suite or coverage report.

Final measurements and limitations belong in [quality.md](quality.md).
The [manual review](reviews/2026-11-14-refactor.md) records open findings. The passing automated
gate does not close those findings or complete the remaining gameplay/controller decomposition.

## Completed structural work

- Replaced copied libraries with the same Three.js/PeerJS versions under a frozen pnpm lock.
- Extracted typed rules, physics/math, registry, configuration, credential adapters and application ports.
- Separated application controllers, level kits, character models, projectiles, rendering and input.
- Preserved all four seeded map/collision fingerprints and a recorded movement trace.
- Made audio an application-owned resource and added cleanup for listeners, schedulers and GPU contexts.
- Added provider-independent ICE, coturn credentials, trusted proxy configuration and bounded API limiting.
- Protected host-only messages, sender identity, stale connection closes and cancelled lobby setup.
- Corrected untrusted kill-feed/scoreboard HTML and an inherited blob-boss katana death crash.
- Added static, Node/Compose and Vercel deployment paths; retained the existing loopback VPS port.
- Added deterministic unit/integration tests, Chromium smoke tests, coverage imports and pinned CI actions.
