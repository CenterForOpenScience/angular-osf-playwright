import { defineConfig } from '@playwright/test';

/**
 * Config for `npx playwright merge-reports --config merge.config.ts` in the weekly
 * regression workflow's merge_reports job. Merges every shard's blob report into one
 * HTML report plus one JSON report; the JSON feeds scripts/write-email-summary.js.
 */
export default defineConfig({
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'merged-results/results.json' }],
  ],
});
