#!/usr/bin/env node
// Reads Playwright's JSON reporter output and prints a markdown table of failed/flaky
// tests (title, file:line, error) to stdout - intended to be piped into
// $GITHUB_STEP_SUMMARY so failures are visible on the workflow run page without
// downloading the html report or trace artifacts.
const fs = require('fs');

const reportPath = process.argv[2] || 'test-results/results.json';

function stripAnsi(str) {
  return (str || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function firstLine(str) {
  const cleaned = stripAnsi(str).trim();
  return cleaned.split('\n')[0] || 'Unknown error';
}

function escapeCell(str) {
  return String(str).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function walk(suite, titlePath, rows) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      if (test.status !== 'unexpected' && test.status !== 'flaky') continue;

      const failedResult =
        [...test.results].reverse().find((r) => r.status !== 'passed') ||
        test.results[test.results.length - 1];
      const error =
        failedResult?.error?.message || failedResult?.errors?.[0]?.message || 'Unknown error';

      rows.push({
        title: [...titlePath, spec.title].join(' › '),
        location: `${spec.file}:${spec.line}`,
        project: test.projectName || '',
        status: test.status,
        error: firstLine(error),
      });
    }
  }
  for (const child of suite.suites || []) {
    walk(child, [...titlePath, child.title].filter(Boolean), rows);
  }
}

if (!fs.existsSync(reportPath)) {
  console.log(`_No JSON report found at \`${reportPath}\` - nothing to summarize._`);
  process.exit(0);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
} catch (err) {
  console.log(`_Could not parse \`${reportPath}\`: ${err.message}_`);
  process.exit(0);
}

const rows = [];
for (const suite of report.suites || []) {
  walk(suite, [], rows);
}

if (rows.length === 0) {
  console.log('All tests passed. :white_check_mark:');
  process.exit(0);
}

console.log('## Failed tests\n');
console.log('| Status | Project | Test | Location | Error |');
console.log('|---|---|---|---|---|');
for (const row of rows) {
  const status = row.status === 'unexpected' ? '❌ failed' : '⚠️ flaky (passed on retry)';
  console.log(
    `| ${status} | ${escapeCell(row.project)} | ${escapeCell(row.title)} | ${escapeCell(row.location)} | ${escapeCell(row.error)} |`,
  );
}
