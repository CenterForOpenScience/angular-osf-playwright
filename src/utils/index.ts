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
