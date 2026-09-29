import { Page, Locator, expect } from '@playwright/test';

import * as settings from '../../config/settings';

/**
 * Port of `pages/base.py`'s `BasePage`. Playwright locators already auto-wait, so the
 * old `Locator`/`WebElementWrapper` waiting machinery from base/locators.py is not
 * needed here - page objects just expose `Locator` getters directly.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Pages without a directly-navigable URL (e.g. Login2FAPage) leave this null. */
  get url(): string | null {
    return null;
  }

  abstract get identity(): Locator;

  async goto(): Promise<this> {
    const target = this.url;
    if (!target) {
      throw new Error(`${this.constructor.name} has no url to navigate to.`);
    }
    await this.page.goto(target);
    return this;
  }

  async verify(timeout: number = settings.TIMEOUT_MS): Promise<this> {
    await expect(this.identity).toBeVisible({ timeout });
    return this;
  }

  /**
   * Equivalent of the Python `PageClass(driver, verify=True)` idiom used throughout
   * test_login.py to assert you've landed on a given page.
   */
  static async expectOn<T extends BasePage>(
    this: new (page: Page) => T,
    page: Page,
    timeout?: number
  ): Promise<T> {
    const instance = new this(page);
    await instance.verify(timeout);
    return instance;
  }


  /**
   * Reads every "<label>: <Month D, YYYY>" date line on the page, in DOM order. Several
   * labels can be passed for mixed-type result lists (e.g. `['Date created', 'Date
   * registered']` - registration cards show their creation date under the latter).
   * Throws on an unparseable date rather than letting `Invalid Date` (NaN) through, since
   * NaN compares equal to itself in `assertSorting` and would hide a broken read.
   */
  async getDates(labelText: string | string[]): Promise<Date[]> {
    const labels = Array.isArray(labelText) ? labelText : [labelText];
    const labelPattern = new RegExp(`^\\s*(?:${labels.join('|')}):\\s*`);
    const texts = await this.page.locator('p', { hasText: labelPattern }).allInnerTexts();
    return texts.map((text) => {
      const value = text.replace(labelPattern, '').trim();
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Could not parse date "${value}" from "${text}"`);
      }
      return date;
    });
  }

  /** Port of `pages/base.py`'s `BasePage.assert_sorting`. */
  assertSorting(dates: Date[], order: 'ascending' | 'descending' = 'ascending'): void {
    // An empty or single-item list is trivially "sorted" - require real data so a
    // selector that stops matching fails loudly instead of passing vacuously.
    expect(dates.length, 'need at least two dates to verify sorting').toBeGreaterThan(1);
    const times = dates.map((date) => date.getTime());
    const sortedAscending = [...times].sort((a, b) => a - b);
    const expected = order === 'ascending' ? sortedAscending : [...sortedAscending].reverse();
    expect(times).toEqual(expected);
  }
}
