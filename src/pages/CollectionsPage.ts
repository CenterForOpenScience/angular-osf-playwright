import { Locator, Page, expect, test } from '@playwright/test';

import * as settings from '../../config/settings';
import { present } from '../utils';
import { SearchPage } from './SearchPage';


export class CollectionDiscoverPage extends SearchPage {
  constructor(
    page: Page,
    protected readonly providerId: string
  ) {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/collections/${this.providerId}/discover`;
  }

  get identity(): Locator {
    return this.page.locator('osf-collections-discover');
  }

  get providerName(): Locator {
    return this.identity.getByRole('heading', { level: 1 });
  }

  /** Python's `osf-resource-card` result count check (`searchResults` is the card's inner div). */
  get resultCards(): Locator {
    return this.page.locator('osf-resource-card');
  }

  get pageNotFound(): Locator {
    return this.page.locator('osf-page-not-found');
  }

  private get filters(): Locator {
    return this.page.locator('osf-search-filters');
  }

  /** An accordion filter of the collection's own metadata, e.g. "Status". */
  collectionFieldMenu(field: string): Locator {
    return this.filters.getByRole('button', { name: field, exact: true });
  }

  get statusMenu(): Locator {
    return this.collectionFieldMenu('Status');
  }

  get programAreaMenu(): Locator {
    return this.collectionFieldMenu('Program Area');
  }

  /** The multiselect of the accordion filter that is open. */
  get openFilterMultiselectDropdown(): Locator {
    return this.additionalMultiselectDropdown;
  }


  async getRecordName(index: string): Promise<string> {
    const option = this.optionByIndex(index);
    await expect(option).toBeVisible();
    await expect(option).not.toHaveText(/no results found/i);
    return (await option.innerText()).replace(/\s*\(\d+\)/, '').trim();
  }

  /** Port of `skip_test_if_page_not_found`. */
  async skipIfPageNotFound(): Promise<void> {
    await expect(this.identity.or(this.pageNotFound).first()).toBeVisible({
      timeout: settings.LONG_TIMEOUT_MS,
    });
    test.skip(await this.pageNotFound.isVisible(), 'Page not found is displayed');
  }


  async skipIfFilterNotPresent(menu: Locator): Promise<void> {
    await expect(this.filters.locator('p-accordion-header').first()).toBeVisible({
      timeout: settings.LONG_TIMEOUT_MS,
    });
    test.skip(!(await present(menu)), 'Filter is not available on this environment.');
  }


  async checkFilteringByCollectionField(menu: Locator, field: string): Promise<void> {
    await menu.click();
    await this.openFilterMultiselectDropdown.click();
    const nameOfRecord = await this.getRecordName('1');
    await this.waitForResults(() => this.optionCheckboxByIndex('1').click({ force: true }));
    await expect(this.page.locator('.p-chip-label', { hasText: `${field}: ${nameOfRecord}` })).toBeVisible();
  }
}


export class CollectionSearchPage extends CollectionDiscoverPage {
  constructor(page: Page) {
    super(
      page,
      settings.TEST4 || settings.STAGE4 || settings.PRODUCTION || settings.TEST ? 'ibdgc' : 'iafns'
    );
  }

  get url(): string {
    return `${settings.OSF_HOME}/collections/${this.providerId}`;
  }
}
