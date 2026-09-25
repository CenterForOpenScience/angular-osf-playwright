import { Page, Locator, expect } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';
import { RegistrationSideNavbar } from './components/RegistrationSideNavbar';
import {
  AddContributorModal,
  CreateVolModal,
  DeleteVolModal,
  EditAffiliationsModal,
  EditContributorsModal,
  EditLicenseModal,
} from './components/RegistrationModals';

/**
 * Port of `pages/registries.py` / `components/registration.py` - the pages
 * `tests/test_registration_sidebar.py` exercises. `RegistrationPage` below is the
 * Registration Overview page; the rest of the file is its side-nav siblings
 * (Metadata/Files/Resources/Wiki/Components/Links/Analytics/Contributors).
 *
 * Overview, Metadata, Resources, Wiki and Contributors carry real behavior here
 * (Metadata for `tests/test_registration_metadata.py`) - Files/Components/Links/
 * Analytics are only ever navigated to and checked for `identity` by the side-nav
 * smoke tests in `tests/test_registration_sidebar.py`, so those page objects stay
 * identity-only.
 */

/** Port of `BaseSubmittedRegistrationPage.url`. */
export function registrationUrl(guid: string, section = ''): string {
  return section ? `${settings.OSF_HOME}/${guid}/${section}` : `${settings.OSF_HOME}/${guid}/`;
}

export class RegistrationPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('[data-test-page-heading]');
  }

  get sideNavbar(): RegistrationSideNavbar {
    return new RegistrationSideNavbar(this.page);
  }

  get title(): Locator {
    return this.page.locator('h1[data-test-page-heading]');
  }

  get registeredDate(): Locator {
    return this.page.locator('[data-test-registry-overview-metadata-date-registered]');
  }

  get overviewRegistrationType(): Locator {
    return this.page.locator('[data-test-registry-overview-metadata-registration-type]');
  }

  get overviewRegistry(): Locator {
    return this.page.locator('[data-test-registry-overview-metadata-registry-provider]');
  }

  get overviewLicense(): Locator {
    return this.page.locator('[data-test-registry-overview-metadata-license]');
  }

  get registrationDoi(): Locator {
    return this.page.locator('[data-test-registry-overview-metadata-doi] a');
  }

  get allContributors(): Locator {
    return this.page.locator('[data-test-contributor-name]');
  }

  get overviewDescription(): Locator {
    return this.page.locator('[data-test-registry-overview-metadata-description]');
  }

  get overviewDateCreated(): Locator {
    return this.page.locator('[data-test-registry-overview-metadata-date-created]');
  }

  /** Verified live: this section renders twice on the overview page - `.first()` matches Python's `find_element` (first match). */
  get associatedProject(): Locator {
    return this.page
      .locator('[data-test-registry-overview-metadata-associated-project-link]')
      .first();
  }

  get alertInfoMessage(): Locator {
    return this.page.locator('div.flex.w-full.align-items-center.justify-content-between > p');
  }

  get volContributorsText(): Locator {
    return this.page.locator('osf-contributors-list div p');
  }

  get openPracticeResourceData(): Locator {
    return this.page.locator('#registration-resources');
  }

  get addResourceButton(): Locator {
    return this.page.getByRole('button', { name: 'Add Resource', exact: true });
  }

  get doiInputField(): Locator {
    return this.page.getByPlaceholder('https://doi.org/');
  }

  get resourceTypeDropdown(): Locator {
    return this.page.getByText('Select A Resource Type', { exact: true });
  }

  async selectResourceType(resourceType: string): Promise<void> {
    await this.resourceTypeDropdown.click();
    await this.page
      .locator('li.p-select-option')
      .filter({ hasText: new RegExp(`^\\s*${resourceType}\\s*$`) })
      .click();
  }

  get previewButton(): Locator {
    return this.page.getByRole('button', { name: 'Preview', exact: true });
  }

  get resourceTypeAddButton(): Locator {
    return this.page.locator('p-button.btn-full-width > button.p-button-primary');
  }

  get resourceBlock(): Locator {
    return this.page.locator('.resource-block');
  }

  get resourceCardDescription(): Locator {
    return this.page.locator('.resource-block p.mt-1');
  }

  get resourceTypeEditButton(): Locator {
    return this.page.getByRole('button', { name: 'Edit', exact: true });
  }

  get resourceTypeDeleteButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete', exact: true });
  }

  get resourceTypeDeleteConfirm(): Locator {
    return this.page.getByRole('button', { name: 'Remove', exact: true });
  }

  get resourceDescription(): Locator {
    return this.page.locator('#coi-reason');
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  async getSubjectsList(): Promise<string[]> {
    return this.page.locator('osf-subjects-list span.p-tag-label').allTextContents();
  }

  async getTagsList(): Promise<string[]> {
    return this.page.locator('osf-tags-list span.p-tag-label').allTextContents();
  }

  /**
   * Port of `get_authors_list`/`get_affiliations_list`. The Python originals `return`
   * from inside their `for` loop, so they only ever yield the first contributor /
   * institution - dead-code bug (same pattern the README's Section 3 note already
   * documents fixing elsewhere in this migration). Fixed here to return the full list.
   */
  async getAuthorsList(): Promise<Array<{ name: string; link: string | null }>> {
    const authors = this.page.locator('[data-test-contributor-name]');
    // Same async-render race as RegistrationContributorsPage.getContributorsList -
    // verified live that reading immediately after `verify()` can see zero authors.
    await authors.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
    const count = await authors.count();
    const result: Array<{ name: string; link: string | null }> = [];
    for (let i = 0; i < count; i++) {
      const author = authors.nth(i);
      result.push({
        name: (await author.innerText()).trim(),
        link: await author.getAttribute('href'),
      });
    }
    return result;
  }

  async getAffiliationsList(): Promise<string[]> {
    const links = this.page.locator(
      'h3:text-is("Affiliated Institutions") ~ osf-affiliated-institutions-view a'
    );
    const hrefs = await links.evaluateAll((elements) =>
      elements.map((el) => (el as HTMLAnchorElement).href)
    );
    return hrefs.map((href) => href.replace(/\/+$/, '').split('/').pop() as string);
  }
}

/**
 * Port of `pages/registries.py`'s `RegistrationMetadataPage` (plus its
 * `components/registration.py` modals) for `tests/test_registration_metadata.py`.
 * Every metadata card is its own Angular component (`osf-metadata-title`,
 * `osf-metadata-contributors`, ...) - those are used as section roots instead of
 * the Python `//div[h2[text()="..."]]` XPaths, which also dodges the Resource
 * Information heading's embedded info-button text. Each "Edit" opens a named
 * `p-dialog` (`Edit Title`, `Edit Resource Information`, ...).
 */
const METADATA_SECTIONS: Record<string, string> = {
  Title: 'osf-metadata-title',
  Description: 'osf-metadata-description',
  Contributors: 'osf-metadata-contributors',
  'Resource Information': 'osf-metadata-resource-information',
  'Funding/Support Information': 'osf-metadata-funding',
  'Affiliated Institutions': 'osf-metadata-affiliated-institutions',
  License: 'osf-metadata-license',
  Tags: 'osf-metadata-tags',
  Subjects: 'osf-metadata-subjects',
};

export class RegistrationMetadataPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-metadata');
  }

  section(title: string): Locator {
    const tag = METADATA_SECTIONS[title];
    if (!tag) throw new Error(`Unknown metadata section: ${title}`);
    return this.page.locator(tag);
  }

  /** Port of `click_on_edit` / `click_on_metadata_section_edit_button`. */
  async clickOnEdit(title: string): Promise<void> {
    await this.section(title).getByRole('button', { name: 'Edit', exact: true }).click();
  }

  dialog(name: string): Locator {
    return this.page.getByRole('dialog', { name, exact: true });
  }

  /** Clicks a button inside whichever dialog(s) are open, falling back to the page. */
  async clickOnButton(buttonName: string): Promise<void> {
    await this.page
      .locator('[role="dialog"][aria-modal="true"]')
      .getByRole('button', { name: buttonName, exact: true })
      .click();
  }

  // Title / description
  get metadataTitle(): Locator {
    return this.page.locator('[data-test-display-node-title]');
  }

  get metadataDescription(): Locator {
    return this.page.locator('[data-test-display-node-description]');
  }

  get titleInput(): Locator {
    return this.dialog('Edit Title').getByPlaceholder('Edit title here');
  }

  get saveMetadataTitleButton(): Locator {
    return this.dialog('Edit Title').getByRole('button', { name: 'Save', exact: true });
  }

  get descriptionInput(): Locator {
    return this.dialog('Edit Description').getByPlaceholder('Edit description here');
  }

  get saveMetadataDescriptionButton(): Locator {
    return this.dialog('Edit Description').getByRole('button', { name: 'Save', exact: true });
  }

  // Contributors
  /** Contributor links on the Contributors card - only bibliographic contributors are listed there. */
  async getContributorsList(): Promise<string[]> {
    const names = this.section('Contributors').locator('[data-test-contributor-name]');
    await names.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
    return (await names.allInnerTexts()).map((name) => name.replace(/,/g, '').trim());
  }

  /** Port of `get_contributor_name` - the contributor's link on the Contributors card. */
  getContributorName(userName: string): Locator {
    return this.section('Contributors').getByRole('link', { name: userName, exact: true });
  }

  /** Port of `get_contributor_name_modal_window` - the contributor's row link in the Edit contributors dialog. */
  getContributorNameModalWindow(userName: string): Locator {
    return this.editContributorsModal.root.getByRole('link', { name: userName, exact: true });
  }

  // Resource information
  get resourceType(): Locator {
    return this.page.locator('[data-test-display-resource-type-general]');
  }

  get resourceLanguage(): Locator {
    return this.page.locator('[data-test-display-resource-language]');
  }

  /**
   * The `<label for>` targets a `p-select` host (not a labelable element), and the
   * select's combobox takes its accessible name from the *current value* - so neither
   * `getByLabel` nor a named `getByRole('combobox')` identifies these; the app's own
   * `data-test-select-*` hooks do.
   */
  get resourceTypeDropdown(): Locator {
    return this.dialog('Edit Resource Information').locator('[data-test-select-resource-type]');
  }

  get resourceLanguageDropdown(): Locator {
    return this.dialog('Edit Resource Information').locator('[data-test-select-resource-language]');
  }

  get resourceInformationSaveButton(): Locator {
    return this.dialog('Edit Resource Information').getByRole('button', { name: 'Save', exact: true });
  }

  /** Port of `select_by_search` - types into the open select's filter box, then picks the option. */
  async selectBySearch(selection: string): Promise<void> {
    await this.page.getByRole('searchbox').fill(selection);
    await this.page.getByRole('option', { name: selection, exact: true }).click();
  }

  /**
   * Picks an option from the open Resource language select. Python's `select_by_search`
   * typed into the select's filter box, but that filter is currently broken in the app
   * - verified live via `_debug_inspect.spec.ts`: the `p-select` is configured with
   * `filterBy="label"` while its options only carry `name`/`code`, so any search text
   * shows "No results found". The list is also virtual-scrolled (only ~8 options exist
   * in the DOM at once), so this scrolls it from the top until the option renders.
   */
  async selectFromVirtualScrollList(option: string): Promise<void> {
    const target = this.page.getByRole('option', { name: option, exact: true });
    const scroller = this.page.locator('.p-select-overlay .p-virtualscroller');
    await scroller.evaluate((el) => (el.scrollTop = 0));
    for (let i = 0; i < 200; i++) {
      const found = await target
        .waitFor({ state: 'visible', timeout: 300 })
        .then(() => true)
        .catch(() => false);
      if (found) break;
      await scroller.evaluate((el) => (el.scrollTop += el.clientHeight / 2));
    }
    await target.click();
  }

  async selectOption(option: string): Promise<void> {
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }

  // Funding
  get fundingDialog(): Locator {
    return this.dialog('Edit Funding/Support Information');
  }

  /** Funder `p-select` for the n-th funder entry (same reasoning as `resourceTypeDropdown`). */
  funderName(index = 0): Locator {
    return this.fundingDialog.locator(`p-select#funderName-${index}`);
  }

  awardTitle(index = 0): Locator {
    return this.fundingDialog.locator(`#awardTitle-${index}`);
  }

  awardInfoUri(index = 0): Locator {
    return this.fundingDialog.locator(`#awardUri-${index}`);
  }

  awardNumber(index = 0): Locator {
    return this.fundingDialog.locator(`#awardNumber-${index}`);
  }

  get addFunderButton(): Locator {
    return this.fundingDialog.getByRole('button', { name: 'Add More', exact: true });
  }

  get removeFunderButtons(): Locator {
    return this.fundingDialog.getByRole('button', { name: 'Remove', exact: true });
  }

  get saveFunderInfoButton(): Locator {
    return this.fundingDialog.getByRole('button', { name: 'Save', exact: true });
  }

  get displayFunderName(): Locator {
    return this.page.locator('[data-test-display-funder-name]');
  }

  get displayAwardTitle(): Locator {
    return this.page.locator('[data-test-display-funder-award-title]');
  }

  get displayAwardNumber(): Locator {
    return this.page.locator('[data-test-display-funder-award-number]');
  }

  get displayAwardInfoUri(): Locator {
    return this.page.locator('[data-test-display-funder-award-uri]');
  }

  // Affiliated institutions
  async getAffiliationsList(): Promise<string[]> {
    const links = this.section('Affiliated Institutions').locator('osf-affiliated-institutions-view a');
    const hrefs = await links.evaluateAll((elements) =>
      elements.map((el) => (el as HTMLAnchorElement).href)
    );
    return hrefs.map((href) => href.replace(/\/+$/, '').split('/').pop() as string);
  }

  // Subjects
  /**
   * Scoped to the Subjects card - Python's `//div[@class="p-chip-label"]` was
   * page-wide, so it also picked up the Tags card's chips.
   */
  async getSubjectList(): Promise<string[]> {
    return (await this.section('Subjects').locator('p-chip').allInnerTexts()).map((s) => s.trim());
  }

  subjectChip(subjectName: string): Locator {
    return this.section('Subjects')
      .locator('p-chip')
      .filter({ hasText: new RegExp(`^\\s*${subjectName}\\s*$`) });
  }

  async selectTopLevelSubject(selection: string): Promise<void> {
    await this.section('Subjects')
      .getByRole('treeitem', { name: selection, exact: true })
      .getByRole('checkbox')
      .first()
      .click();
  }

  async removeSubject(subjectName: string): Promise<void> {
    await this.subjectChip(subjectName).getByRole('button', { name: 'Remove', exact: true }).click();
  }

  // License
  get licenseInfo(): Locator {
    return this.page.locator('[data-test-target-license-name]');
  }

  // Tags
  get tagInput(): Locator {
    return this.section('Tags').getByLabel('Tag input');
  }

  async getTagsList(): Promise<string[]> {
    return (await this.section('Tags').locator('p-chip').allInnerTexts()).map((t) => t.trim());
  }

  tagChip(tagName: string): Locator {
    return this.section('Tags').locator(`p-chip[aria-label="${tagName}"]`);
  }

  /** The tag chip's remove icon is a bare `<svg>` with no role/name - PrimeNG's structural class is the only hook. */
  async clickOnRemoveTag(tagName: string): Promise<void> {
    await this.tagChip(tagName).locator('.p-chip-remove-icon').click();
  }

  // Components
  get addContributorModal(): AddContributorModal {
    return new AddContributorModal(this.page);
  }

  get editContributorsModal(): EditContributorsModal {
    return new EditContributorsModal(this.page);
  }

  get editAffiliationsModal(): EditAffiliationsModal {
    return new EditAffiliationsModal(this.page);
  }

  get editLicenseModal(): EditLicenseModal {
    return new EditLicenseModal(this.page);
  }
}

export class RegistrationFilesListPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-files-container');
  }
}

export class RegistrationResourcesPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-registry-resources');
  }
}

export class RegistrationComponentsPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-registry-components');
  }
}

export class RegistrationLinksPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-registry-links');
  }
}

export class RegistrationAnalyticsPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-analytics');
  }

  get alertInfoMessage(): Locator {
    return this.page.locator('div.flex.w-full.align-items-center.justify-content-between > p');
  }
}

export class RegistrationWikiPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-registry-wiki');
  }

  get alertInfoMessage(): Locator {
    return this.page.locator('div.flex.w-full.align-items-center.justify-content-between > p');
  }

  get wikiPreviewText(): Locator {
    return this.page.locator('osf-markdown div p');
  }

  get wikiEmptyText(): Locator {
    return this.page.locator('p.font-italic');
  }

  get wikiVersion(): Locator {
    return this.page.locator('span.p-select-label').first();
  }

  get comparePreviewText(): Locator {
    return this.page.locator('span.min-w-max.mr-2');
  }

  /** Verified live: `div.mt-3` also matches two structural/editor wrapper divs above this one - the actual compare content renders last. */
  get compareText(): Locator {
    return this.page.locator('div.mt-3').last();
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName, exact: true }).click();
  }

  /** `versionLabel` is a substring, e.g. `(Current)` or `(1)`, matching Python's `select_version_from_dropdown`. */
  async selectVersionFromDropdown(versionLabel: string): Promise<void> {
    await this.page.locator('div.p-select-dropdown').click();
    await this.page.locator('li', { hasText: versionLabel }).first().click();
  }
}

export class RegistrationContributorsPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-contributors');
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder('Search Registration Contributors');
  }

  /**
   * Fills the search box and waits for the table's debounced filter to actually
   * narrow to that one contributor (verified live: filtering can take up to ~2s -
   * reading row/permission/button state right after `.fill()` races it and hits
   * several still-unfiltered rows, e.g. `userPermission`/`removeButton` matching all
   * 4 rows instead of 1).
   */
  async searchFor(contributorName: string): Promise<void> {
    await this.searchInput.fill(contributorName);
    await expect(this.tableRows).toHaveCount(1, { timeout: 10000 });
  }

  get tableRows(): Locator {
    return this.page.locator('tbody.p-datatable-tbody tr');
  }

  get contributorName(): Locator {
    return this.page.locator('td p a');
  }

  /**
   * Scoped to `tableRows` so this can't match the "Filter by permission" / "Bibliography"
   * filter dropdowns above the table, which share the same `span.p-select-label` class
   * (verified live via `_debug_inspect.spec.ts` per CLAUDE.md - a page-wide locator
   * resolves 3 elements even after `searchFor` narrows the table to one row).
   */
  get userPermission(): Locator {
    return this.tableRows.locator('span.p-select-label');
  }

  get removeButton(): Locator {
    return this.page.locator('button:has(span.fa-trash)');
  }

  get reorderButton(): Locator {
    return this.page.locator('div.p-datatable-reorderable-row-handle').first();
  }

  get volSection(): Locator {
    return this.page.getByRole('heading', { name: 'View-only links', exact: true });
  }

  /**
   * First link-name cell in the VOL table - matches Python's `link_name` locator
   * (which likewise reads whichever row is first). The fixture registration this runs
   * against already carries leftover VOLs from prior suite runs (verified live), so
   * this is only reliable immediately after creating a new link, same as the Python
   * original assumed.
   */
  get linkName(): Locator {
    return this.page.locator('osf-view-only-table table tbody tr td').first();
  }

  /**
   * The VOL URL for a given link name. The app stores it in the copy-link input's
   * `id` attribute rather than its `value` (verified live via `_debug_inspect.spec.ts`
   * per CLAUDE.md - an unusual but confirmed real pattern, not a guess).
   */
  volLinkFor(linkName: string): Locator {
    return this.page.locator('osf-view-only-table tr', { hasText: linkName }).locator('input');
  }

  /**
   * Row-scoped Delete button (`aria-label="Delete"`) for a given view-only link name -
   * a bare `osf-view-only-table ... button` locator is ambiguous, since each row also
   * carries a `aria-label="Copy to clipboard button"` button (verified live via
   * `tests/_debug_inspect.spec.ts` per CLAUDE.md).
   */
  volDeleteButtonFor(linkName: string): Locator {
    return this.page
      .locator('osf-view-only-table tr', { hasText: linkName })
      .getByRole('button', { name: 'Delete', exact: true });
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName, exact: true }).click();
  }

  /**
   * Navigates to the contributors page and waits for the VOL list's initial GET to
   * finish. Verified live via `tests/_debug_inspect.spec.ts`: if a VOL is created
   * (POST) while that GET is still in flight, the app drops the new link from the
   * table until the next reload, so callers that create a VOL must wait for this first.
   */
  async gotoAndWaitForVolList(guid: string): Promise<void> {
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          /\/view_only_links\/(\?|$)/.test(response.url()) && response.request().method() === 'GET'
      ),
      this.page.goto(registrationUrl(guid, 'contributors')),
    ]);
    await this.verify();
  }

  /**
   * The contributors table renders asynchronously after `osf-contributors` (this
   * page's `identity`) mounts - reading rows right after `verify()` can race it and
   * see zero rows (same pattern as `ConnectAddonModal.getRowCount` in
   * `UserModals.ts`). Waiting for `tableRows` itself isn't enough - verified live that
   * a `tr` can be present and visible before its `td p a` contributor link renders -
   * so wait for the link specifically. Bounded and swallowed (not a hard prerequisite)
   * because a permission/bibliography filter can legitimately narrow the table to zero
   * rows - callers that expect a non-empty result assert on the returned list instead.
   */
  async getContributorsList(): Promise<string[]> {
    await this.tableRows
      .locator('td p a')
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => undefined);
    return this.tableRows.locator('td p a').allTextContents();
  }

  async getOrderOfContributor(contributorName: string): Promise<number> {
    const names = (await this.getContributorsList()).map((name) => name.trim());
    return names.indexOf(contributorName);
  }

  /**
   * Scoped to `tbody` so this can't accidentally hit the "Filter by permission" /
   * "Bibliography" dropdowns living above the table (both share the same
   * `div.p-select-dropdown` class) - call after `searchInput` has narrowed the table
   * to the single row being edited.
   */
  async selectPermissionFromDropdownListbox(permission: string): Promise<void> {
    await this.tableRows.locator('div.p-select-dropdown').click();
    await this.page.locator('ul li', { hasText: permission }).first().click();
  }

  get permissionFilterDropdown(): Locator {
    return this.page.locator('div.p-select-dropdown').first();
  }

  async selectPermissionFilterFromDropdownList(permission: string): Promise<void> {
    await this.permissionFilterDropdown.click();
    await this.page.locator('ul li', { hasText: permission }).first().click();
  }

  get bibliographyFilterDropdown(): Locator {
    return this.page.locator('span[aria-label="Bibliography"] ~ div').first();
  }

  async selectBibliographyFilterFromDropdownList(bibliography: string): Promise<void> {
    await this.bibliographyFilterDropdown.click();
    await this.page.locator('ul li', { hasText: bibliography }).first().click();
  }

  async clickOnBibliographicCheckbox(): Promise<void> {
    await this.tableRows.locator('input[aria-label="Bibliographic Contributor"]').first().click();
  }

  /** Despite the name (matches Python's `verify_link_present`), returns `true` once the link is gone. */
  async verifyLinkPresent(linkName: string): Promise<boolean> {
    const cell = this.page.locator('osf-view-only-table td', { hasText: linkName });
    // The row removal isn't instant after confirming delete - wait for it, then check.
    await cell.first().waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
    return (await cell.count()) === 0;
  }

  // Components
  get addContributorModal(): AddContributorModal {
    return new AddContributorModal(this.page);
  }

  get createVolModal(): CreateVolModal {
    return new CreateVolModal(this.page);
  }

  get deleteVolModal(): DeleteVolModal {
    return new DeleteVolModal(this.page);
  }
}
