# 0004: Deployment artifacts

Date: 2026-11-14. Status: accepted.

## Decision

Compile the frontend to `dist/`. Deploy that directory on any HTTPS static host (including Vercel),
or serve it on the existing VPS. The optional credentials service is a separate artifact with a
small Node runtime. Configure providers independently from frontend hosting and from DNS/tunnels.

Keep Compose for the existing VPS workflow and provide explicit development/production targets.
Use one Node process to serve the compiled files and optional API on the VPS, preserving same-origin
requests and eliminating a separate internal proxy/container. Bundle sirv with the API instead of
maintaining custom static-file/path/MIME handling. A separate `static` image target uses nonroot nginx
for deployments that only need files. This provides a smaller artifact without requiring Node at
every static host.
The production frontend image copies the compiled artifact, never the repository or secret files.
Use a nonroot static server and a restricted runtime; use Debian slim for Node to retain glibc
compatibility. Alpine is reasonable for the static server. Node Alpine uses musl, which can require
additional compatibility work for native Node dependencies. Image choice is not a gameplay
performance optimization: no Node code runs in the frame loop.

Cloudflare Tunnel is optional TLS ingress for a VPS; it is independent of Cloudflare TURN. Direct
HTTPS ingress and other tunnels are supported. A serverless deployment can host a credential
adapter, but in-memory rate limiting is per instance; distributed deployments require an edge rate
limit. Do not describe a public anonymous endpoint as authentication.

## Alternatives

A CDN or an existing web server needs only `dist/`; the Node service is optional for that deployment.
Nix images would introduce another packaging path
without a current requirement (ADR 0001). Do not run `vite preview` as the production server.

## Evidence

- [Vite static deployments](https://vite.dev/guide/static-deploy.html)
- [Official Node image variants and musl/glibc](https://github.com/nodejs/docker-node/blob/main/README.md)
