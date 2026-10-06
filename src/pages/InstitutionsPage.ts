import { Locator, Page, expect } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';
import { SearchPage } from './SearchPage';


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


  async searchFor(name: string): Promise<void> {
    await expect(async () => {
      await this.searchBar.fill(name);
      await expect(this.institutionList.first()).toContainText(name, {
        timeout: settings.QUICK_TIMEOUT_MS,
      });
    }).toPass({ timeout: settings.LONG_TIMEOUT_MS });
  }
}


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
