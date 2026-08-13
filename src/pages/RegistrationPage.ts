import { Locator } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Scoped port of `pages/registries.py`'s `RegistrationDetailPage` (the registration
 * overview page) - only the fields `tests/test_search.py` reads. `title` is inherited
 * in Python from `BaseSubmittedRegistrationPage`. The full Python page object covers
 * much more (metadata editing, resources, moderation decisions, etc.) and is out of
 * scope here.
 */
export class RegistrationPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('[data-test-page-heading]');
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
}
