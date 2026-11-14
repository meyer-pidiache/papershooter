# 0001: Development toolchain

Date: 2026-11-14. Status: accepted.

## Context

The original project used copied Three.js r170 and PeerJS 1.5.4 distributions, a Python file server,
and syntax checks. There was no dependency lock, build artifact, type checker or test runner.

## Decision

Use exact direct dependency versions, a committed pnpm lockfile, a pinned Node version in `.nvmrc`,
and the exact pnpm version in `packageManager`. CI and container builds install with
`--frozen-lockfile`. Keep Three.js 0.170.0 and PeerJS 1.5.4 during the refactor; dependency upgrades
need their own behavior review. Vite provides module resolution, development reload and a static
`dist/` artifact. Editing scene construction intentionally reloads the application; preserving live
GPU state during arbitrary hot module replacement would require additional lifecycle work.

Native development is the default. A Docker development target provides the same commands when
installing Node locally is inconvenient. A bind mount supplies source and a named volume stores
container dependencies. Docker is optional for frontend development and for static production hosts.

## Alternatives

- **Nix dev shell:** stronger control over system tools when nixpkgs is pinned, useful across several
  native toolchains. This repository currently needs one Node toolchain. Requiring Nix would add its
  installation and lock maintenance for every contributor. Reconsider if native build tools,
  cross-compilation or existing team Nix infrastructure justify it.
- **Nix-built OCI image:** can construct reproducible images, but would add a second packaging path
  and cache setup. Retain the conventional multi-stage Docker build for the VPS workflow.
- **Vendored libraries:** useful for offline source serving but obscure dependency updates and
  provenance. The package lock records integrity; dependency licenses remain with their packages.
- **npm/Bun:** both viable; pnpm gives explicit package-manager pinning and deterministic installs
  without introducing a second runtime. Avoid multiple lockfiles.

## Consequences and limits

Reproducible dependency resolution is not a claim of bit-identical builds on every OS/architecture.
Node patch versions and container base images require deliberate updates. No Nix configuration is
shipped as an unvalidated second environment. Native and container paths share the package scripts.

## Evidence

- [pnpm frozen installs](https://pnpm.io/cli/install)
- [Vite development and builds](https://vite.dev/guide/)
- [Nix: pinning nixpkgs](https://nix.dev/tutorials/first-steps/towards-reproducibility-pinning-nixpkgs)
