import { Locator } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Scoped port of `pages/preprints.py`'s `PreprintDetailPage` - only the fields
 * `tests/test_search.py` reads from the preprint overview page reached via the
 * search card's `click_expecting_popup()`. The full Python page object covers much
 * more (reviews/moderation actions, versioning, etc.) and is out of scope here.
 */
export class PreprintPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-preprint-details');
  }

  get preprintTitle(): Locator {
    return this.page.locator('a.custom-light-hover.dark-blue-link');
  }

  get dateCreated(): Locator {
    return this.page.locator('span').filter({ hasText: /^\s*Submitted/ });
  }

  get allContributors(): Locator {
    return this.page.locator('[data-test-contributor-name]');
  }
}
