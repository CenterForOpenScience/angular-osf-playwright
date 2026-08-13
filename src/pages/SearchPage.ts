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

  /**
   * The search page's initial load fires its own (empty-query) results request. If a
   * test starts typing/clicking before that settles, its own request's loading-spinner
   * cycle can overlap with - and finish before - the one triggered by the page's own
   * load, so a naive `press('Enter')` -> `expect(...).toBeVisible()` can observe stale
   * results mid-flicker. Settling here first (mirrors the Python `goto_short()`'s
   * `time.sleep(1)`) means `waitForResultsLoad` afterward is observing only the
   * request the test itself triggered.
   */
  async goto(): Promise<this> {
    await super.goto();
    await waitUntilPageReady(this.page);
    return this;
  }

  /**
   * Waits out the loading-spinner cycle triggered by a search submission or tab
   * switch. See `goto()` above for why a plain "wait for results visible" isn't
   * enough on this page.
   */
  async waitForResultsLoad(): Promise<void> {
    await hereThenGone(this.loadingIndicator);
  }

  get identity(): Locator {
    return this.page.locator('div[data-analytics-scope="Search page main"]');
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

  /**
   * The page also has a hidden `div[role="button"]` panel-menu header sharing the
   * same accessible name (a mobile/collapsed-nav duplicate) - plain `getByRole`
   * matches both, so these are scoped to the results container to get only the
   * real, visible `<button>` tab.
   */
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

  /**
   * Every filter's multiselect dropdown (funder, license, subject, etc.) renders
   * with the same generic `id="any-of"` - scoping to whichever accordion panel is
   * currently expanded (`data-p-active="true"`) is what actually disambiguates them,
   * not the id itself. All the `*MultiselectDropdown` getters below therefore
   * resolve to this same locator - kept as separate named getters (rather than one
   * shared one) purely to mirror which filter each call site is opening.
   */
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

  /**
   * `p.type.py-1.px-3.font-bold` matches every result card's type label, not just the
   * first - the Python `Locator` equivalent silently returned the first DOM match
   * (Selenium's `find_element` semantics), so `.first()` here is required to keep the
   * same behavior under Playwright's strict-mode locators.
   */
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
    return this.page.locator('div[osfstoppropagation]');
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

  // ---------------------------------------------------------------------------
  // Port of `SearchPageHelpers`
  // ---------------------------------------------------------------------------

  /**
   * Both option-list rows and additional-filter labels start out visible with just
   * their name - the "(N)" count is filled in a moment later by a separate
   * facet-counts request (same async-populate lag as the Subjects dropdown in
   * checkFilteringBySubject) and can even flicker back to the bare name on a
   * subsequent refresh. Capture the count inside the same poll iteration that
   * finds it, rather than asserting it's present and re-reading afterward, so a
   * flicker between those two reads can't hand back a stale null.
   */
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
    const recordLocator = this.page.locator('p-accordion-panel a', { hasText: nameOfRecord }).first();
    await expect(recordLocator).toBeVisible();
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
      .locator('span', { hasText: nameOfRecord });
    // Same subject-taxonomy slowness as the filter dropdown above - the popup's
    // Subjects section shows a skeleton loader before the real tags populate.
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

  async checkFilteringByResourceType(
    resourceTypeOption: string,
    displayedResourceTypeOption: string
  ): Promise<void> {
    await this.resourceTypeMenu.click();
    await this.resourceTypeMultiselectDropdown.click();
    await this.multiselectFilterInput.fill(resourceTypeOption);
    if (!(await present(this.optionByIndex('1')))) {
      test.skip(true, 'Record was not found in the list');
    }
    const numberOfRecords = await this.getRecordCount('1');
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await this.chevronMenuFirstCard.click();
    const resourceTypeInCardLocator = this.page
      .locator('p', { hasText: displayedResourceTypeOption })
      .first();
    await expect(resourceTypeInCardLocator).toBeVisible();
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
    // Callers click a tab link immediately before this - wait for that switch's
    // own results refresh to settle before taking the "no filter" baseline reading,
    // otherwise this can read the stale count from the previous tab/state.
    await this.waitForResultsLoad();
    const resultCountWithoutFilter = await this.getResultsCount();
    await this.dateCreatedMenu.click();
    await this.dateCreatedMultiselectDropdown.click();
    await this.optionCheckboxByIndex('1').click({ force: true });
    await this.waitForResultsLoad();
    const resultCountAfterFilterApplying = await this.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(resultCountWithoutFilter as number);
    await this.page.locator('span.p-chip-remove-icon').click();
    await this.waitForResultsLoad();
    // waitForResultsLoad's spinner-based wait can race ahead of the Angular
    // re-render when the request settles faster than the spinner's own
    // appear/disappear cycle can be observed (same class of flicker as the
    // goto()/Subjects-dropdown cases documented above) - a single read here can
    // land on the stale, still-filtered count. Poll the actual count instead of
    // trusting one post-wait read.
    await expect
      .poll(() => this.getResultsCount(), { timeout: settings.LONG_TIMEOUT_MS })
      .toBe(resultCountWithoutFilter);
  }

  async checkSortingByCreatedDate(createdRegistered: string): Promise<void> {
    await this.sortByButton.click();
    await this.sortByDateCreatedNewest.click();
    let dates = await this.getDates(`Date "${createdRegistered}"`);
    this.assertSorting(dates, 'descending');

    await this.sortByButton.click();
    await this.sortByDateCreatedOldest.click();
    dates = await this.getDates(`Date "${createdRegistered}"`);
    this.assertSorting(dates, 'ascending');
  }

  async checkSortingByModifiedDate(): Promise<void> {
    await this.sortByButton.click();
    await this.sortByDateModifiedNewest.click();
    let dates = await this.getDates('Date modified');
    this.assertSorting(dates, 'descending');

    await this.sortByButton.click();
    await this.sortByDateModifiedOldest.click();
    dates = await this.getDates('Date modified');
    this.assertSorting(dates, 'ascending');
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
