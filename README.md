# BASICS CLI

`basics` is a command-line assessor that evaluates a local repository against the BASICS standard.

Primary goal:

- turn BASICS from policy text into repeatable, local, evidence-backed checks

---

## What is it?

BASICS-cli is a command-line tool that evaluates a local code repository against the BASICS standard — a protocol for operating business-focused applications. It maps findings to rule IDs, produces evidence-backed pass/fail reports, and tells product teams exactly which conformance requirements they are missing and why. Run it locally, in CI, or as part of a handover checklist.

## The Problem

Most teams can write strong architecture and protocol documentation but still miss hard requirements in implementation and release behaviour. BASICS conformance is evidence-driven — it requires specific artifacts, command surfaces, and policy files to exist and be structurally correct. Without a tool, auditing this manually is slow, subjective, and inconsistent across teams and projects.

## How it Works

`basics` reads a target repository path, evaluates a configurable set of rules from a JSON rule pack, and produces a machine report (JSON), a human report (Markdown), and a rule summary with pass/fail/partial/na per rule. Rules cover document evidence, command surface, policy artifacts, and tiered conformance levels. Exit codes are numeric and script-friendly.

## Current Status

v1.1.0 — dirty-test and assess modes implemented. Rule packs for shared-core and software profiles active. GUI/mobile app extension added (accepts `command-surface.md` as valid command surface evidence). Used by the Workpads project as its primary conformance assessment tool.

## The Vision

The canonical automated gate for BASICS conformance across all Babb projects and any external team adopting the standard. Long-term: a CI-friendly binary that integrates with GitHub Actions, produces structured evidence bundles, and supports the full tiered conformance model (Core → Field → Industrial).

## Industry Context

Business software standards like ISO 9001 and CMMI exist but are too heavyweight for small product teams. BASICS fills the gap — a lightweight, repo-native conformance protocol designed for the pace of working software teams. BASICS-cli makes it automatable.

---

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
- `HANDOVER-NEXT-AGENT.md` - project status and next-agent handover
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

