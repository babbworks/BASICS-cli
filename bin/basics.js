#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const TOOL_NAME = "basics";
const TOOL_VERSION = "1.1.0";
const ROOT = path.resolve(__dirname, "..");

const EXIT = {
  OK: 0,
  CONFIG: 10,
  DISCOVERY: 20,
  EVAL: 30,
  BLOCKING: 40,
  RUNTIME: 50
};

function nowIso() {
  return new Date().toISOString();
}

function toRunId(mode, target, tier) {
  const safeTime = nowIso().replace(/[:.]/g, "-");
  const base = path.basename(target || "unknown");
  return `${safeTime}-${base}-${tier || "core"}-${mode}`;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (part.startsWith("--")) {
      const key = part.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    } else {
      out._.push(part);
    }
  }
  return out;
}

function printHelp() {
  console.log(`BASICS CLI v${TOOL_VERSION}

Usage:
  basics init [--target <path>]
  basics detect --target <path>
  basics dirty-test --target <path> [--tier core|field|industrial] [--profiles <csv>] [--format json|md|both] [--out <path>] [--write-report <path>] [--strict]
  basics assess --target <path> [--tier ...] [--profiles ...] [--format ...] [--out ...] [--write-report <path>] [--strict]
  basics report --input <report.json> [--format md|json|both] [--out <path>]
  basics claim:validate --file <claim.json|claim.yaml|claim.yml>
  basics rules:list [--mode dirty-test|assess]
  basics version
`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseSimpleYaml(text) {
  const out = {};
  const lines = text.split("\n");
  let currentListKey = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("- ")) {
      if (!currentListKey) continue;
      if (!Array.isArray(out[currentListKey])) out[currentListKey] = [];
      out[currentListKey].push(parseScalar(line.slice(2).trim()));
      continue;
    }
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (value === "") {
      currentListKey = key;
      if (!Array.isArray(out[currentListKey])) out[currentListKey] = [];
    } else {
      currentListKey = null;
      out[key] = parseScalar(value);
    }
  }
  return out;
}

function parseScalar(value) {
  const v = value.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
}

function listFilesRecursive(dir, maxFiles = 10000) {
  const files = [];
  function walk(current) {
    if (files.length >= maxFiles) return;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".basics") {
          continue;
        }
        walk(full);
      } else {
        files.push(full);
      }
    }
  }
  walk(dir);
  return files;
}

function safeRead(filePath, maxChars = 200000) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.slice(0, maxChars);
  } catch (_e) {
    return "";
  }
}

function inferProfiles(targetPath, files) {
  const names = files.map((f) => path.basename(f).toLowerCase());
  const hasFirmware = names.some((n) => n.includes("firmware"));
  const hasHardware = names.some((n) => n.includes("hardware") || n.includes("bom"));
  const hasPackage = names.includes("package.json") || names.includes("pyproject.toml");

  const profiles = ["shared-core"];
  if (hasPackage) profiles.push("software");
  if (hasHardware) profiles.push("hardware");
  if (hasFirmware) profiles.push("firmware");
  if (profiles.length === 1) profiles.push("software");
  return [...new Set(profiles)];
}

function detectRepoType(files) {
  const names = files.map((f) => path.basename(f).toLowerCase());
  const hasCliSignals =
    names.includes("cli.md") ||
    names.includes("workpads.js") ||
    names.includes("main.go") ||
    names.includes("setup.py") ||
    names.includes("package.json");

  const hasWebSignals =
    names.includes("index.html") ||
    names.includes("vite.config.js") ||
    names.includes("next.config.js");

  if (hasCliSignals && hasWebSignals) return "mixed";
  if (hasCliSignals) return "cli";
  if (hasWebSignals) return "app";
  return "unknown";
}

function firstExisting(targetPath, candidateRelativePaths) {
  for (const rel of candidateRelativePaths) {
    const full = path.join(targetPath, rel);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function hasAnyFile(targetPath, predicate) {
  const files = listFilesRecursive(targetPath);
  return files.some((f) => predicate(f));
}

function findAnyFiles(targetPath, predicate, limit = 5) {
  const files = listFilesRecursive(targetPath);
  const out = [];
  for (const f of files) {
    if (predicate(f)) {
      out.push(f);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function evaluateRule(ruleId, ctx) {
  if (ruleId === "BASICS-EVID-001") {
    // GUI-APP-EXTENSION: command-surface.md added as valid path for GUI/mobile apps
    // that document their action vocabulary rather than a CLI command surface.
    // See EXTENSION-GUI-APP.md for rationale and guidance.
    const commandSurface = firstExisting(ctx.target, [
      "cli.md",
      "protocol/cli.md",
      "COMMANDS.md",
      "command-surface.md",
      "conformance-tests/command-surface.md"
    ]);
    if (commandSurface) {
      return pass(ruleId, "Command surface evidence artifact found.", [{ type: "file", path: commandSurface }]);
    }
    return fail(
      ruleId,
      "No command surface evidence artifact found.",
      [{ type: "search", detail: "Checked cli.md, protocol/cli.md, COMMANDS.md, command-surface.md, conformance-tests/command-surface.md" }],
      "Publish a command surface artifact (e.g., cli.md for CLI tools, command-surface.md for GUI/mobile apps)."
    );
  }

  if (ruleId === "BASICS-EVID-003") {
    const adrIndex = firstExisting(ctx.target, [
      "adr-index.md",
      "docs/adr-index.md",
      "conformance-tests/adr-index.md",
      "conformance/adr-index.md"
    ]);
    if (adrIndex) {
      return pass(ruleId, "ADR index artifact found.", [{ type: "file", path: adrIndex }]);
    }
    return partial(
      ruleId,
      "ADR index artifact not found.",
      [{ type: "search", detail: "Checked common ADR index paths." }],
      "Publish adr-index.md to strengthen conformance evidence."
    );
  }

  if (ruleId === "BASICS-SC-001") {
    // GUI-APP-EXTENSION: command-surface.md added. See EXTENSION-GUI-APP.md.
    const commandDoc = firstExisting(ctx.target, [
      "cli.md",
      "protocol/cli.md",
      "COMMANDS.md",
      "command-surface.md",
      "conformance-tests/command-surface.md"
    ]);
    if (!commandDoc) {
      return fail(
        ruleId,
        "No documented command surface found.",
        [{ type: "search", detail: "Checked common command documentation paths." }],
        "Publish documented command surface with stable semantics."
      );
    }
    const content = safeRead(commandDoc, 200000).toLowerCase();
    const hasUsage = content.includes("usage") || content.includes("commands");
    const hasCoreCommands =
      content.includes("create") &&
      content.includes("edit") &&
      content.includes("import") &&
      content.includes("share");
    if (hasUsage && hasCoreCommands) {
      return pass(ruleId, "Documented command surface with core semantics detected.", [{ type: "file", path: commandDoc }]);
    }
    return partial(
      ruleId,
      "Command surface doc exists but appears incomplete for stable semantics.",
      [{ type: "file", path: commandDoc }],
      "Ensure usage + core command semantics are explicit."
    );
  }

  if (ruleId === "BASICS-SC-012") {
    // GUI-APP-EXTENSION: command-surface.md added. See EXTENSION-GUI-APP.md.
    const commandDoc = firstExisting(ctx.target, [
      "cli.md",
      "protocol/cli.md",
      "COMMANDS.md",
      "command-surface.md",
      "conformance-tests/command-surface.md"
    ]);
    if (!commandDoc) {
      return fail(
        ruleId,
        "Cannot verify canonical command class mapping without command contract artifact.",
        [{ type: "search", detail: "No command surface artifact found." }],
        "Publish command contract and map canonical command classes."
      );
    }
    const content = safeRead(commandDoc, 200000).toLowerCase();
    const required = ["create", "edit", "render", "list", "share", "import", "policy", "status"];
    const found = required.filter((k) => content.includes(k));
    if (found.length >= 7) {
      return pass(ruleId, "Canonical command class coverage appears high in documented surface.", [
        { type: "file", path: commandDoc },
        { type: "content-check", detail: `Found ${found.length}/${required.length} class keywords.` }
      ]);
    }
    if (found.length >= 4) {
      return partial(
        ruleId,
        `Canonical command class coverage is partial (${found.length}/${required.length}).`,
        [{ type: "file", path: commandDoc }],
        "Map all canonical classes: create/edit/view-render/list-query/share-export/import/sync/policy/status."
      );
    }
    return fail(
      ruleId,
      "Canonical command class mapping appears weak.",
      [{ type: "file", path: commandDoc }],
      "Expand command surface to map BASICS canonical classes."
    );
  }

  if (ruleId === "BASICS-EVID-002") {
    const candidate = firstExisting(ctx.target, [
      "event-schema.md",
      "conformance-tests/event-schema.md",
      "conformance/event-schema.md",
      "schema/event-schema.json",
      "schemas/event-schema.json",
      "protocol/event-schema.md"
    ]);
    if (candidate) {
      return pass(ruleId, "Event schema artifact found.", [{ type: "file", path: candidate }]);
    }
    return fail(
      ruleId,
      "No standalone event schema artifact found.",
      [{ type: "search", detail: "Checked common schema paths." }],
      "Publish event-schema.md or equivalent schema artifact with version and compatibility notes."
    );
  }

  if (ruleId === "BASICS-EVID-004") {
    const policy = firstExisting(ctx.target, [
      "compatibility-policy.md",
      "conformance-tests/compatibility-policy.md",
      "conformance/compatibility-policy.md"
    ]);
    const deviation = firstExisting(ctx.target, [
      "deviation-registry.md",
      "conformance-tests/deviation-registry.md",
      "conformance/deviation-registry.md",
      "standards/deviation-registry.md"
    ]);
    if (policy && deviation) {
      return pass(ruleId, "Compatibility policy and deviation registry found.", [
        { type: "file", path: policy },
        { type: "file", path: deviation }
      ]);
    }
    if (policy || deviation) {
      return partial(ruleId, "Only one required policy artifact found.", [
        { type: "file", path: policy || deviation }
      ], "Publish both compatibility-policy.md and deviation-registry.md.");
    }
    return fail(
      ruleId,
      "No compatibility policy and no deviation registry artifacts found.",
      [{ type: "search", detail: "Checked common policy artifact paths." }],
      "Add compatibility-policy.md and deviation-registry.md."
    );
  }

  if (ruleId === "BASICS-EVID-005") {
    const degraded = firstExisting(ctx.target, [
      "degraded-mode-matrix.md",
      "conformance-tests/degraded-mode-matrix.md",
      "conformance/degraded-mode-matrix.md"
    ]);
    const tests = firstExisting(ctx.target, [
      "conformance-tests",
      "conformance",
      ".basics/results"
    ]);
    if (degraded && tests) {
      return pass(ruleId, "Degraded mode matrix and test evidence location found.", [
        { type: "file", path: degraded },
        { type: "path", path: tests }
      ]);
    }
    if (degraded || tests) {
      return partial(ruleId, "Only one of degraded matrix / test evidence location found.", [
        { type: "path", path: degraded || tests }
      ], "Publish degraded-mode-matrix.md and tier test evidence artifacts.");
    }
    return fail(
      ruleId,
      "No degraded mode matrix and no conformance test evidence location found.",
      [{ type: "search", detail: "Checked common degraded and conformance paths." }],
      "Add degraded-mode-matrix.md and conformance evidence outputs."
    );
  }

  if (ruleId === "BASICS-SC-041") {
    const codeFiles = findAnyFiles(
      ctx.target,
      (f) => /\.(js|ts|py|go|rs)$/i.test(f),
      30
    );
    const combined = codeFiles.map((f) => safeRead(f, 20000)).join("\n");
    const hasCreateEditSignals =
      /(commandCreate|create\(|\bcreate\b)/i.test(combined) && /(commandEdit|edit\(|\bedit\b)/i.test(combined);
    const hasLocalStoreSignals =
      /(records\.json|localStorage|indexedDB|sqlite|writeFileSync|fs\.writeFileSync|Dexie)/i.test(combined);
    const hasHardNetworkRequirement = /(fetch\(|axios|http:\/\/|https:\/\/)/i.test(combined) && !hasLocalStoreSignals;

    if (hasCreateEditSignals && hasLocalStoreSignals && !hasHardNetworkRequirement) {
      return pass(ruleId, "Local create/edit and local persistence signals detected.", [
        { type: "code-scan", detail: "Detected create/edit and local storage patterns." }
      ]);
    }
    if ((hasCreateEditSignals && !hasLocalStoreSignals) || (!hasCreateEditSignals && hasLocalStoreSignals)) {
      return partial(
        ruleId,
        "Some local create/edit signals found, but evidence is incomplete.",
        [{ type: "code-scan", detail: "Partial signal match." }],
        "Ensure explicit local record create/edit and local persistence evidence."
      );
    }
    return fail(
      ruleId,
      "No clear local core create/edit baseline detected.",
      [{ type: "code-scan", detail: "No strong local create/edit + local store signal pair." }],
      "Implement and/or document local core record create/edit behavior."
    );
  }

  if (ruleId === "BASICS-SC-050") {
    // GUI-APP-EXTENSION: command-surface.md added. See EXTENSION-GUI-APP.md.
    const commandDoc = firstExisting(ctx.target, [
      "cli.md",
      "protocol/cli.md",
      "COMMANDS.md",
      "command-surface.md",
      "conformance-tests/command-surface.md"
    ]);
    const eventSchema = firstExisting(ctx.target, [
      "event-schema.md",
      "conformance-tests/event-schema.md",
      "schema/event-schema.json",
      "schemas/event-schema.json"
    ]);
    if (commandDoc && eventSchema) {
      return pass(ruleId, "Command semantics and event schema baselines are published.", [
        { type: "file", path: commandDoc },
        { type: "file", path: eventSchema }
      ]);
    }
    if (commandDoc || eventSchema) {
      return partial(ruleId, "Only one interoperability baseline artifact found.", [
        { type: "file", path: commandDoc || eventSchema }
      ], "Publish both command and event schema baselines.");
    }
    return fail(
      ruleId,
      "No published command semantics or event schema baselines found.",
      [{ type: "search", detail: "Checked common command and event schema artifact paths." }],
      "Publish command contract and event schema artifacts."
    );
  }

  if (ruleId === "BASICS-SC-051") {
    const compatibilityPolicy = firstExisting(ctx.target, [
      "compatibility-policy.md",
      "conformance-tests/compatibility-policy.md",
      "conformance/compatibility-policy.md"
    ]);
    if (!compatibilityPolicy) {
      return fail(
        ruleId,
        "No compatibility policy artifact found.",
        [{ type: "search", detail: "Checked common compatibility-policy paths." }],
        "Publish compatibility-policy.md with additive/breaking/migration signaling."
      );
    }
    const content = safeRead(compatibilityPolicy, 200000).toLowerCase();
    const hasAdditive = content.includes("additive");
    const hasBreaking = content.includes("breaking");
    const hasMigration = content.includes("migration") || content.includes("deprecation");
    if (hasAdditive && hasBreaking && hasMigration) {
      return pass(ruleId, "Compatibility signaling policy includes additive/breaking/migration behavior.", [
        { type: "file", path: compatibilityPolicy }
      ]);
    }
    return partial(
      ruleId,
      "Compatibility policy exists but is missing one or more signaling requirements.",
      [{ type: "file", path: compatibilityPolicy }],
      "Include explicit additive evolution, breaking-change signaling, and migration/deprecation guidance."
    );
  }

  if (ruleId === "BASICS-TIER-010") {
    // GUI-APP-EXTENSION: command-surface.md added. See EXTENSION-GUI-APP.md.
    const commandDoc = firstExisting(ctx.target, [
      "cli.md", "protocol/cli.md", "COMMANDS.md",
      "command-surface.md", "conformance-tests/command-surface.md"
    ]);
    const eventSchema = firstExisting(ctx.target, [
      "event-schema.md",
      "conformance-tests/event-schema.md",
      "schema/event-schema.json",
      "schemas/event-schema.json"
    ]);
    const compatibilityPolicy = firstExisting(ctx.target, [
      "compatibility-policy.md",
      "conformance-tests/compatibility-policy.md",
      "conformance/compatibility-policy.md"
    ]);
    const degraded = firstExisting(ctx.target, [
      "degraded-mode-matrix.md",
      "conformance-tests/degraded-mode-matrix.md",
      "conformance/degraded-mode-matrix.md"
    ]);

    const codeFiles = findAnyFiles(ctx.target, (f) => /\.(js|ts|py|go|rs)$/i.test(f), 20);
    const combined = codeFiles.map((f) => safeRead(f, 12000)).join("\n");
    const localCreateEdit =
      /(create|commandcreate)/i.test(combined) &&
      /(edit|commandedit)/i.test(combined) &&
      /(records\.json|localStorage|indexedDB|sqlite|writeFileSync|Dexie)/i.test(combined);

    const passCount = [Boolean(commandDoc), Boolean(eventSchema), Boolean(compatibilityPolicy), Boolean(degraded), Boolean(localCreateEdit)].filter(Boolean).length;
    const evidence = [];
    if (commandDoc) evidence.push({ type: "file", path: commandDoc });
    if (eventSchema) evidence.push({ type: "file", path: eventSchema });
    if (compatibilityPolicy) evidence.push({ type: "file", path: compatibilityPolicy });
    if (degraded) evidence.push({ type: "file", path: degraded });
    if (localCreateEdit) evidence.push({ type: "code-scan", detail: "Detected local create/edit signals." });

    if (passCount === 5) {
      return pass(ruleId, "All Core tier entry controls detected for dirty-test subset.", evidence);
    }
    if (passCount >= 2) {
      return partial(ruleId, `Core entry controls are incomplete (${passCount}/5).`, evidence, "Close missing controls: event schema, compatibility policy, degraded matrix, and local create/edit evidence.");
    }
    return fail(ruleId, "Core entry controls largely missing.", evidence.length ? evidence : [{ type: "search", detail: "No strong Core entry signals found." }], "Publish Core conformance artifacts and local create/edit evidence.");
  }

  return {
    ruleId,
    status: "error",
    severity: "high",
    observed: `No evaluator implemented for ${ruleId}.`,
    evidence: [],
    remediation: "Implement evaluator.",
    blocking: true
  };
}

function pass(ruleId, observed, evidence = []) {
  return { ruleId, status: "pass", severity: "info", observed, evidence, remediation: "", blocking: false };
}

function fail(ruleId, observed, evidence = [], remediation = "") {
  return { ruleId, status: "fail", severity: "high", observed, evidence, remediation, blocking: true };
}

function partial(ruleId, observed, evidence = [], remediation = "") {
  return { ruleId, status: "partial", severity: "medium", observed, evidence, remediation, blocking: false };
}

function summarize(results, strict, rulesMeta) {
  const summary = {
    pass: 0,
    fail: 0,
    partial: 0,
    na: 0,
    error: 0,
    blockingFailures: 0
  };
  for (const r of results) {
    if (summary[r.status] !== undefined) summary[r.status] += 1;
    const meta = rulesMeta[r.ruleId] || { mandatory: false };
    const blockingByFail = r.status === "fail" && meta.mandatory;
    const blockingByError = r.status === "error" && meta.mandatory;
    const blockingByPartialStrict = strict && r.status === "partial" && meta.mandatory;
    if (blockingByFail || blockingByError || blockingByPartialStrict) {
      summary.blockingFailures += 1;
    }
  }
  return summary;
}

function renderMarkdown(report, rulesMeta) {
  const lines = [];
  lines.push(`# BASICS ${report.run.mode === "dirty-test" ? "Dirty Test" : "Assessment"} Report`);
  lines.push("");
  lines.push(`Run ID: ${report.run.id}`);
  lines.push(`Tool Version: ${report.run.toolVersion}`);
  lines.push(`Target: \`${report.run.target}\``);
  lines.push(`Tier: ${report.run.tier}`);
  lines.push(`Profiles: ${report.run.profiles.join(", ")}`);
  lines.push(`Timestamp: ${report.run.timestamp}`);
  lines.push("");

  const verdict = report.summary.blockingFailures > 0 ? "BLOCKED" : "PASS";
  lines.push(`## Verdict: ${verdict}`);
  lines.push("");
  lines.push(`- Blocking failures: ${report.summary.blockingFailures}`);
  lines.push(`- Pass: ${report.summary.pass}`);
  lines.push(`- Fail: ${report.summary.fail}`);
  lines.push(`- Partial: ${report.summary.partial}`);
  lines.push(`- Error: ${report.summary.error}`);
  lines.push("");

  lines.push("## Findings");
  lines.push("");
  for (const r of report.results) {
    const meta = rulesMeta[r.ruleId] || {};
    lines.push(`### ${r.ruleId} - ${r.status.toUpperCase()}`);
    lines.push(`- Severity: ${r.severity}`);
    lines.push(`- Mandatory: ${meta.mandatory ? "yes" : "no"}`);
    lines.push(`- Observed: ${r.observed}`);
    if (r.evidence && r.evidence.length) {
      lines.push("- Evidence:");
      for (const ev of r.evidence) {
        const detail = ev.path ? `path=${ev.path}` : ev.detail ? `detail=${ev.detail}` : JSON.stringify(ev);
        lines.push(`  - ${ev.type}: ${detail}`);
      }
    }
    if (r.remediation) lines.push(`- Remediation: ${r.remediation}`);
    lines.push("");
  }

  lines.push("## Confidence");
  lines.push("");
  lines.push(`- Level: ${report.confidence.level}`);
  lines.push(`- Rationale: ${report.confidence.rationale}`);
  lines.push("");
  lines.push("## Limits");
  lines.push("");
  for (const l of report.limits) lines.push(`- ${l}`);
  lines.push("");
  return lines.join("\n");
}

function writeRunOutputs(report, markdown, outDir) {
  ensureDir(outDir);
  const jsonPath = path.join(outDir, `basics-report-${report.run.id}.json`);
  const mdPath = path.join(outDir, `basics-report-${report.run.id}.md`);
  const summaryPath = path.join(outDir, `basics-summary-${report.run.id}.txt`);
  writeText(jsonPath, JSON.stringify(report, null, 2));
  writeText(mdPath, markdown);
  writeText(
    summaryPath,
    [
      `run=${report.run.id}`,
      `target=${report.run.target}`,
      `blockingFailures=${report.summary.blockingFailures}`,
      `pass=${report.summary.pass}`,
      `fail=${report.summary.fail}`,
      `partial=${report.summary.partial}`,
      `error=${report.summary.error}`
    ].join("\n")
  );
  return { jsonPath, mdPath, summaryPath };
}

function loadDirtyPack() {
  const filePath = path.join(ROOT, "rules", "dirty-core-v1.json");
  return readJson(filePath);
}

function loadAssessPack() {
  const filePath = path.join(ROOT, "rules", "assess-core-v1.1.json");
  return readJson(filePath);
}

function loadPackByMode(mode) {
  if (mode === "assess") return loadAssessPack();
  return loadDirtyPack();
}

function loadPackById(packId) {
  const packs = [loadDirtyPack(), loadAssessPack()];
  return packs.find((p) => p.packId === packId) || loadDirtyPack();
}

function commandInit(args) {
  const target = args.target ? path.resolve(args.target) : process.cwd();
  const basicsDir = path.join(target, ".basics");
  const resultsDir = path.join(basicsDir, "results");
  ensureDir(resultsDir);
  const configPath = path.join(basicsDir, "config.json");
  if (!fs.existsSync(configPath)) {
    writeText(
      configPath,
      JSON.stringify(
        {
          tool: TOOL_NAME,
          version: TOOL_VERSION,
          defaultTier: "core",
          defaultProfiles: ["shared-core", "software"]
        },
        null,
        2
      )
    );
  }
  console.log(JSON.stringify({ ok: true, target, configPath, resultsDir, version: TOOL_VERSION }, null, 2));
}

function commandDetect(args) {
  const target = resolveTarget(args);
  const files = listFilesRecursive(target);
  const repoType = detectRepoType(files);
  const detectedProfiles = inferProfiles(target, files);
  const out = {
    repoType,
    detectedProfiles,
    detectedEntryPoints: findAnyFiles(target, (f) => /workpads\.js|cli\.md|package\.json|main\./i.test(f), 8),
    confidence: repoType === "unknown" ? "medium" : "medium-high",
    toolVersion: TOOL_VERSION
  };
  console.log(JSON.stringify(out, null, 2));
}

function resolveTarget(args) {
  const target = args.target ? path.resolve(args.target) : null;
  if (!target) throw Object.assign(new Error("Missing --target"), { exitCode: EXIT.CONFIG });
  if (!fs.existsSync(target)) throw Object.assign(new Error(`Target path does not exist: ${target}`), { exitCode: EXIT.DISCOVERY });
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) throw Object.assign(new Error(`Target must be a directory: ${target}`), { exitCode: EXIT.DISCOVERY });
  return target;
}

function parseProfiles(args, inferredProfiles) {
  if (!args.profiles) return inferredProfiles;
  return String(args.profiles)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function commandDirtyTest(args, mode = "dirty-test") {
  const target = resolveTarget(args);
  const tier = args.tier || "core";
  const strict = Boolean(args.strict);
  const format = args.format || "both";
  const files = listFilesRecursive(target);
  const inferred = inferProfiles(target, files);
  const profiles = parseProfiles(args, inferred);
  const runId = toRunId(mode, target, tier);
  const pack = loadPackByMode(mode);
  const rulesMeta = {};
  for (const rule of pack.rules) rulesMeta[rule.ruleId] = rule;

  const ctx = { target, tier, profiles, strict, mode };
  const results = [];
  for (const rule of pack.rules) {
    const applicable =
      tier === "core" &&
      (rule.profiles || []).some((p) => profiles.includes(p));
    if (!applicable) {
      results.push({
        ruleId: rule.ruleId,
        status: "na",
        severity: rule.severity || "info",
        observed: "Not applicable for selected tier/profiles.",
        evidence: [],
        remediation: "",
        blocking: false
      });
      continue;
    }

    try {
      const evaluated = evaluateRule(rule.ruleId, ctx);
      evaluated.severity = evaluated.severity || rule.severity || "medium";
      results.push(evaluated);
    } catch (err) {
      results.push({
        ruleId: rule.ruleId,
        status: "error",
        severity: rule.severity || "high",
        observed: `Evaluator error: ${err.message}`,
        evidence: [],
        remediation: "Fix evaluator and rerun.",
        blocking: true
      });
    }
  }

  const summary = summarize(results, strict, rulesMeta);
  const report = {
    run: {
      id: runId,
      mode,
      target,
      tier,
      profiles,
      timestamp: nowIso(),
      toolVersion: TOOL_VERSION,
      rulePack: pack.packId
    },
    summary,
    results,
    confidence: {
      level: "medium-high",
      rationale: "Deterministic file/path checks plus heuristic code-signal checks."
    },
    limits: [
      "No exhaustive command fuzzing in v1.",
      "Heuristic code-pattern checks can produce partial confidence."
    ]
  };

  const markdown = renderMarkdown(report, rulesMeta);
  const outDir =
    args.out
      ? path.resolve(args.out)
      : path.join(target, ".basics", "results", runId);
  const outputs = writeRunOutputs(report, markdown, outDir);
  if (args["write-report"]) {
    const writePath = path.resolve(args["write-report"]);
    writeText(writePath, markdown);
  }

  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else if (format === "md") {
    console.log(markdown);
  } else {
    console.log(
      JSON.stringify(
        {
          ok: summary.blockingFailures === 0,
          runId,
          output: outputs,
          summary
        },
        null,
        2
      )
    );
  }

  if (summary.blockingFailures > 0) {
    process.exit(EXIT.BLOCKING);
  }
}

function commandRulesList(args) {
  const mode = args.mode === "assess" ? "assess" : "dirty-test";
  const pack = loadPackByMode(mode);
  const out = {
    toolVersion: TOOL_VERSION,
    mode,
    packId: pack.packId,
    packVersion: pack.version,
    rules: pack.rules.map((r) => ({
      ruleId: r.ruleId,
      severity: r.severity,
      mandatory: Boolean(r.mandatory),
      profiles: r.profiles
    }))
  };
  console.log(JSON.stringify(out, null, 2));
}

function commandReport(args) {
  if (!args.input) throw Object.assign(new Error("Missing --input"), { exitCode: EXIT.CONFIG });
  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) throw Object.assign(new Error(`Input report not found: ${inputPath}`), { exitCode: EXIT.DISCOVERY });
  const report = readJson(inputPath);
  const pack = loadPackById(report.run && report.run.rulePack);
  const rulesMeta = {};
  for (const rule of pack.rules) rulesMeta[rule.ruleId] = rule;
  const markdown = renderMarkdown(report, rulesMeta);
  const format = args.format || "md";
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (args.out) {
    writeText(path.resolve(args.out), markdown);
    console.log(JSON.stringify({ ok: true, out: path.resolve(args.out) }, null, 2));
    return;
  }
  console.log(markdown);
}

function commandClaimValidate(args) {
  if (!args.file) throw Object.assign(new Error("Missing --file"), { exitCode: EXIT.CONFIG });
  const filePath = path.resolve(args.file);
  if (!fs.existsSync(filePath)) throw Object.assign(new Error(`Claim file not found: ${filePath}`), { exitCode: EXIT.DISCOVERY });

  let claim;
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".yaml" || ext === ".yml") {
      claim = parseSimpleYaml(fs.readFileSync(filePath, "utf8"));
    } else {
      claim = readJson(filePath);
    }
  } catch (err) {
    throw Object.assign(new Error(`Claim file parse failure: ${err.message}`), { exitCode: EXIT.CONFIG });
  }

  const required = ["product", "basicsVersion", "tier", "profiles", "evidenceUri"];
  const missing = required.filter((k) => claim[k] === undefined);
  const validTier = ["core", "field", "industrial"].includes(String(claim.tier || "").toLowerCase());
  const profilesOk = Array.isArray(claim.profiles) && claim.profiles.length > 0;
  const out = {
    ok: missing.length === 0 && validTier && profilesOk,
    missing,
    validTier,
    profilesOk,
    toolVersion: TOOL_VERSION
  };
  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(EXIT.CONFIG);
}

function commandVersion() {
  console.log(TOOL_VERSION);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];

  if (!cmd || cmd === "help" || cmd === "--help") {
    printHelp();
    return;
  }
  if (cmd === "version") return commandVersion();
  if (cmd === "init") return commandInit(args);
  if (cmd === "detect") return commandDetect(args);
  if (cmd === "dirty-test") return commandDirtyTest(args, "dirty-test");
  if (cmd === "assess") return commandDirtyTest(args, "assess");
  if (cmd === "rules:list") return commandRulesList(args);
  if (cmd === "report") return commandReport(args);
  if (cmd === "claim:validate") return commandClaimValidate(args);

  throw Object.assign(new Error(`Unknown command: ${cmd}`), { exitCode: EXIT.CONFIG });
}

try {
  main();
} catch (err) {
  const exitCode = err.exitCode || EXIT.RUNTIME;
  console.error(`Error: ${err.message}`);
  process.exit(exitCode);
}

