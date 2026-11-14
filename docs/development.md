# Development

Use the Node version in `.nvmrc` (22.23.1) and pnpm version in `packageManager` (12.18.0).

```bash
nvm use                        # if using nvm; otherwise install the pinned Node version
corepack enable
pnpm install --frozen-lockfile
git config core.hooksPath .githooks
git config pull.rebase true
pnpm dev
```

Open `http://127.0.0.1:5173`. `pnpm dev --port 8910` selects another port. Vite resolves dependencies
from the lockfile, reloads changed modules/styles and rebuilds the scene through a page reload when
game code changes. Live GPU/game state is not preserved across source edits.

The frontend works without a project API. To use the development credential adapter, copy
`.env.example` to `.env`, select a TURN provider, supply its private variables and set
`VITE_TURN_CREDENTIALS_URL=/api/turn-credentials`. Vite attaches the same HTTP handler used in
production. Only `VITE_*` settings are browser-visible. The private provider variables must never
receive that prefix. See [networking](networking.md).

## Commands

| Command                                 | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm check`                            | Import boundaries, types, lint, unit/integration tests and both builds |
| `pnpm review:structure`                 | Advisory size/complexity and static dependency report under `reports/` |
| `pnpm format:check` / `pnpm format`     | Check/apply repository formatting                                      |
| `pnpm test:watch`                       | Watch unit/integration tests                                           |
| `pnpm test:coverage`                    | Include all product files and write HTML/LCOV under `coverage/`        |
| `pnpm build:client`                     | Produce portable static files in `dist/`                               |
| `pnpm build:server`                     | Produce the bundled optional Node service in `dist-server/server.mjs`  |
| `pnpm preview`                          | Preview a compiled static build locally                                |
| `pnpm start`                            | Serve `dist/` and optional API; load `.env` if present                 |
| `pnpm exec playwright install chromium` | Install the browser for integration smoke tests                        |
| `pnpm test:e2e`                         | Test the compiled frontend in Chromium; run `pnpm build:client` first  |
| `pnpm audit --prod`                     | Query known production dependency advisories                           |

## Development in Docker

```bash
docker compose -f compose.dev.yml up --build
```

Open `http://127.0.0.1:5173`. Source is bind-mounted and dependencies live in a named volume; the
host's `node_modules` is not used by the container. Rebuild after changing the lockfile and refresh
the dependency volume (`docker compose -f compose.dev.yml down --volumes`) if it contains an older
install. That volume only contains development dependencies. Use a separate Compose project name
when working beside another development checkout. Production Compose is a separate file.

Native development is the default and avoids Docker filesystem overhead. The container target is
the alternative when installing the Node toolchain locally is inconvenient. The rationale for
deferring Nix and Nix-built images is in [ADR 0001](adr/0001-development-toolchain.md).

## Dependency updates

Use `pnpm add --save-exact` or `pnpm add -D --save-exact`, commit the manifest and lockfile, and run
the relevant checks. After a runtime dependency change, run `pnpm licenses:generate` and review the
updated third-party notice artifact; builds check it against installed packages. Keep one lockfile.
Three.js 0.170.0 and PeerJS 1.5.4 intentionally match the
copied upstream libraries during this refactor. Graphics/network library upgrades need browser and
protocol review in their own change. The package manager uses integrity values in the lockfile;
the Node pin and container digests also need deliberate maintenance.
