# 0005: Behavior tests and coverage

Date: 2026-11-14. Status: accepted.

## Decision

Use Vitest for deterministic unit and integration tests and Playwright for real-browser gameplay
smoke tests. Record seeded map/collision fingerprints before extracting map builders. Test public
behavior: movement/collisions, navigation, wave/scoring rules, storage compatibility, ICE validation,
credential expiry/failure, rate limiting and lifecycle cleanup. Mock external providers at their
network boundary; never require billable TURN requests in CI.

Generate V8 coverage with LCOV before the Sonar scan. Include every application and backend module,
including untested files. Exclude only type declarations and generated/dependency artifacts. Report
line, statement, function and branch coverage separately. The target is at least 80%; if remaining
GPU/browser code prevents that, record actual coverage and gaps rather than excluding difficult
files or setting Sonar's gate to zero. Browser smoke tests complement, rather than imply, complete
visual or real-network coverage.

Tests should fail on a broken contract or changed game rule. Avoid tests that merely assert a mock
was called or snapshot entire implementation details. Keep a manual review checklist for controls,
shader appearance, audio and real NAT/firewall combinations that automated local tests cannot prove.

## Evidence

- [Vitest coverage](https://vitest.dev/guide/coverage.html)
- [Sonar JS/TS LCOV imports](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
