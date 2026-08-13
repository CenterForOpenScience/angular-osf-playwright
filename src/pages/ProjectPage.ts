import { Locator } from '@playwright/test';

import { BasePage } from './BasePage';

/**
 * Scoped port of `pages/project.py`'s `ProjectPage` (the project overview page) -
 * only the fields `tests/test_search.py` reads. The full Python page object (~1600
 * lines) covers much more (contributors management, wiki, files, addons, etc.) and
 * is out of scope here - see the similar note on `defaultProjectPage` in
 * `src/fixtures/index.ts`.
 */
export class ProjectPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('osf-project-overview');
  }

  get title(): Locator {
    return this.page.locator('h1[data-test-page-heading]');
  }

  get dateCreated(): Locator {
    return this.page.locator('h3:text-is("Date Created") + p');
  }

  get license(): Locator {
    return this.page.locator('h3:text-is("License") + osf-resource-license');
  }

  get collection(): Locator {
    return this.page.locator('osf-overview-collections > div');
  }

  get doi(): Locator {
    return this.page.locator('h3:text-is("Project DOI") + osf-resource-doi');
  }

  get allContributors(): Locator {
    return this.page.locator('[data-test-contributor-name]');
  }
}
