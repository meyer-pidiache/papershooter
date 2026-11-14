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
