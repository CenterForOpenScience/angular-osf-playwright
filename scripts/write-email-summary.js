#!/usr/bin/env node
// Builds the HTML body of the weekly regression results email from the merged
// Playwright JSON report (see merge.config.ts), and writes the email subject to
// $GITHUB_OUTPUT as `subject` when that variable is set.
//

// Usage: node scripts/write-email-summary.js <merged-results.json> > body.html
// Env: TEST_ENV, SERVICE, BROWSERS, RUN_URL, REGRESSION_RESULT (the regression_test
// job's result), EXPECTED_SHARDS / FOUND_SHARDS (optional, from merge_reports).
const fs = require('fs');

const reportPath = process.argv[2] || 'merged-results/results.json';
const env = (name, fallback = '') => process.env[name] || fallback;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripAnsi(str) {
  return (str || '').replace(/\x1b\[[0-9;]*m/g, '');
}

function firstLine(str) {
  return stripAnsi(str).trim().split('\n')[0] || 'Unknown error';
}

function formatDuration(ms) {
  const totalMinutes = Math.round((ms || 0) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function collectFailures(suite, titlePath, rows) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      if (test.status !== 'unexpected' && test.status !== 'flaky') continue;
      const failedResult =
        [...test.results].reverse().find((r) => r.status !== 'passed') ||
        test.results[test.results.length - 1];
      const error =
        failedResult?.error?.message || failedResult?.errors?.[0]?.message || 'Unknown error';
      rows.push({
        status: test.status,
        project: test.projectName || '',
        title: [...titlePath, spec.title].join(' › '),
        location: `${spec.file}:${spec.line}`,
        error: firstLine(error),
      });
    }
  }
  for (const child of suite.suites || []) {
    collectFailures(child, [...titlePath, child.title].filter(Boolean), rows);
  }
}

let report = null;
let reportProblem = '';
if (!fs.existsSync(reportPath)) {
  reportProblem = 'No merged test report was produced - every shard may have failed before reporting.';
} else {
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  } catch (err) {
    reportProblem = `The merged test report could not be parsed: ${err.message}`;
  }
}

const stats = report?.stats || {};
const passed = stats.expected || 0;
const failed = stats.unexpected || 0;
const flaky = stats.flaky || 0;
const skipped = stats.skipped || 0;

const failures = [];
for (const suite of report?.suites || []) collectFailures(suite, [], failures);
failures.sort((a, b) => (a.status === b.status ? 0 : a.status === 'unexpected' ? -1 : 1));

const expectedShards = Number(env('EXPECTED_SHARDS', '0'));
const foundShards = Number(env('FOUND_SHARDS', '0'));
const incomplete = !report || (expectedShards > 0 && foundShards < expectedShards);
const jobResult = env('REGRESSION_RESULT', 'unknown');

let verdict;
if (!report) verdict = 'NO RESULTS';
else if (failed > 0 || jobResult === 'failure') verdict = 'FAILED';
else if (incomplete || jobResult === 'cancelled') verdict = 'INCOMPLETE';
else verdict = 'PASSED';

const testEnv = env('TEST_ENV', 'unknown');
const today = new Date().toLocaleDateString('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const subject = `[OSF Playwright] Weekly Regression ${verdict} on ${testEnv} - ${today}${
  report ? ` (${passed} passed, ${failed} failed, ${flaky} flaky)` : ''
}`;

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `subject=${subject.replace(/\r?\n/g, ' ')}\n`);
}

const verdictColor = { PASSED: '#1a7f37', FAILED: '#cf222e' }[verdict] || '#9a6700';
const runUrl = env('RUN_URL');
const cell = 'style="padding:4px 8px;border:1px solid #d0d7de;vertical-align:top"';

const out = [];
out.push('<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2328">');
out.push(
  `<h2 style="margin:0 0 12px">Weekly Regression Tests: <span style="color:${verdictColor}">${verdict}</span></h2>`,
);
out.push('<table style="border-collapse:collapse;margin-bottom:12px">');
const info = [
  ['Environment', testEnv],
  ['Service', env('SERVICE', 'All')],
  ['Browsers', env('BROWSERS', '')],
  ['Regression job result', jobResult],
];
if (report) {
  info.push(
    ['Passed', passed],
    ['Failed', failed],
    ['Flaky (passed on retry)', flaky],
    ['Skipped', skipped],
    ['Duration (wall clock, all shards)', formatDuration(stats.duration)],
  );
}
if (expectedShards > 0) info.push(['Shards reported', `${foundShards} of ${expectedShards}`]);
for (const [label, value] of info) {
  out.push(`<tr><td ${cell}><b>${escapeHtml(label)}</b></td><td ${cell}>${escapeHtml(value)}</td></tr>`);
}
out.push('</table>');

if (reportProblem) {
  out.push(`<p style="color:#cf222e"><b>${escapeHtml(reportProblem)}</b></p>`);
} else if (incomplete) {
  out.push(
    '<p style="color:#9a6700"><b>Results are incomplete:</b> not every shard uploaded its report (it may have hit the 6h job limit or been cancelled). Check the shard jobs in the run.</p>',
  );
}

if (failures.length) {
  out.push(`<h3 style="margin:16px 0 8px">Failed and flaky tests (${failures.length})</h3>`);
  out.push('<table style="border-collapse:collapse;font-size:13px">');
  out.push(
    `<tr><th ${cell}>Status</th><th ${cell}>Browser</th><th ${cell}>Test</th><th ${cell}>Location</th><th ${cell}>Error</th></tr>`,
  );
  for (const row of failures) {
    const status = row.status === 'unexpected' ? '❌ failed' : '⚠️ flaky';
    out.push(
      `<tr><td ${cell}>${status}</td><td ${cell}>${escapeHtml(row.project)}</td><td ${cell}>${escapeHtml(
        row.title,
      )}</td><td ${cell}>${escapeHtml(row.location)}</td><td ${cell}>${escapeHtml(row.error)}</td></tr>`,
    );
  }
  out.push('</table>');
} else if (report) {
  out.push('<p>All tests passed. ✅</p>');
}

if (runUrl) {
  out.push(
    `<p style="margin-top:16px"><a href="${escapeHtml(runUrl)}">View the workflow run</a> - the merged Playwright HTML report (<code>playwright-report-merged</code>) and per-shard traces are attached to the run as artifacts for 7 days.</p>`,
  );
}
out.push('</div>');

console.log(out.join('\n'));
