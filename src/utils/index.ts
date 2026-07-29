import { Page } from '@playwright/test';

/**
 * Port of `wait_until_page_ready` from utils.py. Waits for the document to finish
 * loading and for the PrimeNG loading indicators OSF uses to disappear, if present.
 */
export async function waitUntilPageReady(page: Page, timeoutMs = 60000): Promise<void> {
  await page.waitForFunction(() => document.readyState === 'complete', undefined, {
    timeout: timeoutMs,
  });

  await page
    .locator('p-progress-spinner')
    .first()
    .waitFor({ state: 'hidden', timeout: timeoutMs })
    .catch(() => undefined);

  await page
    .locator('p-skeleton.p-skeleton')
    .first()
    .waitFor({ state: 'hidden', timeout: timeoutMs })
    .catch(() => undefined);
}
