import { Locator } from '@playwright/test';

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

export class MyRegistrationsPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/my-registrations`;
  }

  get identity(): Locator {
    return this.page.locator('osf-my-registrations');
  }
}


export class SupportPage extends BasePage {
  get identity(): Locator {
    return this.page.getByRole('heading', { name: /welcome to osf support/i });
  }
}
