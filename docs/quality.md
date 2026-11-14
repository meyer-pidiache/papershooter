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

Local whole-product measurement after `09cd612` on 2026-11-14 with the scoped integration deadline
below (later CI/generated reports supersede these snapshot values):

| Metric                      | Result                                          |
| --------------------------- | ----------------------------------------------- |
| Unit/integration tests      | 193 passing, including architecture regressions |
| Statements                  | 87.64%                                          |
| Lines                       | 89.11%                                          |
| Functions                   | 89.36%                                          |
| Branches                    | 77.36%                                          |
| Production dependency audit | 0 known advisories at the time of inspection    |

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
- Pre-extraction weapon geometry/action-cycle, camera, grenade and grapple traces; ammunition
  conservation, reload interruption, melee windows and remote model state.
- Recorded complete procedural-audio schedules and composed particle/decal/fragment output,
  including shared resource retirement and automatic-reload cancellation.
- Keyboard/mouse/gamepad input, audio envelopes/theme scheduling, resource/listener/context cleanup.
- Provider-independent ICE validation, caching/coalescing/expiry, Cloudflare failures, coturn HMAC,
  bounded rate limiting, method/error/CORS handling and credential redaction.
- Host-control authority, canonical host ids behind aliases, sender impersonation, stale connection
  closes, cancelled lobby setup, malformed scores and HTML injection regressions.

Recording adapters replace WebGL/audio hardware and external signaling in unit tests; they validate
real pass/uniform/envelope/controller behavior. They do not prove shader appearance, audio quality,
GPU performance or NAT traversal. Chromium smoke tests run against `dist/` and exercise the actual
browser renderer/menu/game code. Browser tests are not silently added to the unit coverage total.

The composed map/snapshot/damage multiplayer scenario has a local 10-second test deadline because
it builds two complete applications and repeatedly rebuilds their real maps. Instrumented CI
execution exceeded Vitest's default 5 seconds. Its fake clock/message flushing remains bounded;
other tests retain their default deadline. This is a test execution budget, not a coverage change
or a claim about real-browser frame performance.

## Transform baseline precision

Transform snapshots copy each matrix at capture time; Three.js mutates its matrix arrays in place.
Keeping the array reference would make earlier samples accidentally show the final transform.
Weapon/effect transform matrices are normalized to 10 decimal places before hashing. Geometry and
instance-buffer bytes, ammo, visibility and other discrete state retain their exact comparisons.

The [x64 diagnostic run](https://github.com/meyer-pidiache/papershooter/actions/runs/43620170805)
and the local ARM trace differed only in shotgun flash matrix values, by at most
`2.7755575615628914e-16`; all other sampled state and geometry matched. The `1e-10` absolute matrix
resolution remains much finer than unit-scale Float32 rendering or the world's `1e-4` collision
precision. It removes platform trigonometric noise while retaining meaningful transform changes.

After improving capture/normalization, references were recorded against the **pre-extraction**
weapon/effect implementations (`d992691` / `a528048`) and then checked against the extracted owners.
They were not regenerated from changed gameplay to accept a failing result. Preserve that process
when the measurement itself changes. On mismatch, weapon traces are saved under `reports/` and
included in the existing CI artifact for investigation.

## Security changes for the baseline findings

| Finding                                  | Source change                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| Mutable action dependency                | Actions are pinned to full commit SHAs                                    |
| Root nginx image                         | Production targets explicitly run as `node` or uid 101                    |
| Recursive repository copy                | Explicit build inputs, artifact-only runtime copies and secret exclusions |
| Internal cleartext proxy / synthetic URL | Same-origin Node composition and direct request-path handling             |
| Legacy Python server finding             | Replaced by the declared Vite development environment                     |
| Kill-feed/scoreboard DOM injection       | Text nodes, escaped templates and validated network score/counter fields  |

The [Sonar rerun](https://github.com/meyer-pidiache/papershooter/actions/runs/43590008110) at `871d851`
passed the unchanged gate: 80.6% new-code coverage, 0.2% duplication, no open bugs/vulnerabilities
and no pending security hotspots. It still reports 148 code smells. Five asynchronous-failure
findings from the initial scan were corrected and covered by regressions; they were not dismissed.
HMAC-SHA1 in the coturn adapter is protocol compatibility, with a private
signing secret and expiring credentials; it is not used to store passwords. Keep original upstream
attribution and the scoped license notice intact.

The subsequent [manual refactor review](reviews/2026-11-14-refactor.md) identifies remaining
ownership/controller and enemy decomposition work, alongside resolved payload/resource findings.
These green checks do not prove the complete architectural review finished. `pnpm review:structure` publishes advisory size/complexity findings alongside
coverage; see the [engineering standard](engineering-standard.md) for its policy and limits.

## Browser and deployment limits

The local ARM host is not an officially supported Playwright OS. Chromium software rendering
completed game start, Mexico selection, weapon switching and pause/resume, but repeated page reloads
intermittently failed to create a WebGL context. The same failure was reproduced against archived
`c74df47`; it is not evidence of a map regression. CI uses an Ubuntu runner for the full three-test
Chromium suite. All three browser tests and all three container builds passed in the
[PR CI run](https://github.com/meyer-pidiache/papershooter/actions/runs/43590008126).

All Docker targets are built as review images. The Node review container was run with a read-only
filesystem/dropped capabilities and returned 200 for the site, health and synthetic coturn
credentials, `no-store` for credentials and 404 for `.env`. The static target also ran read-only with
dropped capabilities as uid 101: site, health, ICE configuration and notices returned 200, while
`.env` and the absent credential API returned 404. The existing deployment is not restarted by these
checks. Vercel adapters/configuration are supplied but not deployed into an account here.

Before releasing visual/network changes, also inspect both maps, graphics/audio, mouse/controller
feel, restrictive NAT/TURN paths, reconnects and real provider billing/rate-limit behavior. Local
in-memory transport tests cannot prove reachability between two real networks. Existing procedural
JavaScript is deliberately documented as not fully statically checked; type migration remains
incremental rather than using blanket `any` or `ts-nocheck` annotations.
