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


  async getDates(labelText: string): Promise<Date[]> {
    const texts = await this.page
      .locator('p', { hasText: `${labelText}:` })
      .allInnerTexts();
    return texts.map((text) => new Date(text.replace(`${labelText}: `, '').trim()));
  }

  /** Port of `pages/base.py`'s `BasePage.assert_sorting`. */
  assertSorting(dates: Date[], order: 'ascending' | 'descending' = 'ascending'): void {
    const times = dates.map((date) => date.getTime());
    const sortedAscending = [...times].sort((a, b) => a - b);
    const expected = order === 'ascending' ? sortedAscending : [...sortedAscending].reverse();
    expect(times).toEqual(expected);
  }
}
