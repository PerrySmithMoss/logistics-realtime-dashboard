import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { advisory, assessAudit, checkedSource, guard, validateAuditExit, verifyInstalled } from './picomatch.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const roots = existsSync(join(root, 'web/package-lock.json')) ? [join(root, 'web'), join(root, 'mobile')] : [root];
const copies = roots.flatMap((path) => verifyInstalled(path));
assert.ok(copies.length, 'Security regression tests require installed Picomatch copies');
const url = `https://github.com/advisories/${advisory}`;
const counts = { info: 0, low: 0, moderate: 0, high: 1, critical: 0 };
const finding = { module_name: 'picomatch', url, severity: 'high', findings: [{ version: '4.0.7' }] };

test('audit command failures cannot be mistaken for a clean or mitigated report', () => {
  const pnpm = JSON.stringify({ metadata: { vulnerabilities: counts } });
  const yarn = JSON.stringify({ type: 'auditSummary', data: { vulnerabilities: counts } });
  validateAuditExit('npm', '{}', 0);
  assert.throws(() => validateAuditExit('npm', '{}', 1), /command failed/);
  validateAuditExit('pnpm', pnpm, 1);
  assert.throws(() => validateAuditExit('pnpm', pnpm, 2), /contradicts/);
  validateAuditExit('yarn', yarn, 8);
  assert.throws(() => validateAuditExit('yarn', yarn, 1), /contradicts/);
});

test('all physical copies reject repeated extglobs, including bypass options, within a hard timeout', () => {
  for (const copy of copies) {
    const child = spawnSync(process.execPath, ['--input-type=commonjs', '-e', `
      const assert = require('node:assert/strict');
      const pm = require(process.argv[1]);
      const parse = require(process.argv[1] + '/lib/parse');
      const patterns = ['+(*)', '+(*a)', '*(*a)', 'x/+(*a)', '!(+(*a))', '@(+(*a)|foo)', '+(ab|abab)', '+('.repeat(200) + '*a' + ')'.repeat(200)];
      for (const pattern of patterns) {
        for (const options of [{}, {fastpaths:false}, {maxExtglobRecursion:false}, {capture:true}, {debug:true}]) {
          for (const compile of [() => pm(pattern, options), () => pm.makeRe(pattern, options), () => pm.parse(pattern, options), () => parse(pattern, options)]) {
            assert.throws(compile, /CVE-2026-112366/);
          }
        }
      }
      assert.throws(() => pm('**/*', {ignore:'+(*a)'}), /CVE-2026-112366/);
      for (const [input, pattern, expected] of [
        ['src/foo.ts','**/*.{js,ts}',true], ['src/foo.txt','**/*.{js,ts}',false],
        ['foo.test.ts','**/*.?(c|m)[jt]s?(x)',true], ['foo','@(foo|bar)',true],
        ['a.js','*.!(txt)',true], ['a.txt','*.!(txt)',false], ['package.json','**/package.json',true],
      ]) assert.equal(pm.isMatch(input,pattern), expected, pattern);
      assert.equal(typeof pm.scan('src/**/*.ts').base, 'string');
      assert.equal(pm.isMatch('src\\\\foo.ts', '**/*.ts', {windows:true}), true);
    `, copy.path], { encoding: 'utf8', timeout: 3000 });
    assert.equal(child.error, undefined, child.error?.message);
    assert.equal(child.signal, null, child.stderr);
    assert.equal(child.status, 0, `${copy.path}: ${child.stderr}`);
  }
});

test('unpatched, changed, duplicate, moved, and unreviewed parsers fail closed', () => {
  for (const copy of copies) {
    const source = readFileSync(join(copy.path, 'lib/parse.js'), 'utf8');
    assert.equal(checkedSource(copy.version, source), source);
    const original = source.replace(guard, '');
    assert.throws(() => checkedSource(copy.version, original), /missing/);
    assert.equal(checkedSource(copy.version, original, true), source);
    assert.throws(() => checkedSource(copy.version, source + '\n// changed'), /differs/);
    assert.throws(() => checkedSource(copy.version, source + guard), /duplicated/);
    assert.throws(() => checkedSource(copy.version, original + guard), /differs|moved/);
    assert.throws(() => checkedSource('4.0.8', source), /Unreviewed/);
  }
});

test('nested npm and pnpm store copies are independently verified', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'picomatch-policy-'));
  try {
    const locations = ['node_modules/picomatch', 'node_modules/consumer/node_modules/picomatch', 'node_modules/.pnpm/picomatch@4.0.7/node_modules/picomatch'];
    const source = readFileSync(join(copies.find((copy) => copy.version === '4.0.7').path, 'lib/parse.js'), 'utf8');
    mkdirSync(join(fixture, 'node_modules/consumer'), { recursive: true });
    writeFileSync(join(fixture, 'node_modules/consumer/package.json'), '{"name":"consumer"}');
    for (const location of locations) {
      mkdirSync(join(fixture, location, 'lib'), { recursive: true });
      writeFileSync(join(fixture, location, 'package.json'), '{"name":"picomatch","version":"4.0.7"}');
      writeFileSync(join(fixture, location, 'lib/parse.js'), source);
    }
    assert.equal(verifyInstalled(fixture).length, 3);
    writeFileSync(join(fixture, locations[1], 'lib/parse.js'), source.replace(guard, ''));
    assert.throws(() => verifyInstalled(fixture), /missing/);
    assert.equal(verifyInstalled(fixture, true).length, 3);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('pnpm and Yarn accept only the exact mitigated advisory and complete reports', () => {
  const report = { advisories: { 1: finding }, metadata: { vulnerabilities: counts } };
  assert.deepEqual(assessAudit('pnpm', JSON.stringify(report), copies, root).blockers, []);
  const unrelated = { ...finding, url: 'https://github.com/advisories/GHSA-other-issue' };
  report.advisories[2] = unrelated;
  report.metadata.vulnerabilities = { ...counts, high: 2 };
  assert.equal(assessAudit('pnpm', JSON.stringify(report), copies, root).blockers.length, 1);
  const rows = [{ type: 'auditAdvisory', data: { advisory: finding } }, { type: 'auditSummary', data: { vulnerabilities: counts } }];
  const jsonl = () => rows.map((row) => JSON.stringify(row)).join('\n');
  assert.deepEqual(assessAudit('yarn', jsonl(), copies, root).blockers, []);
  rows[0].data.advisory = unrelated;
  assert.equal(assessAudit('yarn', jsonl(), copies, root).blockers.length, 1);
  assert.throws(() => assessAudit('pnpm', '{}', copies, root), /Incomplete/);
  assert.throws(() => assessAudit('pnpm', JSON.stringify({ advisories: {}, metadata: { vulnerabilities: counts } }), copies, root), /Incomplete/);
  assert.throws(() => assessAudit('yarn', JSON.stringify(rows[0]), copies, root), /summary/);
  assert.throws(() => assessAudit('yarn', JSON.stringify(rows[1]), copies, root), /Incomplete/);
  assert.equal(assessAudit('pnpm', JSON.stringify({ advisories: { 1: finding }, metadata: { vulnerabilities: counts } }), [], root).blockers.length, 1);
});

test('npm transitive findings remain blocked if any cause is unmitigated or any affected path is unverified', () => {
  const copy = copies[0];
  const direct = { name: 'picomatch', severity: 'high', via: [{ name: 'picomatch', url, severity: 'high' }], nodes: [copy.path] };
  const report = { auditReportVersion: 2, vulnerabilities: { picomatch: direct, consumer: { severity: 'high', via: ['picomatch'] } }, metadata: { vulnerabilities: { ...counts, high: 2 } } };
  assert.deepEqual(assessAudit('npm', JSON.stringify(report), copies, root).blockers, []);
  report.vulnerabilities.loop = { severity: 'high', via: ['consumer'] };
  report.vulnerabilities.consumer.via.push('loop');
  report.metadata.vulnerabilities.high = 3;
  assert.deepEqual(assessAudit('npm', JSON.stringify(report), copies, root).blockers, []);
  direct.via.push({ name: 'picomatch', url: 'https://github.com/advisories/GHSA-other-issue', severity: 'high' });
  assert.deepEqual(assessAudit('npm', JSON.stringify(report), copies, root).blockers.sort(), ['consumer', 'loop', 'picomatch']);
  direct.via.pop();
  direct.nodes = [root];
  assert.throws(() => assessAudit('npm', JSON.stringify(report), copies, root), /Unverified/);
  assert.throws(() => assessAudit('npm', '{"error":{"code":"ENETWORK"}}', copies, root), /Unsupported/);
  report.vulnerabilities = { a: { severity: 'high', via: ['b'] }, b: { severity: 'high', via: ['a'] } };
  report.metadata.vulnerabilities.high = 2;
  assert.deepEqual(assessAudit('npm', JSON.stringify(report), copies, root).blockers.sort(), ['a', 'b']);
});
