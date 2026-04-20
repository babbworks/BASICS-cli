# BASICS CLI

`basics` is a command-line assessor that evaluates a local repository against the BASICS standard.

Primary goal:

- turn BASICS from policy text into repeatable, local, evidence-backed checks

## Why this tool exists

BASICS conformance is evidence-driven.
Most teams can write strong architecture and protocol docs, but still miss hard requirements in implementation and release behavior.

`basics` closes that gap by:

- mapping findings to BASICS rule IDs (`BASICS-SC-*`, `BASICS-SW-*`, etc.)
- producing harsh, reproducible reports
- separating fact (`observed`) from interpretation (`assessment`)
- supporting dirty tests and deeper conformance runs

## Scope (v1.1.0 implemented)

The current runner focuses on repository-level conformance checks:

1. document evidence checks
2. command-surface checks for CLI tools
3. policy artifact checks (compatibility, deviation, degraded-mode)
4. report generation and rule-linked scoring

## Intended users

- product teams implementing BASICS
- Babb and delegated assessors
- maintainers preparing Core/Field/Industrial evidence bundles

## Command surface (v1.1.0)

```bash
basics init
basics detect
basics dirty-test --target /path/to/repo --profiles shared-core,software --tier core --write-report ./conformance-tests/basics-dirty.md
basics assess --target /path/to/repo --tier core --profiles shared-core,software --write-report ./conformance-tests/basics-assess.md
basics report --input ./.basics/results/latest.json --format md --out ./conformance-tests/report.md
basics claim:validate --file ./conformance/BASICS-claim.yaml
basics rules:list --mode assess
```

## Output model

Every run produces:

- machine report (`json`)
- human report (`md`)
- rule summary (`pass/fail/partial/na`)
- evidence references (file path + command output snippets)

## Exit codes (v1.1.0)

- `0` success (no blocking failures for requested mode)
- `10` configuration error
- `20` target discovery error
- `30` rule evaluation error
- `40` blocking conformance failures found
- `50` unexpected runtime error

## Repository layout (this spec project)

- `README.md` - product overview
- `SPEC.md` - technical specification
- `COMMANDS.md` - command and flag contract
- `OUTPUTS.md` - report schema and severity model
- `runner-core-v1.md` - implementation-level runner breakdown
- `package.json` - tool metadata and bin mapping
- `bin/basics.js` - runnable CLI runner
- `rules/dirty-core-v1.json` - harsh dirty-test rule pack
- `rules/assess-core-v1.1.json` - expanded assess pack

## Rule packs (v1.1.0)

- `BASICS-TIER-010`
- `BASICS-EVID-002`
- `BASICS-EVID-004`
- `BASICS-EVID-005`
- `BASICS-SC-041`
- `BASICS-SC-050`
- `BASICS-SC-051`

Assess pack adds:

- `BASICS-SC-001`
- `BASICS-SC-012`
- `BASICS-EVID-001`
- `BASICS-EVID-003`

## Quick run

```bash
node ./bin/basics.js dirty-test --target /path/to/repo --tier core --profiles shared-core,software --format both
```

