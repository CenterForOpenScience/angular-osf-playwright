import { Page, Locator, expect } from '@playwright/test';
import { GuidBasePage } from './GuidBasePage';
import * as settings from '../../config/settings';
import { present, clickExpectingPopup, waitUntilPageReady, hereThenGone } from '../utils';

export class FilesPage extends GuidBasePage {
  static baseUrl = '{guid}/files/{provider}';
  addonProvider: string;
  // Locators

  readonly addFileFolderButton: Locator;
  readonly fileSelectedText: Locator;
  readonly fileListMoveButton: Locator;
  readonly fileListCopyButton: Locator;
  readonly fileListDeleteButton: Locator;
  readonly leftnavOsfstorageLink: Locator;
  readonly selectAddon: Locator;
  readonly addonsList: Locator;
  readonly fileInput: Locator;
  readonly searchInput: Locator;
  readonly searchResults: Locator;


  constructor(
    page: Page,
    verify: boolean = false,
    guid: string = '',
    domain: string = settings.OSF_HOME,
    addonProvider: string = 'osfstorage',
  ) {
    super(page, verify, guid, domain);
    this.addonProvider = addonProvider;

    // Prefer resilient, role-based or test-id selectors over fragile long utility classes
    this.addFileFolderButton = page.locator('button.p-button-success');
    this.fileSelectedText = page.locator('span.mr-2');
    this.fileListMoveButton = page.locator('button.p-button-outlined:not(.p-button-success):not(.p-button-danger)');
    this.fileListCopyButton = page.locator('button.p-button-success');
    this.fileListDeleteButton = page.locator('button.p-button-danger');

    this.leftnavOsfstorageLink = page.locator('[data-test-files-provider-link="osfstorage"]');
    this.selectAddon = page.getByRole('button', { name: 'dropdown trigger' });
    this.addonsList = page.locator('li.p-select-option');
    this.fileInput = page.locator('input[type="file"]');
    this.searchInput = page.getByPlaceholder('Search your files');
    this.searchResults = page.locator('div.table-cell.flex.align-items-center');
  }

  get url(): string {
    return `${this.domain}/${FilesPage.baseUrl
      .replace('{guid}', this.guid)
      .replace('{provider}', this.addonProvider)}`;
  }

  get identity(): Locator {
    return this.page.locator('[data-test-file-search]');
  }

  async reload() {
    await this.page.reload();
  }

  get downloadButton(): Locator {
    return this.page.locator('button[aria-label="Download"]');
  }

  async selectFromAddonList(selection: string): Promise<void> {
    // Replaces explicit loops with direct text-based locators
    await this.selectAddon.nth(0).click();
    const targetAddon = this.addonsList.filter({
      hasText: new RegExp(`^\\s*${selection}\\s*$`, 'i'),
    });
    await targetAddon.click();
  }

  async selectSortFromList(sortName: string): Promise<void> {
    // Select the second dropdown directly
    await this.selectAddon.nth(1).click();

    const sortOption = this.page
      .locator('div.p-select-list-container li')
      .filter({ hasText: new RegExp(`^\\s*${sortName}\\s*$`) });

    await sortOption.click();
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName }).click();
  }

  async clickOnFolderLink(folderName: string, parentRow?: Locator): Promise<void> {
    const scope = parentRow || this.page;
    await scope.locator('span', { hasText: folderName }).click();
  }

  async selectFromSearchResults(fileName: string): Promise<Locator | null> {
    // Wait for the filtered files API response to complete before trusting the DOM
    await this.page.waitForResponse(
      (response) => response.url().includes(`filter%5Bname%5D=${encodeURIComponent(fileName)}`) && response.status() === 200,
      { timeout: 10000 }
    ).catch(() => undefined); // don't hard-fail if the URL pattern doesn't match exactly — fall through to DOM wait below

    const matchingResult = this.page.locator('div.files-table-row').filter({
      has: this.page.locator(`text="${fileName}"`), // exact text match, not substring
    }).first();

    try {
      await matchingResult.waitFor({ state: 'visible', timeout: 10000 });
      return matchingResult;
    } catch {
      return null;
    }
  }

  async retrieveSearchResults(targetString: string): Promise<Locator[]> {
    const matchingResults = this.searchResults.filter({ hasText: targetString });
    return matchingResults.all();
  }

}
