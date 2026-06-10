# Extension: GUI / Mobile App Conformance Support

**Added:** 2026-04-26
**Motivation:** workpads KaiOS — first GUI app target using BASICS-cli
**Scope:** EVID-001, SC-001, SC-012, SC-050, TIER-010 evaluators in `bin/basics.js`

---

## Problem

The BASICS-cli evaluators for command surface checks were designed for CLI tools. They look for `cli.md`, `protocol/cli.md`, or `COMMANDS.md`. A GUI mobile app (e.g., a KaiOS application) documents its command surface differently — as a vocabulary of user-facing actions, not a terminal command listing. Without this extension, a well-documented GUI app would fail EVID-001 even if it had comprehensive command surface documentation.

---

## What Was Changed

The following evaluators now accept `command-surface.md` and `conformance-tests/command-surface.md` as valid command surface artifacts, in addition to the existing CLI paths:

| Evaluator | Rule | Change |
|-----------|------|--------|
| EVID-001 | Command surface artifact | Added `command-surface.md`, `conformance-tests/command-surface.md` |
| SC-001 | Documented command surface | Same additions |
| SC-012 | Canonical command class coverage | Same additions |
| SC-050 | Interoperability baseline | Same additions |
| TIER-010 | Core tier aggregate gate | Same additions |

All changes are marked with the comment `// GUI-APP-EXTENSION` in `bin/basics.js` for easy location.

---

## What a Valid `command-surface.md` Must Contain

For a GUI app's `command-surface.md` to satisfy the evaluators:

1. **For EVID-001 / SC-001:** The file must exist. Its presence is the evidence.
2. **For SC-001 full pass (not just partial):** Content must include the words `usage` or `commands`, and cover `create`, `edit`, `import`, `share`. For a GUI app, document these as action names in a usage or command definitions section.
3. **For SC-012:** Cover the canonical command classes: `create`, `edit`, `view`/`render`, `list`/`query`, `share`/`export`, `import`, `delete`, `policy`/`settings`, `status`/`health`. These can be expressed as GUI actions — they don't need to be shell commands.

See `workpads/conformance-tests/command-surface.md` as a reference implementation.

---

## Semantic Validity

This extension does not weaken BASICS-SC-001's requirement for "a documented command surface with stable semantics." A `command-surface.md` for a GUI app that documents its actions, their stable semantics, and a stability contract is exactly what BASICS intends. The original CLI-only path list was an implementation choice, not a normative requirement.

---

## Future Work

If the evaluator architecture is refactored to use a plugin registry (see HANDOVER-NEXT-AGENT.md Priority B), this extension should be folded into an `app-type: gui` evaluator profile rather than living as inline path additions. The current approach (additive path list) is correct for the v1.1.0 architecture.
