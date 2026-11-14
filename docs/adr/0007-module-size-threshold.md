# 0007: Use 300 code lines as a provisional module-review threshold

Date: 2026-11-14. Status: accepted. Supersedes the module-size portion of
[ADR 0006](0006-maintainability-standard.md).

## Problem

The initial policy preferred 300 lines but required review only above 400. The extra allowance
had no measured or source-based justification. Merely selecting another round number would not
establish an optimum; the policy needs an explicit comparison and evidence limits.

## Evidence and its limits

- [ESLint max-lines](https://eslint.org/docs/latest/rules/max-lines) has a numeric default of 300
  and explicitly states that there is no objective universal maximum. Its default is a convention,
  not an empirical demonstration that 300 is better than 200 or 400. Our explicit blank/comment-only
  exclusions differ from the rule's default counting options.
- [El Emam et al., NRC report ERB-1074, 2000](https://nrc-publications.canada.ca/eng/view/object/?id=e709a57a-b4b9-4e73-83e2-4adb489a9836)
  tested class-size threshold effects in two C++ systems and one Java system and did not find such
  effects. The authors discuss limitations of their model and sample. This is evidence against
  treating a cutoff as a safe/unsafe boundary; it does not establish an optimal JavaScript file size
  or directly measure this game's maintenance effort.
- [Google's review guidance](https://google.github.io/eng-practices/review/reviewer/looking-for.html)
  emphasizes overall design and complexity at line, function and class levels. It does not supply
  a universal file-size cutoff. Change-set size, function size, class size and module size are
  different units; recommendations for one must not be presented as limits for another.

These sources support using size as a review heuristic alongside cohesion, ownership and
complexity. They do not support declaring a precise scientifically optimal number for this project.

## Local comparison

Baseline: `0dbd4dc`, 55 production JS/TS modules under `src`, `server` and `api`. Counts use the same
ESLint `max-lines` rule with `skipBlankLines: true` and `skipComments: true`, changing only `max`.
Generated files, dependencies and tests are outside this inventory. A violation means strictly
greater than the candidate threshold.

| Candidate | Modules flagged | Fraction | Local interpretation                                                                           |
| --------- | --------------: | -------: | ---------------------------------------------------------------------------------------------- |
| 200       |              22 |    40.0% | Six additional modules beyond 300; all six already have function-length or complexity findings |
| 300       |              16 |    29.1% | Includes screens, physics, HUD, renderer and input beyond the former 400-line group            |
| 400       |              11 |    20.0% | Delays size review of those five modules; the separate 300–400 allowance lacks justification   |
| 600       |               7 |    12.7% | Omits remote-player/model responsibilities and all five modules in the 300–400 range           |

The five modules newly signaled by 300 are `screens.js` (387 code lines), `physics.ts` (382),
`hud.js` (362), `renderer.js` (325) and `input.js` (305). The manual review already found presentation
coupling around the renderer and state/callback coupling around screens. Input has a method with
cyclomatic complexity 30. This makes earlier inspection useful, without proving every one of those
files needs splitting: cohesive physics or HTML/shader content may justify an exception.

The six additional modules signaled by 200 are controls, loop, combat, focus, navigation and
projectiles. They remain review work; their other findings are retained. Avoiding duplicate size
warnings is a practical tradeoff, not proof that 200 is wrong or that their responsibilities are
already correct. These counts measure diagnostic reach and overlap, not precision, defects found,
reviewer productivity or causal maintenance improvement. We have no calibrated dataset for those
outcomes yet.

To reproduce a candidate, run the command below at the baseline checkout and replace `300` with
`200`, `400` or `600`. `pnpm review:structure` reports the adopted value on the current checkout.

```bash
pnpm exec eslint src server api \
  --rule 'max-lines: ["warn", {"max": 300, "skipBlankLines": true, "skipComments": true}]'
```

## Decision

Use **300 code lines as the initial review threshold**, with no separate 400-line allowance.
The rationale is a recognizable tool convention plus earlier inspection of relevant local
responsibilities, while the combined function/complexity checks still cover the smaller modules.
This is an engineering judgment under uncertainty, not an inferred scientific optimum.

Keep the report advisory during the migration and require an explicit responsibility review or
written exception above 300. A file at 299 is not certified maintainable, and a file at 301 is not
automatically a defect. Do not split files mechanically, hide content, compress formatting or
change either existing map to satisfy the metric. Shared-state and payload/resource findings remain
prioritized independently of file size.

Reassess after the next two structural PRs. Record whether an alert prompted a useful extraction,
required an exception or duplicated another signal; review effort and subsequent change difficulty
also matter. Lower or raise the threshold when that evidence warrants it. The other numeric
function/complexity criteria in ADR 0006 remain separate project heuristics and are not validated by
this module-size comparison.
