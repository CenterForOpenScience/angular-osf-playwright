import { Locator } from '@playwright/test';

import { BasePage } from './BasePage';


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
