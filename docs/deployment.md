# Deployment

Choose a static frontend unless temporary relay credentials need a service you operate. Signaling,
STUN and TURN can be hosted independently from the site. Cloudflare Tunnel is optional ingress;
Cloudflare TURN is a separate optional credential provider.

| Option                    | Artifact                                     | Runtime                                                   | Credential API               |
| ------------------------- | -------------------------------------------- | --------------------------------------------------------- | ---------------------------- |
| Any static HTTPS host/CDN | `dist/`                                      | Static host only                                          | External endpoint, or none   |
| Vercel                    | `dist/` and optional `api/*.ts` functions    | CDN, optional Node functions                              | Included adapters if enabled |
| VPS without containers    | `dist/`, optionally `dist-server/server.mjs` | Existing web server, optionally Node                      | Same origin or separate      |
| VPS Compose               | Docker `app` target                          | One nonroot Node container serving files and optional API | Same origin                  |
| Static container          | Docker `static` target                       | Nonroot nginx, no Node                                    | External endpoint, or none   |

## Static hosting

```bash
pnpm install --frozen-lockfile
pnpm build:client
```

Publish `dist/`, never the source repository or `.env`. Serve HTTPS for browser WebRTC/pointer
features. Solo and STUN-only multiplayer need no project function. Replace `ice-servers.json` with
your STUN configuration or set public build variables. For a separately hosted credential API,
configure `VITE_TURN_CREDENTIALS_URL=https://your-api.example/api/turn-credentials` and allow your
frontend origin on that API. Do not put a provider token in a build variable.

Hash-named assets can use immutable long caching. HTML and ICE configuration should revalidate;
credentials must never be cached by a CDN. `vite preview` is a local preview tool, not a production
server. An existing nginx/Caddy/static hosting service can serve this artifact with no new container.

## Existing VPS / Compose workflow

```bash
cp .env.example .env
# Edit public configuration and, optionally, select/configure a TURN provider.
docker compose up --build -d --remove-orphans
```

The default site stays at `127.0.0.1:8901` (`PAPERSHOOT_PORT` overrides it). Point the existing HTTPS
ingress/tunnel at that loopback listener. The service serves frontend and API in one container;
the previous `turn-api` container is replaced, which is why upgrading uses `--remove-orphans`.
There are no persistent game databases or volumes. Private secrets are runtime environment values,
not build arguments. The origin must remain private when trusting a forwarded client IP header.

Compose uses `/api/ice-servers` and `/api/turn-credentials` by default. With `TURN_PROVIDER=none`,
credential requests return 503 and play uses available direct/STUN routes. An explicitly empty
`VITE_TURN_CREDENTIALS_URL` disables credential requests. Changing private/provider/STUN environment
values requires container recreation; changing browser `VITE_*` variables requires rebuilding.

The multi-stage build pins base image digests, installs the locked dependencies once, compiles the
frontend/server and copies only runtime artifacts. The `app` target runs as `node`, drops
capabilities, uses a read-only filesystem and has a health check. It contains no `node_modules`,
compiler, repository metadata or provider `.env` file. Debian slim retains glibc compatibility for
Node. See [ADR 0004](adr/0004-deployment.md) for the alternatives.

## Static container

```bash
docker build --target static -t papershooter-static .
docker run --rm --read-only --cap-drop=ALL --security-opt=no-new-privileges:true \
  --tmpfs /tmp -p 127.0.0.1:8901:8080 papershooter-static
```

This target uses the portable static ICE configuration and does not proxy to an API. Use an external
HTTPS credentials URL at build time if needed. It is smaller than the Node variant but cannot keep
a TURN signing secret by itself. The Alpine image is a static nginx runtime; the Node build/API
runtime uses Debian slim. Compare real image sizes on your target architecture instead of assuming
that one base distribution improves gameplay performance.

## Vercel

Import the repository with `vercel.json`: pnpm frozen install, `pnpm build:client`, output `dist/`.
The root `api/ice-servers.ts` and `api/turn-credentials.ts` adapters use the same tested HTTP handler.
For static/STUN-only play, leave `VITE_TURN_CREDENTIALS_URL` unset and provider `none`; those function
routes are unused. To enable TURN, configure the private runtime variables and set the public
`VITE_TURN_CREDENTIALS_URL=/api/turn-credentials`, then redeploy.

There is no persistent WebSocket server in those functions: PeerServer signaling and WebRTC are
external/browser connections. Select a supported Node runtime in project settings, and apply an
edge rate limit if the credential route is enabled. A serverless instance's in-memory limiter is
not shared with other instances. This repository supplies configuration/adapters; production Vercel
deployment and real provider credentials need verification in the owning account.

## Native Node option

```bash
pnpm build
pnpm start
```

The bundled service listens on `127.0.0.1:3000` and reads `.env` if present. Place it behind HTTPS
ingress and a process supervisor. Set `STATIC_DIR` to serve another build directory. Only the
compiled server file, static artifact and Node runtime are required to run it.

Inspect logs with `docker compose logs --tail=100 papershooter` and check `/healthz` through your
origin listener. Keep a previously built image tag for rollback. Review new dependency/base image
digests and run the checks before publishing replacements.
