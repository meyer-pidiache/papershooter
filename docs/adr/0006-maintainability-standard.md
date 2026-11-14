# 0006: Review size, complexity and semantic coupling together

Date: 2026-11-14. Status: accepted; the module-size decision below is superseded by
[ADR 0007](0007-module-size-threshold.md). Other review criteria remain unchanged.

## Context

The first refactor separates application layers and adds behavior coverage, but its review at
`871d851` still finds 11 source files exceeding 400 lines. Several smaller modules receive the whole
runtime and call one another through callbacks. A clean import graph and a passing Sonar quality
gate do not prove those runtime dependencies are narrow.

## Decision

This section records the initial policy. The separate 400-line allowance lacked adequate
justification; ADR 0007 replaces it after a source review and local threshold comparison.

Adopt the [engineering standard](../engineering-standard.md): prefer modules up to 300 code lines
and functions up to 60; require review above 400 and 100 respectively. Review cyclomatic complexity
above 15, nesting above 3 and more than 5 positional parameters. Report cognitive complexity
separately through Sonar. These thresholds initiate a responsibility/contract review; they do not
define a universally correct architecture.

Use the existing ESLint and TypeScript toolchain for an advisory, reproducible structural report.
Keep import boundaries enforced and extend their coverage to server/API modules and literal dynamic
imports. Preserve all existing warnings in the structural report rather than adding blanket
suppressions. Track the remaining work in a prioritized review with concrete source evidence.

Require narrow ports and clear state ownership when extracting behavior. Permit justified content
exceptions for map recipes, shaders, models and musical scores. Do not redesign maps or change game
balance to reduce a size metric. Document which JavaScript boundaries remain unchecked.

## Alternatives and consequences

- A hard 400-line limit for every current file would encourage mechanical splitting of content and
  forwarding methods. It would also make the policy appear satisfied without reducing coupling.
- A warning-count budget alone can hide regression in one component behind unrelated improvements.
  Defer a hard budget until module-specific exceptions and ownership are agreed.
- An external dependency-analysis platform is unnecessary for this review; the existing tools
  report static imports, while manual inspection remains necessary for callback/state dependencies.
- Advisory reports require reviewers to act on findings. They must not be described as an enforced
  maintainability gate. Architectural findings remain explicit work even when CI and Sonar pass.

The references and measurement definitions are recorded in the engineering standard so later
reviews can reproduce and revise the policy deliberately.
