import { Locator } from '@playwright/test';

import { BasePage } from './BasePage';


export class PreprintPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-preprint-details');
  }

  get preprintTitle(): Locator {
    return this.page.locator('a.custom-light-hover.dark-blue-link');
  }

  /**
   * The Angular preprint-detail page has no "Submitted:" text anywhere any more -
   * verified live via `tests/_debug_inspect.spec.ts` per CLAUDE.md. The equivalent
   * field is now "Created: {date}" inside the file section, alongside a separate
   * "Last edited : {date}" span it must not also match.
   */
  get dateCreated(): Locator {
    return this.page
      .locator('osf-preprint-file-section span')
      .filter({ hasText: /^\s*Created:/ })
      .first();
  }

  get allContributors(): Locator {
    return this.page.locator('[data-test-contributor-name]');
  }
}
