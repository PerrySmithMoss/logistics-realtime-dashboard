import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const advisory = 'GHSA-fc5q-39xc-vjpf';
const advisoryUrl = `https://github.com/advisories/${advisory}`;
const anchor = '  const extglobOpen = (type, value) => {\n';
export const guard = "    // GHSA-fc5q-39xc-vjpf: block repeated extglobs before regex construction.\n" +
  "    if (value === '+' || value === '*') {\n" +
  "      throw new SyntaxError('Repeated extglobs are disabled (CVE-2026-112366)');\n" +
  '    }\n';
export const originalHashes = {
  '2.3.2': '3a91656f440069aa8f8e15c9d695b9f6b2209df1eab2be8127c72cbcca45ff5f',
  '4.0.7': '4e1e05447668aa1e94366c5516a2bcd8f5fff800cc92b1d0cd7d77703b8618c4',
};
const digest = (source) => createHash('sha256').update(source).digest('hex');

// Visit physical packages, including nested npm/Yarn copies and pnpm's store.
// Following only package/node_modules boundaries avoids walking workspace source.
export function installedCopies(root) {
  assert.ok(existsSync(join(root, 'node_modules')), `Install dependencies first: ${root}`);
  const seen = new Set();
  const copies = [];
  function visitPackage(path) {
    if (!existsSync(join(path, 'package.json'))) return;
    const physical = realpathSync(path);
    if (seen.has(physical)) return;
    seen.add(physical);
    const pkg = JSON.parse(readFileSync(join(physical, 'package.json'), 'utf8'));
    if (pkg.name === 'picomatch') {
      assert.ok(physical.startsWith(realpathSync(join(root, 'node_modules')) + sep), 'Picomatch is outside the local installation');
      copies.push({ path: physical, version: pkg.version });
    }
    visitModules(join(physical, 'node_modules'));
  }
  function visitModules(path) {
    if (!existsSync(path)) return;
    const physical = realpathSync(path);
    if (seen.has(physical)) return;
    seen.add(physical);
    for (const entry of readdirSync(physical, { withFileTypes: true })) {
      const child = join(physical, entry.name);
      if (entry.name === '.pnpm') {
        for (const pkg of readdirSync(child, { withFileTypes: true })) {
          if (pkg.isDirectory()) visitModules(join(child, pkg.name, 'node_modules'));
        }
      } else if (entry.name.startsWith('@')) {
        for (const pkg of readdirSync(child)) visitPackage(join(child, pkg));
      } else if (!entry.name.startsWith('.')) {
        visitPackage(child);
      }
    }
  }
  visitModules(join(root, 'node_modules'));
  return copies;
}

export function checkedSource(version, source, apply = false) {
  const expected = originalHashes[version];
  assert.ok(expected, `Unreviewed Picomatch version: ${version}`);
  if (apply && digest(source) === expected) {
    assert.equal(source.split(anchor).length, 2, 'Parser entry point changed');
    return source.replace(anchor, anchor + guard);
  }
  const original = source.replace(anchor + guard, anchor);
  assert.equal(source.split(guard).length, 2, 'Picomatch mitigation is missing or duplicated');
  assert.equal(digest(original), expected, 'Picomatch parser differs from the reviewed source');
  assert.equal(original.replace(anchor, anchor + guard), source, 'Picomatch mitigation moved');
  return source;
}

export function verifyInstalled(root, apply = false) {
  const copies = installedCopies(root);
  for (const copy of copies) {
    const path = join(copy.path, 'lib/parse.js');
    const source = readFileSync(path, 'utf8');
    const patched = checkedSource(copy.version, source, apply);
    if (patched !== source) {
      // Break pnpm hard links instead of modifying its shared content store.
      const temporary = `${path}.mitigation-${process.pid}`;
      writeFileSync(temporary, patched, { mode: statSync(path).mode & 0o777 });
      renameSync(temporary, path);
    }
    checkedSource(copy.version, readFileSync(path, 'utf8'));
  }
  return copies;
}

const severities = ['info', 'low', 'moderate', 'high', 'critical'];
function validateCounts(counts) {
  assert.ok(counts && typeof counts === 'object', 'Missing audit summary');
  for (const severity of severities) {
    assert.ok(Number.isSafeInteger(counts[severity]) && counts[severity] >= 0,
      `Invalid audit count: ${severity}`);
  }
}

function validateFindings(findings, counts) {
  validateCounts(counts);
  for (const severity of severities) {
    assert.equal(findings.filter((finding) => finding.severity === severity).length, counts[severity],
      `Incomplete audit findings: ${severity}`);
  }
}

// An advisory is accepted only after every installed parser passed verification.
// The exported policy also supports fixtures proving unrelated findings fail.
export function assessAudit(manager, stdout, copies, root, threshold = 'info') {
  const minimum = severities.indexOf(threshold);
  assert.ok(minimum >= 0, 'Unknown audit threshold');
  const versions = new Set(copies.map((copy) => copy.version));
  let mitigated = 0;
  const blockers = [];
  function isMitigated(finding) {
    const name = finding.module_name ?? finding.name;
    const match = name === 'picomatch' && finding.url === advisoryUrl && copies.length > 0;
    if (!match) return false;
    for (const item of finding.findings ?? []) {
      assert.ok(versions.has(item.version), `Audited Picomatch copy is not installed: ${item.version}`);
    }
    mitigated++;
    return true;
  }
  function record(finding) {
    assert.ok(severities.includes(finding.severity), 'Unknown advisory severity');
    if (!isMitigated(finding) && severities.indexOf(finding.severity) >= minimum) {
      blockers.push(finding.url ?? finding.name ?? finding.module_name);
    }
  }
  if (manager === 'npm') {
    const report = JSON.parse(stdout);
    assert.equal(report.auditReportVersion, 2, 'Unsupported npm audit report');
    assert.ok(!report.error && report.vulnerabilities && report.metadata, 'Incomplete npm audit report');
    validateFindings(Object.values(report.vulnerabilities), report.metadata.vulnerabilities);
    const graph = report.vulnerabilities;
    function covered(name) {
      // npm's transitive metadata can contain dependency cycles. Inspect every
      // reachable cause once; a cycle alone is never evidence of mitigation.
      const pending = [name];
      const visited = new Set();
      let foundMitigation = false;
      let allCovered = true;
      while (pending.length) {
        const current = pending.pop();
        if (visited.has(current)) continue;
        visited.add(current);
        const finding = graph[current];
        assert.ok(finding && Array.isArray(finding.via) && finding.via.length, 'Incomplete npm advisory graph');
        for (const via of finding.via) {
          if (typeof via === 'string') {
            pending.push(via);
          } else if (isMitigated(via)) {
            foundMitigation = true;
            assert.ok(Array.isArray(finding.nodes) && finding.nodes.length, 'Missing affected npm paths');
            for (const path of finding.nodes) {
              const physical = realpathSync(resolve(root, path));
              assert.ok(copies.some((copy) => copy.path === physical), `Unverified npm path: ${path}`);
            }
          } else {
            allCovered = false;
          }
        }
      }
      return foundMitigation && allCovered;
    }
    for (const [name, finding] of Object.entries(graph)) {
      assert.ok(severities.includes(finding.severity), 'Unknown npm advisory severity');
      if (!covered(name) && severities.indexOf(finding.severity) >= minimum) blockers.push(name);
    }
    if (Object.keys(graph).length === 0) {
      assert.ok(Object.values(report.metadata.vulnerabilities).every((count) => count === 0), 'Missing npm findings');
    }
  } else if (manager === 'pnpm') {
    const report = JSON.parse(stdout);
    assert.ok(!report.error && report.advisories && report.metadata, 'Incomplete pnpm audit report');
    validateFindings(Object.values(report.advisories), report.metadata.vulnerabilities);
    for (const finding of Object.values(report.advisories)) record(finding);
    if (Object.keys(report.advisories).length === 0) {
      assert.ok(Object.values(report.metadata.vulnerabilities).every((count) => count === 0), 'Missing pnpm findings');
    }
  } else if (manager === 'yarn') {
    const records = stdout.trim().split('\n').map((line) => JSON.parse(line));
    assert.ok(!records.some((row) => row.type === 'error'), 'Yarn audit failed');
    const summaries = records.filter((row) => row.type === 'auditSummary');
    assert.equal(summaries.length, 1, 'Missing or duplicate Yarn audit summary');
    validateCounts(summaries[0].data.vulnerabilities);
    const findings = records.filter((row) => row.type === 'auditAdvisory');
    validateFindings(findings.map((row) => row.data.advisory), summaries[0].data.vulnerabilities);
    const total = Object.values(summaries[0].data.vulnerabilities).reduce((sum, count) => sum + count, 0);
    assert.equal(findings.length, total, 'Incomplete Yarn audit findings');
    for (const finding of findings) record(finding.data.advisory);
  } else {
    throw new Error(`Unsupported package manager: ${manager}`);
  }
  return { mitigated, blockers };
}

export function validateAuditExit(manager, stdout, status) {
  if (manager === 'npm') {
    // npm is invoked with --audit-level=none, so a nonzero exit is an error.
    assert.equal(status, 0, 'npm audit command failed');
  } else {
    const counts = manager === 'pnpm' ? JSON.parse(stdout).metadata.vulnerabilities :
      stdout.trim().split('\n').map((line) => JSON.parse(line))
        .find((row) => row.type === 'auditSummary').data.vulnerabilities;
    const expected = manager === 'pnpm' ? Number(Object.values(counts).some((count) => count > 0)) :
      severities.reduce((mask, severity, index) => mask | (counts[severity] ? 2 ** index : 0), 0);
    assert.equal(status, expected, 'Audit exit status contradicts its report');
  }
}

export function auditInstalled(manager, root, options = []) {
  assert.ok(['npm', 'pnpm', 'yarn'].includes(manager), 'Unsupported package manager');
  assert.ok(options.every((option) => ['--omit=dev', '--audit-level=high'].includes(option)), 'Unsupported audit option');
  const copies = verifyInstalled(root);
  const args = ['audit', '--json'];
  if (manager === 'npm') args.push('--audit-level=none', ...options.filter((option) => option === '--omit=dev'));
  if (manager === 'yarn') args.push('--registry', 'https://registry.npmjs.org');
  const result = spawnSync(manager, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  assert.ok(!result.error && !result.signal, 'Dependency audit did not complete');
  assert.ok(Number.isInteger(result.status) && result.status >= 0 && result.status <= (manager === 'yarn' ? 31 : 1), 'Dependency audit command failed');
  const outcome = assessAudit(manager, result.stdout, copies, root, options.includes('--audit-level=high') ? 'high' : 'info');
  validateAuditExit(manager, result.stdout, result.status);
  verifyInstalled(root);
  assert.equal(outcome.blockers.length, 0, `Unmitigated audit findings: ${outcome.blockers.join(', ')}`);
  process.stdout.write(`Verified ${copies.length} patched Picomatch copies; ${outcome.mitigated} advisory paths covered by ${advisory}.\n`);
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, target, directory, ...options] = process.argv.slice(2);
  if (command === 'patch' || command === 'verify') {
    assert.ok(target && !directory, 'Usage: picomatch.mjs patch|verify DIRECTORY');
    const copies = verifyInstalled(resolve(target), command === 'patch');
    process.stdout.write(`Verified ${copies.length} Picomatch copies (${command}).\n`);
  } else {
    assert.equal(command, 'audit', 'Expected patch, verify, or audit');
    assert.ok(target && directory, 'Usage: picomatch.mjs audit MANAGER DIRECTORY [OPTIONS]');
    auditInstalled(target, resolve(directory), options);
  }
}
