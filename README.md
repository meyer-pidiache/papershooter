# Paper Shooter

A first-person survival shooter drawn in blue ballpoint on lined notebook paper. Grapple across
rooftops and canyons, slice bullets back at the doodles that fired them, lob grenades, and see how
many waves you can survive. Play alone, survive with friends, or fight them.

Everything you see is generated in code with three.js. There are no models, textures or sound
files: the paper, the ink outlines, the hatching, the enemies and the music are all procedural, including the 8-bit themes, one per map (toggle them in settings or with M).

## Running it

Use Node 22.23.1 (see `.nvmrc`) and the pinned pnpm version:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open http://127.0.0.1:5173. Development reloads game code and styles through Vite.
`pnpm build:client` produces `dist/` for any static HTTPS host. Solo and STUN-only multiplayer
need no project API; temporary TURN credentials can use the optional Node/Vercel adapter.

For the existing VPS workflow, configure `.env.example` and use `docker compose up --build -d`.
See [deployment](docs/deployment.md) for static hosting, Vercel, nonroot container targets and the
migration from the previous two-container deployment. [Development](docs/development.md) also
covers the optional container environment.

## Modes

- **Solo**: survive the waves. Bosses every fifth wave, checkpoints unlock at wave 5, 10, 15...
- **Free for all**: up to ten players, first to 20 kills, with a ten minute cap shown on screen that starts once a second player is in. Anyone in the lobby can start. After the death cam a press of any button brings you back with a two second shield; two and a half minutes without input gets you kicked, with a one-click rejoin. Health
  regenerates after a few seconds out of combat (not while sprinting), so only ammo drops in.

Multiplayer uses PeerJS for signaling and WebRTC for player connections. Players connect directly
when their networks allow it; the optional credential service can issue short-lived TURN credentials
so restrictive networks can relay traffic. Under PLAY ONLINE you can Quick Play (joins an open
public lobby, or opens one for you), create a public or private lobby, or join a friend's lobby with
their five letter code. People can join a match already in progress. The host's browser keeps score;
each player runs their own body.

### Networking configuration

STUN URLs, TURN credential endpoints and PeerServer signaling are configurable. The browser
connects to STUN/TURN directly; the optional credential service keeps private provider keys out of
browser code. It supports Cloudflare and coturn-compatible temporary credentials, or you can point
the frontend at another HTTPS provider adapter. See [networking](docs/networking.md) and
[.env.example](.env.example) for the public/private variables and deployment defaults.

## Controls

| Action                          | Mouse + keyboard        | PS5 controller       |
| ------------------------------- | ----------------------- | -------------------- |
| Move / look / sprint            | WASD, mouse, Shift      | L stick, R stick, L3 |
| Fire / slash                    | LMB                     | R2                   |
| Aim / block (katana)            | RMB                     | L2                   |
| Jump, wall jump, double jump    | Space                   | ✕                    |
| Slide, air dash                 | C / Ctrl (X, Alt)       | ○                    |
| Grapple (hold to reel)          | Q / E                   | L1                   |
| Quick katana slash              | F                       | R1                   |
| Reload                          | R                       | □                    |
| Grenade (hold to throw further) | G                       | R3 or d-pad up       |
| Katana dash (gauge lit)         | both mouse buttons or X | L2 + R2              |
| Weapons                         | 1-4 / wheel             | △, d-pad             |
| Scoreboard (online)             | Tab                     | Create               |
| Menu                            | Esc                     | Options              |

On-screen hints follow whichever device you touched last.

## Weapons and gear

Rifle, shotgun, sniper (with scope) and a katana. Holding block with the katana parries
some incoming bullets and returns a share of them. Katana kills charge a gauge; when it is lit you
can dash to a marked enemy and execute it (solo only). Grenades bounce, then go off in a thick orange blast that scorches the paper; holding the
button winds up a longer throw and shows the arc. The grapple runs on breath: hanging drains it,
landing refills it, and a slash through someone's rope cuts it. Against other players a raised katana parries
slashes and turns some bullets aside, and the guns use their own damage table; the sniper still erases in one shot.

## Maps

- **Paper District**: streets, rooftops and fire escapes, with grapple rings on the high spots. Solo
  plays the tight original block. A match opens it up: a ring of empty street, walls, a ribbed dome
  that cannot be hooked, an open field in the middle crossed by a ruler bridge, a few pads hung from
  the dome, and slow paper planes you can hook and ride (the solo planes too).
- **Paper Mexico**: a sun-baked pueblo. A plaza with a fountain and a giant sombrero floating over it,
  a bandstand where three mariachis never stop playing, a church with a bell tower you can climb and
  a domed second tower, adobe houses with roof stairs, papel picado strung across the square, a
  market of striped stalls and hanging piñatas, a taco cart, cacti and mesas all around. Pots, crates,
  barrels, cacti and piñatas all break under bullets, blades and blasts; piñatas drop tacos, which are
  the health pickups here. The map plays its own mariachi waltz.

Pick the map on the main menu for solo; the host picks it in the lobby for a match, and everyone
starts in a different spot.

## Enemies

Grunts, rushers, bombers, snipers with dodgeable lasers, flyers, heavies and shield bearers. Bosses
rotate: The Doodler, The Eraser and The Inkblot, each with its own moves.

## How the look works

The scene renders to a buffer holding shade, an ink id and view-space normals plus a float depth.
A post pass draws outlines from an inverse-depth Laplacian, adds surface-following hatching, paper
grain, ruled lines and the red margin. Wobble is static so nothing flickers.

## Engineering and contributing

The application separates game rules, controllers, map construction, rendering, browser adapters
and network transports. Physics/math and external contracts use TypeScript strict mode; existing
procedural gameplay/graphics remain JavaScript during the documented incremental migration.

- [Architecture and reusable map/model kits](docs/architecture.md)
- [Technical decisions and evaluated alternatives](docs/adr/README.md)
- [Tests, coverage and remaining verification limits](docs/quality.md)
- [Contributing, Git hooks and the trunk/rebase workflow](CONTRIBUTING.md)

Run `pnpm check` for architecture, types, lint, tests and builds; `pnpm test:coverage` writes LCOV for
SonarCloud. CI also checks formatting, Chromium gameplay smoke tests and all container targets.

## License and attribution

This fork is based on [iifor/doodleshooter](https://github.com/iifor/doodleshooter). The PolyForm
Noncommercial terms in [LICENSE.md](LICENSE.md) apply only to original contributions by Meyer
Pidiache in this fork. They do not grant rights to inherited upstream code or third-party dependencies;
see [NOTICE.md](NOTICE.md).
