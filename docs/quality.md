# Tests and quality

The baseline at `c74df47` had syntax/Compose checks and no automated gameplay coverage report. Its
Sonar report contained 388 open issues: 7 vulnerabilities, 8 bugs and 373 code smells. This branch
adds behavior baselines, typed boundaries, import checks, unit/integration tests and browser smoke
tests. Sonar receives a generated LCOV report before each scan; its quality gate remains enabled.

## Coverage policy

`pnpm test:coverage` uses V8 and includes **all** `src/**/*.{js,ts}`, `server/**/*.ts` and `api/**/*.ts`,
including untested files. Only type declarations are excluded. Fixtures, test doubles, generated
builds and dependencies do not enter the product denominator. HTML and LCOV reports are generated
under `coverage/`; CI publishes them as artifacts.

The enforced whole-product floors are 80% statements, 80% lines, 80% functions and 70% branches.
Branch coverage is reported separately and still has room to improve in combat, AI and session
failure paths. Do not describe line coverage as branch coverage or lower Sonar's gate to hide a
missing report. Sonar's own new-code/condition calculations can differ from the local total.

Local milestone on 2026-11-14, before the final CI scan:

| Metric                      | Result                                                     |
| --------------------------- | ---------------------------------------------------------- |
| Unit/integration tests      | 73 passing; additional alias regression included afterward |
| Statements                  | 84.32%                                                     |
| Lines                       | 85.98%                                                     |
| Functions                   | 84.90%                                                     |
| Branches                    | 71.76%                                                     |
| Production dependency audit | 0 known advisories at the time of inspection               |

The generated report and latest CI run are authoritative. Test seeds are fixed so procedural
variation does not randomly change assertions/coverage. Dependency advisories are time-sensitive;
rerun `pnpm audit --prod` when updating dependencies or preparing a release.

## What is tested

- Seeded vertex/matrix/collider/bounds/spawn output for District and Mexico, in solo and arena.
  Expected collider counts remain 517, 429, 321 and 321 respectively.
- A recorded movement trace covering walking, sprint, jump, double jump, dash and crouch, plus
  collision resolution, raycasts, step-up and navigation around obstacles.
- Waves, bosses, checkpoints, rewards, death/respawn, FFA scores and host migration.
- Real application controllers with replaceable renderer/transport boundaries: map switches,
  pickups, destructibles, damage, network snapshots, lobby browsing and match results.
- Weapons, ammunition conservation, reloads, katana guard/slash, grenades and remote model state.
- Keyboard/mouse/gamepad input, audio envelopes/theme scheduling, resource/listener/context cleanup.
- Provider-independent ICE validation, caching/coalescing/expiry, Cloudflare failures, coturn HMAC,
  bounded rate limiting, method/error/CORS handling and credential redaction.
- Host-control authority, canonical host ids behind aliases, sender impersonation, stale connection
  closes, cancelled lobby setup, malformed scores and HTML injection regressions.

Recording adapters replace WebGL/audio hardware and external signaling in unit tests; they validate
real pass/uniform/envelope/controller behavior. They do not prove shader appearance, audio quality,
GPU performance or NAT traversal. Chromium smoke tests run against `dist/` and exercise the actual
browser renderer/menu/game code. Browser tests are not silently added to the unit coverage total.

## Security changes for the baseline findings

| Finding                                  | Source change                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Mutable action dependency                | Actions are pinned to full commit SHAs                                    |
| Root nginx image                         | Production targets explicitly run as `node` or uid 101                    |
| Recursive repository copy                | Explicit build inputs, artifact-only runtime copies and secret exclusions |
| Internal cleartext proxy / synthetic URL | Same-origin Node composition and direct request-path handling             |
| Legacy Python server finding             | Replaced by the declared Vite development environment                     |
| Kill-feed/scoreboard DOM injection       | Text nodes, escaped templates and validated network score/counter fields  |

The Sonar scan must verify the resulting classification; source changes alone are not evidence of
a passed quality gate. HMAC-SHA1 in the coturn adapter is protocol compatibility, with a private
signing secret and expiring credentials; it is not used to store passwords. Keep original upstream
attribution and the scoped license notice intact.

## Browser and deployment limits

The local ARM host is not an officially supported Playwright OS. Chromium software rendering
completed game start, Mexico selection, weapon switching and pause/resume, but repeated page reloads
intermittently failed to create a WebGL context. The same failure was reproduced against archived
`c74df47`; it is not evidence of a map regression. CI uses an Ubuntu runner for the full three-test
Chromium suite. Record its actual outcome before marking the PR ready.

All Docker targets are built as review images. The Node review container was run with a read-only
filesystem/dropped capabilities and returned 200 for the site, health and synthetic coturn
credentials, `no-store` for credentials and 404 for `.env`. The existing deployment is not restarted
by these checks. Vercel adapters/configuration are supplied but not deployed into an account here.

Before releasing visual/network changes, also inspect both maps, graphics/audio, mouse/controller
feel, restrictive NAT/TURN paths, reconnects and real provider billing/rate-limit behavior. Local
in-memory transport tests cannot prove reachability between two real networks. Existing procedural
JavaScript is deliberately documented as not fully statically checked; type migration remains
incremental rather than using blanket `any` or `ts-nocheck` annotations.
