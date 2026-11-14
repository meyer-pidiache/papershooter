# Engineering standard

Status: adopted review policy, 2026-11-14. See [ADR 0006](adr/0006-maintainability-standard.md).
These are project choices, not a universal definition of professional code.

## Size and complexity

| Measure                 | Preferred target                  | Required review signal                                             |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------ |
| Module size             | At most 300 code lines            | More than 400 code lines                                           |
| Function or method size | At most 60 code lines             | More than 100 code lines                                           |
| Cyclomatic complexity   | At most 10                        | More than 15                                                       |
| Cognitive complexity    | Keep control flow straightforward | Sonar S3776 findings; review separately from cyclomatic complexity |
| Control-flow nesting    | At most 3 levels                  | More than 3                                                        |
| Positional parameters   | At most 5                         | More than 5; consider a named contract                             |

Code-line counts use ESLint with blank and comment-only lines excluded. Physical lines, including
comments and whitespace, are also reported for navigation. Embedded strings count toward size:
they can make a file difficult to navigate even when they are not executable JavaScript. These
counts do not measure semantic coupling. A 200-line module with broad mutable dependencies can be
harder to maintain than a cohesive 450-line module.

A review signal requires either a cohesive extraction or a written exception. New behavioral
modules should stay below the review thresholds. Do not create `part1`/`part2` files, remove useful
comments or compress formatting to meet a number. Do not distribute one class across files using
prototype patches, mixins or helpers bound to the entire original instance: that relocates code
while keeping the same hidden dependencies.

Factory functions count their nested helpers under ESLint's function-length rule. A long factory
is a prompt to inspect its public surface and captured state, not automatic proof that every
nested helper is too long. Composition roots also legitimately have more outgoing dependencies
than domain rules. Review the responsibilities rather than ranking modules by import count alone.

## Cohesion and contracts

- Give each module one reason to change: movement, damage rules, a credential provider, a map
  construction kit or a presentation resource. A directory name alone does not establish ownership.
- Pass the smallest named input/port a subsystem needs. Avoid handing every controller the complete
  mutable `runtime` or every component the complete player/enemy manager.
- Keep state with the subsystem that changes it. Expose commands, read models and explicit results
  instead of arbitrary writes into another subsystem's internal fields.
- Keep rule calculations independent of DOM, WebAudio, PeerJS and renderer construction. Convert
  rule outcomes into visual/audio feedback in the coordinating layer. Do not introduce an event bus
  or an ECS solely to satisfy this guideline.
- Validate untrusted values once at the boundary and hand typed, normalized values to gameplay.
  Envelope validation does not replace validation of each message payload.
- Import shared metadata from its owning module. A palette constant should not require importing
  the renderer implementation; a physics helper should not require a gameplay object.
- Export the intended public surface. Do not export private helpers solely to make tests reach them.
  Tests should exercise effects through public commands where practical.
- New reusable boundaries use strict TypeScript. Existing unchecked JavaScript remains visible
  migration debt; do not claim that `allowJs` with `checkJs: false` validates its contracts.

An extraction is complete when the component owns a coherent responsibility, has a narrow contract,
can be tested without constructing unrelated systems and does not reach back into its former owner
for arbitrary state. Fewer lines in the original file are insufficient evidence.

## Exceptions and existing debt

Map recipes, shader source, procedural model construction and musical scores can justify different
sizes. Inspect whether they contain only cohesive content or also mix scheduling, physics, state
transitions and resource management. Data-heavy content is not a blanket exception for logic.
Keep the existing District and Mexico geometry unchanged during this refactor.

Record an exception in the review or an ADR with its scope, measured size/complexity, why extraction
would currently reduce clarity or add risk, the remaining responsibility and the next review trigger.
Review exceptions again when the module grows, gains another responsibility or requires a new
consumer. The [refactor review](reviews/2026-11-14-refactor.md) inventories current debt; appearing in
that inventory does not approve indefinite growth or certify every item as acceptable.

## Checks and review process

Run `pnpm architecture` for enforced source-layer boundaries, missing relative modules and import
cycles across browser, server and API modules. It includes literal dynamic imports and re-exports.
It cannot prove the absence of cycles through callbacks, shared objects, runtime service lookups or
computed import paths. Review those explicitly.

Run `pnpm review:structure` for an advisory ESLint report and a module dependency inventory. Reports
are written to `reports/structure.md` and `reports/structure.json`; CI publishes them with coverage.
Structural warnings currently **do not fail CI** because the migration still contains the recorded
debt. They are not suppressed or labeled as passing a size gate. Syntax/lint errors still fail.
Before adding a hard regression budget, agree on individual module boundaries and justified
exceptions; a broad baseline based only on total warning counts would allow one module to worsen
while another improves.

For a structural PR, review state ownership, callback relationships, payload contracts, function
complexity and behavior preservation alongside the generated report. Keep map fingerprints,
movement traces, composed multiplayer tests, coverage and browser smoke tests passing. Do not update
behavior baselines merely because an extraction changed their output. Sonar's quality gate remains
enabled and does not replace architectural review.

## Evidence and interpretation

- [ESLint max-lines](https://eslint.org/docs/latest/rules/max-lines) explicitly does not establish
  an objective universal file-size limit. The 300/400 thresholds above are this project's policy.
- [ESLint max-lines-per-function](https://eslint.org/docs/latest/rules/max-lines-per-function)
  explains why function length and control-flow complexity reveal different concerns.
- [ESLint complexity](https://eslint.org/docs/latest/rules/complexity) measures execution paths;
  [max-depth](https://eslint.org/docs/latest/rules/max-depth) measures nesting.
- [Sonar on cognitive complexity](https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/)
  distinguishes understanding code from counting paths through it. Coverage measures exercised
  behavior, not how easy a component is to change.
