# BASICS CLI Technical Spec (v0)

Status: Draft

## 1) Product Definition

`basics` is a local-first conformance assessor.
It scans a target repository and evaluates evidence against BASICS rules and tier requirements.

Design principles:

- deterministic checks where possible
- explicit uncertainty when heuristic checks are used
- no hidden network dependency for baseline operation
- machine-readable and human-readable output parity

## 2) Assessment Modes

### 2.1 Dirty Test

Purpose:

- fast, strict readiness snapshot

Characteristics:

- small high-signal rule subset
- biased toward blocking findings
- optimized for speed over completeness

### 2.2 Full Assessment

Purpose:

- structured conformance evaluation

Characteristics:

- profile-aware rules
- tier-aware mandatory gates
- optional maturity scoring

## 3) Core Entities

### 3.1 Run

- run id
- timestamp
- target path
- mode (`dirty-test|assess`)
- requested tier
- requested profiles

### 3.2 RuleResult

- rule id
- status (`pass|fail|partial|na|error`)
- severity (`critical|high|medium|low|info`)
- observed evidence
- rationale
- remediation hint

### 3.3 Report

- summary counts
- blocking findings
- strengths
- confidence statement
- limits statement

## 4) Rule Engine Model

Rules are evaluated through typed checks:

1. file existence checks
2. pattern checks (content inspection)
3. command checks (optional execution)
4. structured data checks (JSON/YAML validation)

Each rule includes:

- rule id
- applicability (tier/profile)
- evaluator type
- pass condition
- fail condition
- evidence extraction plan

## 5) Tier Logic

### 5.1 Mandatory vs Optional

- mandatory controls: pass/fail only
- optional controls: maturity scoring allowed

### 5.2 Blocking model

Assessment fails if:

- any mandatory applicable rule fails
- any rule-evaluation error is marked blocking

## 6) Confidence Model

Run confidence is computed from:

- evaluator determinism
- evidence completeness
- command execution coverage

Confidence labels:

- high
- medium-high
- medium
- low

## 7) Discovery Model

`basics detect` should infer target type:

- cli tool
- app/service repo
- mixed repo

Signals:

- package manifests
- executable entry points
- protocol docs
- conformance artifact folders

## 8) Security and Safety Constraints

- no mutation of target repository unless explicitly requested
- no remote calls required for baseline assessment
- command execution allowlist for scan mode

## 9) Evidence Folder Convention

Recommended output path:

`.basics/results/<run-id>/`

Files:

- `report.json`
- `report.md`
- `evidence.json`
- `summary.txt`

## 10) Initial Rule Pack (v0 target)

Required first pack:

- `BASICS-TIER-010`
- `BASICS-EVID-002`
- `BASICS-EVID-004`
- `BASICS-EVID-005`
- `BASICS-SC-041`
- `BASICS-SC-050`
- `BASICS-SC-051`

This aligns with harsh dirty-test gating used for `workpads`.

