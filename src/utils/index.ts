import { Page, Locator } from '@playwright/test';

import * as settings from '../../config/settings';

/**
 * Port of `base/locators.py`'s `Locator.present()`. Waits for the element to become
 * visible; returns `false` (rather than throwing) on timeout.
 */
export async function present(
  locator: Locator,
  timeout: number = settings.TIMEOUT_MS
): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/** Port of `base/locators.py`'s `Locator.absent()`. */
export async function absent(
  locator: Locator,
  timeout: number = settings.TIMEOUT_MS
): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: 'hidden', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Port of `base/locators.py`'s `Locator.here_then_gone()`. Waits for an element to
 * appear and then disappear - commonly used for loading spinners. Appearance is not
 * mandatory since the element may disappear faster than it can be observed.
 */
export async function hereThenGone(
  locator: Locator,
  timeout: number = settings.TIMEOUT_MS
): Promise<boolean> {
  await present(locator, timeout);
  if (!(await absent(locator, timeout))) {
    throw new Error('Element is not absent.');
  }
  return true;
}

/**
 * Port of `wait_until_page_ready` from utils.py. Waits for the document to finish
 * loading, then for any PrimeNG progress spinner / skeleton loaders to disappear -
 * both waits are best-effort (matches the Python version swallowing
 * `TimeoutException`) since the elements may never have been present at all.
 */
export async function waitUntilPageReady(page: Page, timeout = 60000): Promise<void> {
  await page.waitForFunction(() => document.readyState === 'complete', undefined, { timeout });
  await page
    .locator('p-progress-spinner')
    .first()
    .waitFor({ state: 'hidden', timeout })
    .catch(() => undefined);
  await page
    .locator('p-skeleton.p-skeleton')
    .first()
    .waitFor({ state: 'hidden', timeout })
    .catch(() => undefined);
}

/** Port of `wait_until_toast_message_gone` from utils.py. */
export async function waitUntilToastMessageGone(page: Page, timeout = 10000): Promise<void> {
  await page
    .locator('p-toastitem')
    .first()
    .waitFor({ state: 'detached', timeout })
    .catch(() => undefined);
}

/** Port of `wait_for_overlay_to_disappear` from utils.py. */
export async function waitForOverlayToDisappear(page: Page, timeout = 10000): Promise<void> {
  await page
    .locator('.p-dialog-mask.p-overlay-mask')
    .first()
    .waitFor({ state: 'hidden', timeout })
    .catch(() => undefined);
}

/**
 * Port of `normalize_api_date` from utils.py - truncates an API ISO date string to
 * minute precision, keeping the literal Y/M/D/H/M digits as given (Python's
 * `strftime` on the parsed value never re-applies a timezone conversion).
 */
export function normalizeApiDate(apiDate: string): string {
  const match = apiDate.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    throw new Error(`Unrecognized API date format: ${apiDate}`);
  }
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * Port of `normalize_ui_date` from utils.py. The Python original assumed the UI always
 * renders in a fixed `America/New_York` wall clock and converted from that - verified
 * live (via `_debug_inspect.spec.ts` per CLAUDE.md) that the current Angular app
 * instead just formats dates in the browser's own local timezone, which Playwright
 * inherits from the runner's system timezone (`playwright.config.ts` sets no
 * `timezoneId` override, so browser and Node process agree). That makes this much
 * simpler than the Python version: `new Date(uiDate)` already parses the displayed
 * string as local time, so its `getTime()` is the correct absolute instant with no
 * further timezone conversion needed - just read it back out in UTC and truncate to
 * minute precision, matching `normalizeApiDate`'s raw (UTC) API value.
 */
export function normalizeUiDate(uiDate: string): string {
  const parsed = new Date(uiDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Unrecognized UI date format: ${uiDate}`);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getUTCFullYear()}-${pad(parsed.getUTCMonth() + 1)}-${pad(
    parsed.getUTCDate()
  )}T${pad(parsed.getUTCHours())}:${pad(parsed.getUTCMinutes())}`;
}

/** Port of `page_refresh_with_clean_storages` from utils.py. */
export async function pageRefreshWithCleanStorages(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload();
}

/** Port of `get_user_name_from_header` from utils.py. */
export async function getUserNameFromHeader(page: Page): Promise<string> {
  const userNameEl = page.locator('p-button.link-btn-no-padding button');
  await userNameEl.waitFor({ state: 'visible', timeout: 10000 });
  return (await userNameEl.innerText()).trim();
}

/**
 * Port of the `click_expecting_popup()` + `driver.switch_to.window(driver.window_handles[-1])`
 * pattern used throughout the Python search tests to follow a search-result title
 * link into the new tab it opens.
 */
export async function clickExpectingPopup(page: Page, locator: Locator): Promise<Page> {
  const [popup] = await Promise.all([page.context().waitForEvent('page'), locator.click()]);
  await popup.waitForLoadState();
  return popup;
}

/**
 * Search-result card title links are matched by `.first()` on a generic
 * class-based locator that gets re-evaluated fresh at click time. Card-validation
 * flows read several fields off the "first" card, then click its title link many
 * awaits later (accordion expand, `present()` checks, etc.) - if the live search
 * results re-sort or refresh in between (verified as a real, if infrequent,
 * occurrence against this suite's shared, non-mocked backend), `.first()` can
 * silently resolve to a *different* resource by click time, opening the wrong
 * popup and failing the comparison against the fields already read. Capture the
 * anchor's `href` right after reading the title, then click by that href
 * specifically so the same resource that was read is the one that gets clicked.
 *
 * `href` alone isn't a unique key, though: a card's own "URL:" secondary-metadata
 * link (inside the accordion these flows expand before clicking the title) points
 * at that same resource, so `a[href="..."]` matches both - verified live via
 * `tests/_debug_inspect.spec.ts` per CLAUDE.md. Scope to the title link's own
 * `data-test-search-result-card-title-link` marker as well so an href match can
 * only ever resolve to the actual title anchor.
 */
export async function clickExpectingPopupByHref(
  page: Page,
  titleLocator: Locator,
  href: string | null
): Promise<Page> {
  const target = href
    ? page.locator(`a[data-test-search-result-card-title-link][href="${href}"]`).first()
    : titleLocator;
  return clickExpectingPopup(page, target);
}
