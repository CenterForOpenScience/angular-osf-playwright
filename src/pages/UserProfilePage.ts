import { Locator } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Scoped port of `pages/user.py`'s `UserProfilePage` - the **public** profile page
 * (`/<guid>/`), distinct from the `/settings/profile` `ProfileInformationPage` in
 * `UserPages.ts`. Only the fields `tests/test_search.py` reads.
 */
export class UserProfilePage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-profile-information');
  }

  get profileName(): Locator {
    return this.page.locator('osf-profile-information h1');
  }

  get orcidLink(): Locator {
    return this.page.locator('osf-profile-information a[href*="orcid.org"]');
  }

  /**
   * Scoped to `osf-search-results-container` for the same reason as
   * `SearchPage.ts`'s own `resultsContainer` - the profile page reuses that
   * component to list the user's projects/registrations/preprints, and it renders
   * a hidden `div[role="button"]` panel-menu header sharing the same accessible
   * name as the real, visible `<button>` tab.
   */
  private get resultsContainer(): Locator {
    return this.page.locator('osf-search-results-container');
  }

  get projectsTab(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Projects', exact: true });
  }

  get registrationsTab(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Registrations', exact: true });
  }

  get preprintsTab(): Locator {
    return this.resultsContainer.getByRole('button', { name: 'Preprints', exact: true });
  }

  get resultCount(): Locator {
    return this.page.locator('h4.result-count');
  }
}
