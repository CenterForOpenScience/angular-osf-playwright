import { Locator, expect } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';


export class DashboardPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/dashboard`;
  }

  get identity(): Locator {
    return this.page.locator('osf-dashboard');
  }
}

export class MeetingsPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/meetings`;
  }

  get identity(): Locator {
    return this.page.locator('osf-meetings-landing');
  }
}

export class InstitutionsLandingPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/institutions`;
  }

  get identity(): Locator {
    return this.page.locator('osf-institutions-list');
  }
}

export class RegistriesLandingPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/registries/discover`;
  }

  get identity(): Locator {
    return this.page.locator('osf-registries-landing');
  }

  get searchBox(): Locator {
    return this.page.getByPlaceholder('Search Registrations', { exact: true });
  }
}

export class PreprintLandingPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/preprints/discover`;
  }

  get identity(): Locator {
    return this.page.locator('osf-preprints-landing');
  }


  get addAPreprintButton(): Locator {
    return this.page.getByRole('button', { name: 'Add A Preprint' });
  }
}


export class NewPreprintsProviderServicePage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/preprints/select`;
  }

  get identity(): Locator {
    return this.page.locator('osf-select-preprint-service');
  }
}

export class MyProjectsPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/my-projects`;
  }

  get identity(): Locator {
    return this.page.locator('osf-my-projects');
  }
}

/**
 * Port of `pages/registrations.py` `MyRegistrationsPage`. Drafts and Submitted are PrimeNG
 * tabs whose panels are labelled by their tab, so each panel is a `tabpanel` named after
 * it. The Drafts panel only loads its cards once its tab is clicked (opening
 * `?tab=draft` lands on Submitted), so use `openDraftsTab()` before reading it.
 */
export class MyRegistrationsPage extends BasePage {
  static readonly NO_REGISTRATIONS_MESSAGE =
    "You don't have any registrations. Create one with the button below.";

  get url(): string {
    return `${settings.OSF_HOME}/my-registrations`;
  }

  get identity(): Locator {
    return this.page.locator('osf-my-registrations');
  }

  get draftsTab(): Locator {
    return this.page.getByRole('tab', { name: 'Drafts', exact: true });
  }

  get submittedTab(): Locator {
    return this.page.getByRole('tab', { name: 'Submitted', exact: true });
  }

  get draftsPanel(): Locator {
    return this.page.getByRole('tabpanel', { name: 'Drafts', exact: true });
  }

  get submittedPanel(): Locator {
    return this.page.getByRole('tabpanel', { name: 'Submitted', exact: true });
  }

  /** The panel's empty-state text. */
  noRegistrationsMessage(panel: Locator): Locator {
    return panel.getByText(MyRegistrationsPage.NO_REGISTRATIONS_MESSAGE);
  }

  /** The empty state's "Add a Registration" button (the page header has another one). */
  addRegistrationButton(panel: Locator): Locator {
    return panel.getByRole('button', { name: 'Add a Registration', exact: true });
  }

  registrationCards(panel: Locator): Locator {
    return panel.locator('osf-registration-card');
  }

  /** Cards whose heading is exactly `title`, newest first (the list's order). */
  registrationCardsByTitle(panel: Locator, title: string): Locator {
    return this.registrationCards(panel).filter({
      has: this.page.getByRole('heading', { name: title, exact: true }),
    });
  }

  async openDraftsTab(): Promise<void> {
    await this.draftsTab.click();
    await this.waitForPanelLoaded(this.draftsPanel);
  }

  async openSubmittedTab(): Promise<void> {
    await this.submittedTab.click();
    await this.waitForPanelLoaded(this.submittedPanel);
  }

  /** A panel is loaded once it shows either a card or its empty-state message. */
  private async waitForPanelLoaded(panel: Locator): Promise<void> {
    await expect(
      this.registrationCards(panel).first().or(this.noRegistrationsMessage(panel))
    ).toBeVisible({ timeout: settings.LONG_TIMEOUT_MS });
  }
}


export class SupportPage extends BasePage {
  get identity(): Locator {
    return this.page.getByRole('heading', { name: /welcome to osf support/i });
  }
}
