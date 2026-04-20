# BASICS CLI Command Contract (v1.1)

Status: Draft

Binary:

- `basics`

Global flags:

- `--target <path>`
- `--tier core|field|industrial`
- `--profiles <csv>`
- `--format json|md|both`
- `--out <path>`
- `--strict`
- `--json`
- `--write-report <path>`

## 1) `basics init`

Purpose:

- create local BASICS config and folder skeleton

Outputs:

- `.basics/config.yaml`
- `.basics/results/`

## 2) `basics detect`

Purpose:

- infer repository assessment shape

Output fields:

- `repoType`
- `detectedProfiles`
- `detectedEntryPoints`
- `confidence`

## 3) `basics dirty-test`

Purpose:

- run strict fast-check rule subset

Required:

- `--target`

Optional:

- `--tier` (default `core`)
- `--profiles` (default inferred)
- `--write-report` (write markdown report to explicit path)

Exit behavior:

- exits `40` on blocking failures

## 4) `basics assess`

Purpose:

- run full profile/tier-aware assessment

Required:

- `--target`

Optional:

- `--tier`
- `--profiles`
- `--strict`
- `--write-report` (write markdown report to explicit path)

## 5) `basics report`

Purpose:

- render human report from machine report

Required:

- `--input <report.json>`

Optional:

- `--format md|json|both`
- `--out <path>`

## 6) `basics claim:validate`

Purpose:

- validate BASICS claim metadata shape

Required:

- `--file <claim-yaml>`

Checks:

- BASICS version
- tier
- profiles
- evidence URI
- active deviation IDs

## 7) `basics rules:list`

Purpose:

- list loaded rules and applicability

Output:

- rule id
- severity
- profile
- mandatory/optional

Optional:

- `--mode dirty-test|assess`

