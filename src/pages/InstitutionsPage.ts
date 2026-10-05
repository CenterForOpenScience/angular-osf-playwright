import { Locator, Page, expect } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';
import { SearchPage } from './SearchPage';

/**
 * Port of `pages/institutions.py`.
 *
 * The Python identities (`div[data-test-insitutions-header]`,
 * `img[data-test-institution-banner]`) are Ember-era attributes that no longer exist in
 * the Angular app - verified live via `tests/_debug_inspect.spec.ts` per `CLAUDE.md`. The
 * pages' own Angular components (`osf-institutions-list`, `osf-institutions-search`) are
 * used instead.
 */
export class InstitutionsLandingPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/institutions/`;
  }

  get identity(): Locator {
    return this.page.locator('osf-institutions-list');
  }

  get searchBar(): Locator {
    return this.page.getByPlaceholder('Search institutions');
  }

  /**
   * Each institution is one `<a>` card wrapping its logo and `<h2>` name. Filtered on
   * the `<h2>` because the list's sub-header also has a plain "Read more" link.
   */
  get institutionList(): Locator {
    return this.identity.getByRole('link').filter({ has: this.page.locator('h2') });
  }

  /**
   * Types `name` into the search bar and waits for the list to show it first. A fill
   * that lands before the list component has wired up its input handler (the
   * `/institutions/` -> `/institutions` redirect is still settling) is silently
   * ignored and the unfiltered list stays put, so the fill is retried until it takes.
   * No `fill('')` in between: that fires its own (unfiltered) search, whose response
   * can arrive after the real one and put the full list back (seen live).
   */
  async searchFor(name: string): Promise<void> {
    await expect(async () => {
      await this.searchBar.fill(name);
      await expect(this.institutionList.first()).toContainText(name, {
        timeout: settings.QUICK_TIMEOUT_MS,
      });
    }).toPass({ timeout: settings.LONG_TIMEOUT_MS });
  }
}

/**
 * Port of `InstitutionBrandedPage` - an institution's own page (`/institutions/<id>`).
 * Extends `SearchPage` for the same reason `ProfilePage` does: the page renders the
 * same `osf-search-results-container` tabs/filters/results component as `/search`, so
 * the `checkFilteringBy*` / tab-link helpers ported there apply unchanged.
 */
export class InstitutionBrandedPage extends SearchPage {
  constructor(
    page: Page,
    private readonly institutionId = ''
  ) {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/institutions/${this.institutionId}`;
  }

  get identity(): Locator {
    return this.page.locator('osf-institutions-search');
  }

  get institutionName(): Locator {
    return this.identity.getByRole('heading', { level: 1 });
  }
}

/**
 * Port of `InstitutionAdminDashboardPage`. NOT verified against the live DOM: none of
 * the test accounts in `.env` are admins of the COS institution on `test` (the
 * dashboard redirects them to `/forbidden`, and
 * `/v2/institutions/cos/metrics/summary/` returns 403). The locators below are
 * user-facing equivalents of the Angular-era XPaths the Python test itself uses.
 * The Python page object's `data-test-chart-title`/`data-test-kpi-*`/`_projects-count_*`
 * locators are Ember-era and were dropped.
 */
export class InstitutionAdminDashboardPage extends BasePage {
  constructor(
    page: Page,
    private readonly institutionId = 'cos'
  ) {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/institutions/${this.institutionId}/dashboard`;
  }

  get identity(): Locator {
    return this.page.getByRole('tab', { name: 'Summary' });
  }

  tab(name: 'Summary' | 'Users' | 'Projects' | 'Registrations' | 'Preprints'): Locator {
    return this.page.getByRole('tab', { name, exact: true });
  }

  /** The aria-label is an untranslated i18n key in the app itself. */
  get allDepartmentsDropdown(): Locator {
    return this.page.getByLabel('adminInstitutions.institutionUsers.allDepartments');
  }

  departmentOption(department: string): Locator {
    return this.page.getByRole('option', { name: department, exact: true });
  }

  /** Users-table cells whose department reads exactly `department`. */
  usersInDepartment(department: string): Locator {
    return this.page.locator('td').filter({
      has: this.page.locator('p').getByText(department, { exact: true }),
    });
  }

  /**
   * The big number above the "OSF Public and Private Projects" summary label. Takes
   * the innermost `div` holding both that label and an `<h2>` (the last match in
   * document order) - the Python version was `.../preceding::h2[1]`.
   */
  get totalProjectsCount(): Locator {
    return this.page
      .locator('div')
      .filter({ has: this.page.getByText('OSF Public and Private Projects', { exact: true }) })
      .filter({ has: this.page.locator('h2') })
      .last()
      .locator('h2');
  }

  private get publicVsPrivatePanel(): Locator {
    return this.page
      .locator('p-accordion-panel')
      .filter({ hasText: 'Public vs Private Projects' });
  }

  get publicVsPrivateHeader(): Locator {
    return this.publicVsPrivatePanel.locator('p-accordion-header');
  }

  private projectCountValue(label: RegExp): Locator {
    return this.publicVsPrivatePanel.locator('li').filter({ hasText: label }).locator('span').last();
  }

  get publicProjectsCount(): Locator {
    return this.projectCountValue(/Public projects/);
  }

  get privateProjectsCount(): Locator {
    return this.projectCountValue(/Private projects/);
  }

  async readCount(locator: Locator): Promise<number> {
    await expect(locator).toHaveText(/\d/);
    return parseInt((await locator.innerText()).replace(/\D/g, ''), 10);
  }
}
