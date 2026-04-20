# BASICS CLI Output and Report Spec (v0)

Status: Draft

## 1) JSON Report Contract

```json
{
  "run": {
    "id": "2026-04-20T09-10-00Z-workpads-core-dirty",
    "mode": "dirty-test",
    "target": "/abs/path/to/repo",
    "tier": "core",
    "profiles": ["shared-core", "software"],
    "timestamp": "2026-04-20T09:10:00Z"
  },
  "summary": {
    "pass": 0,
    "fail": 0,
    "partial": 0,
    "na": 0,
    "error": 0,
    "blockingFailures": 0
  },
  "results": [
    {
      "ruleId": "BASICS-EVID-002",
      "status": "fail",
      "severity": "high",
      "observed": "No standalone event schema artifact found",
      "evidence": [
        {
          "type": "file-check",
          "path": "/abs/path/to/repo",
          "detail": "searched known schema locations"
        }
      ],
      "remediation": "Publish event-schema.md with compatibility notes"
    }
  ],
  "confidence": {
    "level": "medium-high",
    "rationale": "deterministic file checks + partial command checks"
  },
  "limits": [
    "no exhaustive command fuzzing",
    "no long-duration resilience test"
  ]
}
```

## 2) Markdown Report Sections

Rendered markdown should include:

1. verdict
2. scope and method
3. hard findings (by severity)
4. strengths
5. tier readiness snapshot
6. remediation plan
7. confidence and limits

## 3) Severity Definitions

- `critical`: immediate blocker for requested tier claim
- `high`: major conformance risk; usually blocking in strict mode
- `medium`: meaningful gap; not always blocking
- `low`: improvement opportunity
- `info`: contextual observation

## 4) Rule Status Definitions

- `pass`: explicit evidence meets rule
- `fail`: explicit evidence contradicts or missing required behavior
- `partial`: some evidence exists but insufficient for full pass
- `na`: rule not applicable for target mode/profile
- `error`: evaluator failed unexpectedly

## 5) Strict Mode Behavior

With `--strict`, treat:

- `fail` on mandatory rules as blocking
- `error` on mandatory evaluators as blocking
- `partial` on mandatory rules as blocking (optional default for v0 strict)

## 6) Report File Naming Convention

- JSON: `basics-report-<run-id>.json`
- Markdown: `basics-report-<run-id>.md`
- Summary: `basics-summary-<run-id>.txt`

