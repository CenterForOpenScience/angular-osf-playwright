import { Page, Locator, expect } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';
import { RegistrationSideNavbar } from './components/RegistrationSideNavbar';
import {
  AddContributorModal,
  CreateVolModal,
  DeleteVolModal,
} from './components/RegistrationModals';

/**
 * Port of `pages/registries.py` / `components/registration.py` - the pages
 * `tests/test_registration_sidebar.py` exercises. `RegistrationPage` below is the
 * Registration Overview page; the rest of the file is its side-nav siblings
 * (Metadata/Files/Resources/Wiki/Components/Links/Analytics/Contributors).
 *
 * Only Overview, Resources, Wiki and Contributors carry real behavior here -
 * Metadata/Files/Components/Links/Analytics are only ever navigated to and checked
 * for `identity` by the side-nav smoke tests in `tests/test_registration_sidebar.py`,
 * so those page objects stay identity-only (their fuller Python page objects cover
 * metadata editing, file browsing, etc. - out of scope for this file).
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

export class RegistrationMetadataPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-metadata');
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
