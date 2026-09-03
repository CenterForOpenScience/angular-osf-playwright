import { Locator } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';

/**
 * Identity-only landing pages reached via `components/Navbar.ts`, ported from
 * `pages/dashboard.py`, `pages/meetings.py`, `pages/institutions.py`,
 * `pages/registries.py`, `pages/preprints.py`, `pages/project.py` and
 * `pages/registrations.py` - only the pieces `tests/navbar.spec.ts` needs
 * (confirming a navbar click landed on the right page), not full page objects.
 */

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

/**
 * The navbar's Registries item is a dropdown now (see `Navbar.clickRegistriesLink`)
 * rather than a direct link, and lands on `/registries/discover`, not a bare
 * `/registries/` overview like the old app's `RegistriesNavbar`.
 */
export class RegistriesLandingPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/registries/discover`;
  }

  get identity(): Locator {
    return this.page.locator('osf-registries-landing');
  }
}

/** Same dropdown-then-discover navigation as `RegistriesLandingPage` above. */
export class PreprintLandingPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/preprints/discover`;
  }

  get identity(): Locator {
    return this.page.locator('osf-preprints-landing');
  }

  /**
   * Page content, not a navbar item - the old app's per-service `PreprintsNavbar`
   * had its own `add_a_preprint_link`; the current navbar has no such entry, this
   * button on the discover page itself is what replaced it.
   */
  get addAPreprintButton(): Locator {
    return this.page.getByRole('button', { name: 'Add A Preprint' });
  }
}

/**
 * Reached via `PreprintLandingPage.addAPreprintButton` (`/preprints/select`), not a
 * distinct per-provider navbar item like the old app's `NewPreprintsProviderServicePage`.
 */
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

/**
 * Port of `pages/support.py`'s `SupportPage` - the external help.osf.io Zendesk
 * site opened in a new tab via the navbar's Support link, not part of the Angular
 * app itself, so it has no `osf-*` custom element to key off of.
 */
export class SupportPage extends BasePage {
  get identity(): Locator {
    return this.page.getByRole('heading', { name: /welcome to osf support/i });
  }
}
