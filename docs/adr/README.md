# Architecture decision records

| Record                                     | Decision                                                 | Status   |
| ------------------------------------------ | -------------------------------------------------------- | -------- |
| [0001](0001-development-toolchain.md)      | pnpm, Vite and an optional container environment         | Accepted |
| [0002](0002-networking-and-credentials.md) | Browser WebRTC with configurable signaling and ICE       | Accepted |
| [0003](0003-modular-architecture.md)       | Modular application with a typed functional core         | Accepted |
| [0004](0004-deployment.md)                 | Static artifact and optional Node credential service     | Accepted |
| [0005](0005-testing.md)                    | Behavior tests and honest whole-product coverage         | Accepted |
| [0006](0006-maintainability-standard.md)   | Size, complexity and semantic-coupling review            | Accepted |
| [0007](0007-module-size-threshold.md)      | Researched 300-line module-review threshold; amends 0006 | Accepted |

| [0008](0008-scene-resource-ownership.md) | Shared scene resources, fragment transfer and explicit leases | Accepted |

Each decision records context, alternatives, consequences and evidence. Revisit a decision when its
constraints change; retain superseded records so their reasoning remains available.
