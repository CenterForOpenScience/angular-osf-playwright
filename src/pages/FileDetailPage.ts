import { Locator } from '@playwright/test';

import { BasePage } from './BasePage';

/** Port of `pages/file_detail.py`. */
export class FileDetailPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('h1[data-test-page-heading]');
  }

  get fileTitle(): Locator {
    return this.page.locator('h1[data-test-page-heading]');
  }

  get breadcrumbs(): Locator {
    return this.page.locator('osf-breadcrumb div.breadcrumbs');
  }

  get downloadButton(): Locator {
    return this.page.locator('button[aria-label="Download"]');
  }

  get embedButton(): Locator {
    return this.page.locator('button[aria-label="Embed"]');
  }

  get shareButton(): Locator {
    return this.page.locator('button[aria-label="Share"]');
  }

  get backToFilesLink(): Locator {
    return this.page.locator('div.back-navigation a');
  }

  get detailsTab(): Locator {
    return this.page.getByRole('tab', { name: 'Details', exact: true });
  }

  get revisionsTab(): Locator {
    return this.page.getByRole('tab', { name: 'Revisions', exact: true });
  }

  get keywordsTab(): Locator {
    return this.page.getByRole('tab', { name: 'Keywords', exact: true });
  }

  /** First entry on the Revisions tab - a link-styled button named "<n>. <date>" that expands it. */
  get firstRevisionToggleButton(): Locator {
    return this.page.locator('osf-file-revisions').getByRole('button', { name: /^\d+\./ }).first();
  }

  /**
   * Both copy buttons share the accessible name "Copy to clipboard button" (their
   * `aria-label`), so they're matched by their visible text.
   */
  get copyMd5Button(): Locator {
    return this.page.locator('osf-file-revisions').getByRole('button').filter({ hasText: /^\s*Copy MD5\s*$/ }).first();
  }

  get copySha2Button(): Locator {
    return this.page.locator('osf-file-revisions').getByRole('button').filter({ hasText: /^\s*Copy SHA-2\s*$/ }).first();
  }

  get tagInput(): Locator {
    return this.page.getByLabel('Tag input', { exact: true });
  }

  tag(tagName: string): Locator {
    return this.page.locator(`p-chip[aria-label="${tagName}"]`);
  }

  get fileRenderer(): Locator {
    return this.page.locator('iframe[title="Rendering of document"]');
  }

  get projectTitle(): Locator {
    return this.page.locator('osf-file-resource-metadata h4:text-is("Title") + span');
  }

  get projectDescription(): Locator {
    return this.page.locator('osf-file-resource-metadata h4:text-is("Description") + div');
  }

  get projectDateCreated(): Locator {
    return this.page.locator('osf-file-resource-metadata h4:text-is("Date created") + div');
  }

  get projectDateModified(): Locator {
    return this.page.locator('osf-file-resource-metadata h4:text-is("Date modified") + div');
  }

  get funder(): Locator {
    return this.page.locator('osf-file-resource-metadata h4:text-is("Funder") + span');
  }

  get contributors(): Locator {
    return this.page.locator('[data-test-contributor-name]');
  }
}
