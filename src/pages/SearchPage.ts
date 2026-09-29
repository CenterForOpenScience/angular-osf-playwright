import { Locator, expect, test } from '@playwright/test';

import * as settings from '../../config/settings';
import { present, clickExpectingPopup, waitUntilPageReady, hereThenGone } from '../utils';
import { BasePage } from './BasePage';

/**
 * Port of `pages/search.py`. The Python source splits `SearchPage` (locators only)
 * from `SearchPageHelpers(SearchPage)` (the `check_filtering_by_*` / `check_sorting_by_*`
 * test-helper methods) purely so plain `SearchPage(driver)` instances didn't carry
 * those methods - this project doesn't make that distinction elsewhere (e.g.
 * `LoginPage.ts` mixes locators and action methods freely), so they're folded into
 * one class here.
 *
 * Per `PLAYWRIGHT_MIGRATION_RULES.md`, `wait_until_page_ready` / `here_then_gone` /
 * `scroll_to` calls from the Python source are dropped throughout - Playwright's
 * locator auto-waiting and auto-retrying `expect()` already cover the same
 * synchronization points, and `.click()` auto-scrolls.
 */
export class SearchPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/search/`;
  }


  async goto(): Promise<this> {
    await super.goto();
    await waitUntilPageReady(this.page);
    return this;
  }

  async waitForResultsLoad(): Promise<void> {
    await hereThenGone(this.loadingIndicator);
  }


  get identity(): Locator {
    return this.page.locator('osf-search-page');
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }

  get searchInput(): Locator {
    return this.page.locator('input.p-inputtext.p-component.search-input');
  }

  get searchButton(): Locator {
    return this.page.locator('button[data-test-search-submit]');
  }


  private get resultsContainer(): Locator {
    return this.page.locator('osf-search-results-container');
  }

  get projectsTabLink(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Projects', exact: true });
  }

  get registrationsTabLink(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Registrations', exact: true });
  }

  get preprintsTabLink(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Preprints', exact: true });
  }

  get filesTabLink(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Files', exact: true });
  }

  get usersTabLink(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Users', exact: true });
  }

  /** Used directly by the two Users-tab tests that don't go through `checkFilteringByInstitution`. */
  get institutionAffiliationMenu(): Locator {
    return this.page.locator('p-accordion-header[aria-controls*="affiliation"]');
  }

  get creatorDropdownMenu(): Locator {
    return this.page.locator("p-accordion-header[aria-controls*='creator']");
  }

  get dateCreatedMenu(): Locator {
    return this.page.locator("p-accordion-header[aria-controls*='dateCreated']");
  }

  get funderMenu(): Locator {
    return this.page.locator("p-accordion-header[aria-controls*='funder']");
  }

  get additionalMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get dateCreatedMultiselectDropdown(): Locator {
    return this.page.locator('#trove\\:at-date');
  }

  private get activeAccordionMultiselectDropdown(): Locator {
    return this.page.locator('p-accordion-content[data-p-active="true"] p-multiselect#any-of');
  }

  get funderMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get subjectMenu(): Locator {
    return this.page.getByRole('button', { name: 'Subject', exact: true });
  }

  get subjectMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get licenseMenu(): Locator {
    return this.page.getByRole('button', { name: 'License', exact: true });
  }

  get licenseMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get partOfCollectionMenu(): Locator {
    return this.page.getByRole('button', { name: 'Is part of collection', exact: true });
  }

  get partOfCollectionMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get registrationTemplateMenu(): Locator {
    return this.page.getByRole('button', { name: 'Registration template', exact: true });
  }

  get registrationTemplateMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get includesCommunitySchemaMenu(): Locator {
    return this.page.getByRole('button', { name: 'Includes community schema', exact: true });
  }

  get includesCommunitySchemaMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get providerMenu(): Locator {
    return this.page.getByRole('button', { name: 'Provider', exact: true });
  }

  get providerMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  /** By-text variant used inside `checkFilteringByInstitution`. */
  get institutionMenu(): Locator {
    return this.page.getByRole('button', { name: 'Institution', exact: true });
  }

  get institutionMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get resourceTypeMenu(): Locator {
    return this.page.getByRole('button', { name: 'Resource type', exact: true });
  }

  get resourceTypeMultiselectDropdown(): Locator {
    return this.activeAccordionMultiselectDropdown;
  }

  get additionalFiltersMenu(): Locator {
    return this.page.getByRole('button', { name: 'Additional Filters', exact: true });
  }

  get multiselectFilterInput(): Locator {
    return this.page.locator('input[role="searchbox"].p-multiselect-filter');
  }


  get firstCardObjectTypeLabel(): Locator {
    return this.page.locator('p.type.py-1.px-3.font-bold').first();
  }

  get sortByButton(): Locator {
    return this.page.locator('p-select.no-border-dropdown.font-bold');
  }

  get sortByDateCreatedNewest(): Locator {
    return this.page.getByRole('option', { name: 'Date created (newest)' });
  }

  get sortByDateCreatedOldest(): Locator {
    return this.page.getByRole('option', { name: 'Date created (oldest)' });
  }

  get sortByDateModifiedNewest(): Locator {
    return this.page.getByRole('option', { name: 'Date modified (newest)' });
  }

  get sortByDateModifiedOldest(): Locator {
    return this.page.getByRole('option', { name: 'Date modified (oldest)' });
  }

  get chevronMenuFirstCard(): Locator {
    return this.page.locator(
      'osf-resource-card:first-of-type p-accordion-header [data-pc-section="toggleicon"]'
    );
  }

  get firstSearchResultTitle(): Locator {
    return this.searchResults.first().locator('h2 a');
  }


  get nodeType(): Locator {
    return this.firstCardObjectTypeLabel;
  }

  get searchResults(): Locator {
    return this.page.locator('osf-resource-card .resource.p-4');
  }

  /** Public - also used directly by a handful of one-off tests in `search.spec.ts` that don't go through a `check*` helper. */
  optionByIndex(index: string): Locator {
    return this.page.locator('ul[role="listbox"] li[role="option"]').nth(Number(index) - 1);
  }

  optionCheckboxByIndex(index: string): Locator {
    return this.page
      .locator('ul[role="listbox"] li[role="option"] input[type="checkbox"]')
      .nth(Number(index) - 1);
  }

  /** Exact-name match ("Book (18)" but not "BookChapter (1)"), unlike picking by list position. */
  optionByName(name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page
      .locator('ul[role="listbox"] li[role="option"]')
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*\\(\\d+\\)\\s*$`) });
  }


  async expectEveryResultCardToContain(text: string): Promise<void> {
    const cards = this.page.locator('osf-resource-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards.filter({ hasNotText: text })).toHaveCount(0);
  }

  // ---------------------------------------------------------------------------
  // Port of `SearchPageHelpers`
  // ---------------------------------------------------------------------------


  private async pollForRecordCount(locator: Locator): Promise<number | null> {
    let count: number | null = null;
    await expect
      .poll(
        async () => {
          const text = await locator.innerText();
          const match = text.match(/\((\d+)\)/);
          count = match ? parseInt(match[1], 10) : null;
          return count;
        },
        { timeout: settings.LONG_TIMEOUT_MS }
      )
      .not.toBeNull();
    return count;
  }

  async getRecordCount(index: string): Promise<number | null> {
    return this.pollForRecordCount(this.optionByIndex(index));
  }

  async getRecordCountForAdditionalFilters(optionName: string): Promise<number | null> {
    return this.pollForRecordCount(this.page.locator('label', { hasText: optionName }));
  }

  async getResultsCount(): Promise<number | null> {
    const text = await this.page.locator('h4.result-count').innerText();
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }

  async getRecordName(index: string): Promise<string> {
    const text = await this.optionByIndex(index).innerText();
    return text.replace(/\s*\(\d+\)/, '').trim();
  }

  async checkFilteringByCreator(recordIndex = '2'): Promise<void> {
    if (!(await present(this.creatorDropdownMenu))) {
      test.skip(true, 'Creator menu was not found on the page');
    }
    await this.creatorDropdownMenu.click();
    if (!(await present(this.additionalMultiselectDropdown))) {
      test.skip(true, 'Select Creator drop-down menu was not found on the page');
    }
    await this.additionalMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName(recordIndex);
    const numberOfUsers = await this.getRecordCount(recordIndex);
    await this.optionCheckboxByIndex(recordIndex).click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfUsers as number);
    await this.expectEveryResultCardToContain(nameOfRecord);
  }

  async checkFilteringByDateCreated(dateCreatedRegistered: string): Promise<void> {
    await this.dateCreatedMenu.click();
    await this.dateCreatedMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName('1');
    const numberOfRecords = await this.getRecordCount('1');
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    const recordLocator = this.page.locator('p', { hasText: dateCreatedRegistered }).first();
    await expect(recordLocator).toContainText(nameOfRecord);
  }

  async checkFilteringBySubject(recordIndex = '3'): Promise<void> {
    await this.subjectMenu.click();
    await this.subjectMultiselectDropdown.click();
    // Subject list can take noticeably longer to populate than other filters -
    // 35s honors the same longer wait the Python source used here specifically.
    if (!(await present(this.optionByIndex('1'), 35000))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName(recordIndex);
    const numberOfRecords = await this.getRecordCount(recordIndex);
    await this.optionCheckboxByIndex(recordIndex).click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    const popup = await clickExpectingPopup(this.page, this.firstSearchResultTitle);
 
    const subjectLocator = popup
      .locator(':is(div, section):has(> h3:text-is("Subjects"))')
      .locator('span', { hasText: nameOfRecord })
      .first();

    await expect(subjectLocator).toBeVisible({ timeout: 35000 });
  }

  async checkFilteringByLicense(): Promise<void> {
    await this.licenseMenu.click();
    await this.licenseMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName('1');
    const numberOfRecords = await this.getRecordCount('1');
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await this.chevronMenuFirstCard.click();
    const recordLocator = this.page.locator('p', { hasText: 'License:' }).locator('a').first();
    await expect(recordLocator).toContainText(nameOfRecord);
  }

  async checkFilteringByInstitution(recordIndex = '2'): Promise<void> {
    await expect(this.searchResults.first()).toBeVisible();
    await this.institutionMenu.click();
    if (!(await present(this.institutionMultiselectDropdown))) {
      test.skip(true, 'Select institution drop-down menu was not found on the page');
    }
    await this.institutionMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const numberOfRecords = await this.getRecordCount(recordIndex);
    await this.optionCheckboxByIndex(recordIndex).click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
  }

  async checkFilteringByProvider(indexOfRecordInList = '1'): Promise<void> {
    await this.providerMenu.click();
    await this.providerMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName(indexOfRecordInList);
    const numberOfRecords = await this.getRecordCount(indexOfRecordInList);
    await this.optionCheckboxByIndex(indexOfRecordInList).click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await this.chevronMenuFirstCard.click();
    const recordLocator = this.page.locator('p', { hasText: 'Provider:' }).locator('a').first();
    await expect(recordLocator).toContainText(nameOfRecord);
  }

  async checkFilteringBySupplementalMaterials(): Promise<void> {
    await this.additionalFiltersMenu.click();
    const supplementalMaterialsOption = this.page.locator('input#checkbox-isSupplementedBy');
    const numberOfRecords = await this.getRecordCountForAdditionalFilters(
      'Supplemental materials'
    );
    await supplementalMaterialsOption.click();
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    const popup = await clickExpectingPopup(this.page, this.firstSearchResultTitle);
    const supplementalMaterialsLocator = popup
      .locator('section', {
        has: popup.locator('h3').getByText('Supplemental Materials', { exact: true }),
      })
      .first();
    await expect(supplementalMaterialsLocator).toBeVisible();
  }

  async checkFilteringByData(publicDataSelector: string): Promise<void> {
    await this.additionalFiltersMenu.click();
    const dataOption = this.page.locator('input#checkbox-hasDataResource');
    const numberOfRecords = await this.getRecordCountForAdditionalFilters('Data');
    await dataOption.click();
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    const popup = await clickExpectingPopup(this.page, this.firstSearchResultTitle);
    const publicDataLocator = popup.locator(publicDataSelector).first();
    await expect(publicDataLocator).toBeVisible();
  }

  async checkFilteringByFunder(): Promise<void> {
    await this.funderMenu.click();
    await this.funderMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName('1');
    const numberOfRecords = await this.getRecordCount('1');
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await this.chevronMenuFirstCard.click();
    const recordLocator = this.page
      .locator('p', { hasText: 'Funder:' })
      .locator('a', { hasText: nameOfRecord })
      .first();
    await expect(recordLocator).toContainText(nameOfRecord);
  }

  async checkFilteringByPartOfCollection(): Promise<void> {
    await this.partOfCollectionMenu.click();
    await this.partOfCollectionMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName('1');
    const numberOfRecords = await this.getRecordCount('1');
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await this.chevronMenuFirstCard.click();
    const recordLocator = this.page.locator('p', { hasText: 'Collection:' }).locator('a').first();
    await expect(recordLocator).toContainText(nameOfRecord);
  }

  /**
   * Selects `resourceType` by exact option name. The original port picked whichever
   * option came first (callers passed `''`) and then only looked for any `<p>`
   * containing e.g. "Registration" - which every card's type badge on that tab already
   * matches, filtered or not.
   *
   * Registration cards don't render a "Resource type:" line at all (verified live), so
   * pass `verifyOnCard: false` there - the applied-filter chip plus the result count
   * dropping to the option's count is then the proof the filter took effect.
   */
  async checkFilteringByResourceType(
    resourceType: string,
    { verifyOnCard = true }: { verifyOnCard?: boolean } = {}
  ): Promise<void> {
    await this.resourceTypeMenu.click();
    await this.resourceTypeMultiselectDropdown.click();
    await this.multiselectFilterInput.fill(resourceType);
    const option = this.optionByName(resourceType);
    if (!(await present(option))) {
      test.skip(true, `Resource type "${resourceType}" was not found in the list`);
    }
    const numberOfRecords = await this.pollForRecordCount(option);
    await option.locator('input[type="checkbox"]').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await expect(
      this.page.locator('.p-chip-label', { hasText: `Resource type: ${resourceType}` })
    ).toBeVisible();
    if (verifyOnCard) {
      await this.chevronMenuFirstCard.click();
      const resourceTypeInCard = this.page
        .locator('osf-resource-card')
        .first()
        .locator('p', { hasText: 'Resource type:' })
        .filter({ visible: true });
      await expect(resourceTypeInCard).toContainText(resourceType);
    }
  }

  async checkFilteringByAdditionalOptions(
    selectedOptionCheckbox: string,
    additionalOptionName: string,
    iconSelector: string
  ): Promise<void> {
    await this.additionalFiltersMenu.click();
    const additionalOption = this.page.locator(`input#checkbox-${selectedOptionCheckbox}`);
    if (!(await present(additionalOption))) {
      test.skip(true, 'Record was not found in the list');
    }
    const numberOfRecords = await this.getRecordCountForAdditionalFilters(additionalOptionName);
    await additionalOption.click();
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    const popup = await clickExpectingPopup(this.page, this.firstSearchResultTitle);
    const selectedOptionIcon = popup.locator(iconSelector);
    await expect(selectedOptionIcon).toBeVisible();
  }

  async checkFilteringByIncludesCommunitySchema(): Promise<void> {
    await this.includesCommunitySchemaMenu.click();
    await this.includesCommunitySchemaMultiselectDropdown.click();
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const nameOfRecord = await this.getRecordName('1');
    const numberOfRecords = await this.getRecordCount('1');
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    // This shows up as the applied-filter chip, not as a field on the result card
    // itself (unlike Provider/License/etc., which do render on the card).
    const recordLocator = this.page.locator('.p-chip-label', {
      hasText: 'Includes community schema:',
    });
    await expect(recordLocator).toContainText(nameOfRecord);
  }

  async checkClearingOfAppliedFilters(): Promise<void> {

    await this.waitForResultsLoad();
    const resultCountWithoutFilter = await this.getResultsCount();
    await this.dateCreatedMenu.click();
    await this.dateCreatedMultiselectDropdown.click();
    // Compare against the option's own count, not the unfiltered total - "<= total"
    // also holds when the filter silently isn't applied at all.
    const numberOfRecords = await this.getRecordCount('1');
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await this.page.locator('span.p-chip-remove-icon').click();
    await this.waitForResultsLoad();

    await expect
      .poll(() => this.getResultsCount(), { timeout: settings.LONG_TIMEOUT_MS })
      .toBe(resultCountWithoutFilter);
  }

  async openTab(tabLink: Locator): Promise<void> {
    const request = this.page.waitForRequest((req) => req.url().includes('index-card-search'));
    await tabLink.click();
    await (await request).response();
    await expect(this.searchResults.first()).toBeVisible();
  }


  async applySort(option: Locator, sortParam: string): Promise<void> {
    const response = this.page.waitForResponse(
      (res) =>
        res.url().includes('index-card-search') &&
        new URL(res.url()).searchParams.get('sort') === sortParam
    );
    await this.sortByButton.click();
    await option.click();
    await response;
    await expect(this.searchResults.first()).toBeVisible();
  }


  private async skipIfTooFewResultsToSort(): Promise<void> {
    await expect(this.searchResults.first()).toBeVisible();
    const resultCount = await this.getResultsCount();
    if ((resultCount ?? 0) < 2) {
      test.skip(true, `Only ${resultCount} result(s) - not enough to verify sorting`);
    }
  }


  async checkSortingByCreatedDate(createdRegistered: string | string[]): Promise<void> {
    const labels = (Array.isArray(createdRegistered) ? createdRegistered : [createdRegistered]).map(
      (label) => `Date ${label}`
    );
    await this.skipIfTooFewResultsToSort();

    await this.applySort(this.sortByDateCreatedNewest, '-dateCreated');
    this.assertSorting(await this.getDates(labels), 'descending');

    await this.applySort(this.sortByDateCreatedOldest, 'dateCreated');
    this.assertSorting(await this.getDates(labels), 'ascending');
  }

  async checkSortingByModifiedDate(): Promise<void> {
    await this.skipIfTooFewResultsToSort();

    await this.applySort(this.sortByDateModifiedNewest, '-dateModified');
    this.assertSorting(await this.getDates('Date modified'), 'descending');

    await this.applySort(this.sortByDateModifiedOldest, 'dateModified');
    this.assertSorting(await this.getDates('Date modified'), 'ascending');
  }

  async checkSearchInFilteringOptions(recordIndex = '1'): Promise<void> {
    if (!(await present(this.optionByIndex(recordIndex)))) {
      test.skip(true, 'Record was not found in the list');
    }
    const firstOptionName = await this.getRecordName(recordIndex);
    await this.multiselectFilterInput.fill(firstOptionName);
    const options = this.page.locator('ul[role="listbox"] li[role="option"]');
    await expect(options.first()).toBeVisible();
    const texts = await options.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    const expectedValue = firstOptionName.toLowerCase();
    for (const value of texts) {
      expect(value.toLowerCase()).toContain(expectedValue);
    }
  }
}

/** Port of `pages/search.py`'s `RegistrationSearchResults`. */
export class RegistrationSearchResults extends SearchPage {
  get url(): string {
    return `${settings.OSF_HOME}/search?tab=3`;
  }

  get registrationTitle(): Locator {
    return this.page
      .locator('[class="block line-height-4 dark-blue-link word-break-word"]')
      .first();
  }

  get registrationDates(): Locator {
    return this.page.locator('osf-resource-card:first-of-type div.line-height-3.flex-column');
  }

  get secondaryMetadataDropdown(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p-accordion-header');
  }

  get registrationProvider(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-registration-secondary-metadata p')
      .filter({ hasText: /^\s*Provider/ });
  }

  get registrationTemplate(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-registration-secondary-metadata p')
      .filter({ hasText: /^\s*Registration Template/ });
  }

  get registrationLicense(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-registration-secondary-metadata p')
      .filter({ hasText: /^\s*License/ });
  }

  get registrationDescription(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-registration-secondary-metadata p')
      .filter({ hasText: /^\s*Description/ });
  }

  get registrationUrl(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-registration-secondary-metadata p')
      .filter({ hasText: /^\s*URL/ });
  }

  get registrationDoi(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-registration-secondary-metadata p')
      .filter({ hasText: /^\s*DOI/ });
  }

  get registrationCardContributorLinks(): Locator {
    return this.page.locator(
      'osf-resource-card:first-of-type div.line-height-3:not([class*="flex"]) > a.word-break-word'
    );
  }

  get registrationCardContributorsMore(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p[class*="inline"]');
  }
}

/** Port of `pages/search.py`'s `ProjectSearchResults`. */
export class ProjectSearchResults extends SearchPage {
  get url(): string {
    return `${settings.OSF_HOME}/search?tab=2`;
  }

  get projectTitle(): Locator {
    return this.page
      .locator('[class="block line-height-4 dark-blue-link word-break-word"]')
      .first();
  }

  get secondaryMetadataDropdown(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p-accordion-header');
  }

  get projectDates(): Locator {
    return this.page.locator('osf-resource-card:first-of-type div.line-height-3.flex-column');
  }

  get projectDescription(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-project-secondary-metadata p')
      .filter({ hasText: /^\s*Description/ });
  }

  get projectLicense(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-project-secondary-metadata p')
      .filter({ hasText: /^\s*License/ });
  }

  get projectCollection(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-project-secondary-metadata p')
      .filter({ hasText: /^\s*Collection/ });
  }

  get projectDoi(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-project-secondary-metadata p')
      .filter({ hasText: /^\s*DOI/ });
  }

  get firstCardType(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p.type');
  }

  get projectCardContributorLinks(): Locator {
    return this.page.locator(
      'osf-resource-card:first-of-type div.line-height-3:not([class*="flex"]) > a.word-break-word'
    );
  }

  get projectCardContributorsMore(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p[class*="inline"]');
  }
}

/** Port of `pages/search.py`'s `PreprintSearchResults`. */
export class PreprintSearchResults extends SearchPage {
  get url(): string {
    return `${settings.OSF_HOME}/search?tab=5`;
  }

  get preprintTitle(): Locator {
    return this.page
      .locator('[class="block line-height-4 dark-blue-link word-break-word"]')
      .first();
  }

  get dateCreated(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type p')
      .filter({ hasText: /^\s*Date created/ });
  }

  get preprintCardContributorLinks(): Locator {
    return this.page.locator(
      'osf-resource-card:first-of-type div.line-height-3:not([class*="flex"]) > a.word-break-word'
    );
  }

  get preprintCardContributorsMore(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p[class*="inline"]');
  }
}

/** Port of `pages/search.py`'s `UserSearchResults`. */
export class UserSearchResults extends SearchPage {
  get url(): string {
    return `${settings.OSF_HOME}/search?tab=7`;
  }

  get userName(): Locator {
    return this.page
      .locator('[class="block line-height-4 dark-blue-link word-break-word"]')
      .first();
  }

  get orcidBadge(): Locator {
    return this.page.locator('osf-resource-card:first-of-type img[alt="orcid"]');
  }

  get secondaryMetadataDropdown(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p-accordion-header');
  }

  get userPublicProjects(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-user-secondary-metadata p')
      .filter({ hasText: /^\s*Public projects/ });
  }

  get userPublicRegistrations(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-user-secondary-metadata p')
      .filter({ hasText: /^\s*Public registrations/ });
  }

  get userPublicPreprints(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-user-secondary-metadata p')
      .filter({ hasText: /^\s*Public preprints/ });
  }
}

/** Port of `pages/search.py`'s `FileSearchResults`. */
export class FileSearchResults extends SearchPage {
  get url(): string {
    return `${settings.OSF_HOME}/search?tab=1`;
  }

  get fileTitle(): Locator {
    return this.page
      .locator('[class="block line-height-4 dark-blue-link word-break-word"]')
      .first();
  }

  get fromProjectLink(): Locator {
    return this.page.locator('osf-resource-card:first-of-type p:text-is("From:") ~ a');
  }

  get funderLink(): Locator {
    return this.page
      .locator('osf-resource-card:first-of-type osf-file-secondary-metadata p', {
        hasText: 'Funder:',
      })
      .locator('a');
  }
}
