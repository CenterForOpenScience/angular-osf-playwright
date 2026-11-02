import { Locator, Page } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';


export class RegistriesDiscoverPage extends BasePage {
  constructor(
    page: Page,
    private readonly providerId: string
  ) {
    super(page);
  }

  get url(): string {
    const provider = this.providerId === 'osf' ? '' : `${this.providerId}/`;
    return `${settings.OSF_HOME}/registries/${provider}`;
  }

  get identity(): Locator {
    return this.page.locator('osf-registries-provider-search');
  }
}

/** Port of `RegistrationAddNewPage` - `/registries/<provider>/new`. */
export class RegistrationAddNewPage extends BasePage {
  constructor(
    page: Page,
    private readonly providerId = 'osf'
  ) {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/registries/${this.providerId}/new`;
  }

  get identity(): Locator {
    return this.page.locator('osf-new-registration');
  }

  get hasProjectButton(): Locator {
    return this.page.getByRole('button', { name: 'Yes', exact: true });
  }


  get projectDropdown(): Locator {
    return this.page.locator('p-select[data-test-project-select]');
  }

  get schemaDropdown(): Locator {
    return this.page.locator('p-select[data-test-schema-select]');
  }

  /** New since the Python test: Create draft stays disabled until this is checked. */
  get researchPlanConfirmCheckbox(): Locator {
    return this.page.getByLabel(/I understand and confirm that I am submitting a research plan/);
  }

  get createDraftButton(): Locator {
    return this.page.getByRole('button', { name: 'Create draft', exact: true });
  }

  /** Port of `select_from_dropdown_listbox` - picks an option of the open select. */
  async selectOption(option: string): Promise<void> {
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }
}

/** Port of `BaseRegistrationDraftPage` - `/registries/drafts/<draft id>/<step>`. */
abstract class BaseRegistrationDraftPage extends BasePage {
  protected abstract readonly step: string;

  constructor(
    page: Page,
    private readonly draftId = ''
  ) {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/registries/drafts/${this.draftId}/${this.step}`;
  }

  get nextPageButton(): Locator {
    return this.page.getByRole('button', { name: 'Next', exact: true });
  }
}

export class DraftRegistrationMetadataPage extends BaseRegistrationDraftPage {
  protected readonly step = 'metadata';

  get identity(): Locator {
    return this.page.locator('osf-registries-metadata-step');
  }

  get titleInput(): Locator {
    return this.page.getByLabel('Title', { exact: true });
  }

  get descriptionInput(): Locator {
    return this.page.getByLabel('Description', { exact: true });
  }

  /** Same reasoning as `RegistrationAddNewPage.schemaDropdown`. */
  get licenseDropdown(): Locator {
    return this.page.locator('osf-registries-license p-select');
  }

  get tagInput(): Locator {
    return this.page.getByLabel('Tag input', { exact: true });
  }

  private get subjects(): Locator {
    return this.page.locator('osf-registries-subjects');
  }

  /**
   * Scoped to the Subjects card: the left sidenav is a `tree` of `treeitem`s too, which
   * the Python `li[role="treeitem"]` also matched.
   */
  get topLevelSubjects(): Locator {
    return this.subjects.getByRole('treeitem', { level: 1 });
  }

  /** Port of `first_subject_second_level_subjects` - populated once the first subject is expanded. */
  get firstSubjectSecondLevelSubjects(): Locator {
    return this.topLevelSubjects.first().getByRole('treeitem', { level: 2 });
  }

  /** The expand toggle has no accessible name; PrimeNG's structural class is the only hook. */
  get expandFirstSubjectButton(): Locator {
    return this.topLevelSubjects.first().locator('.p-tree-node-toggle-button').first();
  }

  /** Subject names in display order, read from each tree item's accessible name. */
  static async readSubjectNames(items: Locator): Promise<string[]> {
    return items.evaluateAll((elements) => elements.map((el) => el.getAttribute('aria-label') ?? ''));
  }

  async selectTopLevelSubject(subject: string): Promise<void> {
    await this.subjects
      .getByRole('treeitem', { name: subject, exact: true })
      .getByRole('checkbox')
      .first()
      .check();
  }

  selectedSubject(subject: string): Locator {
    return this.page.locator(`p-chip[aria-label="${subject}"]`);
  }

  async selectOption(option: string): Promise<void> {
    await this.page.getByRole('option', { name: option, exact: true }).click();
  }
}

/** Port of `DraftRegistrationSummaryPage` - the Open-Ended template's only step (`/1`, was `/1-summary`). */
export class DraftRegistrationSummaryPage extends BaseRegistrationDraftPage {
  protected readonly step = '1';

  get identity(): Locator {
    return this.summaryTextbox;
  }

  get pageHeading(): Locator {
    return this.page.locator('osf-drafts').getByRole('heading', { level: 2 });
  }

  get summaryTextbox(): Locator {
    return this.page.getByLabel(/Provide a narrative summary of what is contained in this registration/);
  }
}

export class DraftRegistrationReviewPage extends BaseRegistrationDraftPage {
  protected readonly step = 'review';

  get identity(): Locator {
    return this.page.locator('osf-review');
  }

  get title(): Locator {
    return this.page.locator('[data-test-review-response="title"]');
  }

  get description(): Locator {
    return this.page.locator('[data-test-review-response="description"]');
  }

  get license(): Locator {
    return this.page.locator('osf-license-display [data-test-target-license-name]');
  }

  get subject(): Locator {
    return this.page.locator('[data-test-selected-subject]');
  }

  get tags(): Locator {
    return this.page.locator('[data-test-tags-widget-tag-input]');
  }

  get registerButton(): Locator {
    return this.page.getByRole('button', { name: 'Register', exact: true });
  }

  // Register dialog
  get immediateRadioButton(): Locator {
    return this.page.getByRole('dialog').getByLabel('Make registration public immediately');
  }

  get submitButton(): Locator {
    return this.page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true });
  }
}
