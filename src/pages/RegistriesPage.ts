import { Locator, Page, Request, Response, expect } from '@playwright/test';

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

/** Moderation pages of a branded registry. Python hard-coded `egap`. */
export const MODERATION_PROVIDER = 'egap';

function moderationUrl(providerId: string, path = ''): string {
  return `${settings.OSF_HOME}/registries/${providerId}/moderation${path}`;
}

/** Matches a whole option/toggle text, so "Pending" doesn't also match "Pending Updates". */
function exactText(text: string): RegExp {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
}

/**
 * Port of `ModeratorDashboardPage.relative_time_to_days`. Cards show relative dates
 * ("10 months ago", "last year"), so sorting is checked on their age in days. Throws
 * on an unknown format, as Python did.
 */
export function relativeTimeToDays(relativeTime: string): number {
  const text = relativeTime.toLowerCase().trim();
  const fixed: Record<string, number> = {
    today: 0,
    'just now': 0,
    yesterday: 1,
    'last week': 7,
    'last month': 30,
    'last year': 365,
  };
  if (text in fixed) return fixed[text];

  const match = text.match(/^(\d+|an?)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (!match) throw new Error(`Unable to convert relative time: ${relativeTime}`);
  const value = /^\d+$/.test(match[1]) ? Number(match[1]) : 1;
  const days: Record<string, number> = { second: 0, minute: 0, hour: 0, day: 1, week: 7, month: 30, year: 365 };
  return value * days[match[2]];
}

const RELATIVE_TIME = /^(?:today|just now|yesterday|last (?:week|month|year)|(?:\d+|an?) \w+ ago)$/i;

/** Port of `ModeratorDashboardPage` - `/registries/<provider>/moderation/<tab>`. */
export class ModeratorDashboardPage extends BasePage {
  constructor(
    page: Page,
    private readonly providerId = MODERATION_PROVIDER
  ) {
    super(page);
  }

  get url(): string {
    return moderationUrl(this.providerId);
  }

  get identity(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Moderation', exact: true });
  }

  /**
   * Python's `goto_short` + `ModeratorDashboardPage(driver, verify=True)`. The dashboard
   * redirects to `/moderation/pending` and loads the Pending list on its own, so wait for
   * that load here - otherwise it can still be in flight when the test picks a tab.
   */
  async open(): Promise<this> {
    await this.waitForSubmissions(async () => {
      await this.goto();
    });
    await this.verify();
    return this;
  }

  tab(name: string): Locator {
    return this.page.getByRole('tab', { name, exact: true });
  }

  /**
   * Port of `select_tab`. Pending/Submitted wait for their submissions list, so a
   * results check can't read the previous tab's (or an unloaded) list.
   */
  async selectTab(name: string): Promise<void> {
    if ((await this.tab(name).getAttribute('aria-selected')) === 'true') {
      // Re-clicking the open tab (Pending, after `open()`) sends no request.
      await this.tab(name).click();
    } else if (name === 'Moderators') {
      await this.waitForModerators(() => this.tab(name).click());
    } else if (name === 'Pending' || name === 'Submitted') {
      await this.waitForSubmissions(() => this.tab(name).click());
    } else {
      await this.tab(name).click();
    }
    await expect(this.tab(name)).toHaveAttribute('aria-selected', 'true');
  }

  // ---------- Pending / Submitted tabs ----------

  /**
   * The state filter toggles (Python's `pending_updates_button`, `submitted_embargo_button`,
   * ...). Clicking the toggle that's already pressed unpresses it and the list goes empty,
   * so only click toggles that aren't the tab's default.
   */
  toggleButton(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true }).and(this.page.locator('p-togglebutton'));
  }

  async selectToggle(name: string): Promise<void> {
    await this.waitForSubmissions(() => this.toggleButton(name).click());
    await expect(this.toggleButton(name)).toHaveAttribute('aria-pressed', 'true');
  }

  /**
   * The sort select. Its accessible name is an untranslated i18n key
   * ("moderation.sortOption.newest"), so it's the tab's first combobox (as in Python).
   */
  get sortDropdown(): Locator {
    return this.page.getByRole('combobox').first();
  }

  /** Port of `selected_sorting_option`. */
  get selectedSortingOption(): Locator {
    return this.sortDropdown;
  }

  /** Port of `select_sorting_option`. Options are matched by visible text (i18n-key names). */
  async selectSortingOption(sortName: string): Promise<void> {
    const alreadySelected = exactText(sortName).test(await this.sortDropdown.innerText());
    await this.sortDropdown.click();
    const option = this.page.getByRole('option').filter({ hasText: exactText(sortName) });
    // Re-picking the current sort (the default "Date: newest to oldest") sends no request.
    if (alreadySelected) {
      await option.click();
    } else {
      await this.waitForSubmissions(() => option.click());
    }
    await expect(this.sortDropdown).toHaveText(exactText(sortName));
  }

  /** Each submission card (Python's `[osfstoppropagation]`). */
  get cards(): Locator {
    return this.page.locator('[osfstoppropagation]');
  }

  get noSubmissionsMessage(): Locator {
    return this.page.getByText('No submissions', { exact: true });
  }

  get nextPageButton(): Locator {
    return this.page.getByRole('button', { name: 'Next Page', exact: true });
  }

  /**
   * Runs `action` and waits for the submissions list request it triggers, then for the
   * list (or its empty message) to render.
   */
  async waitForSubmissions(action: () => Promise<void>): Promise<void> {
    const listPath = `/v2/providers/registrations/${this.providerId}/`;
    // Each card's date line comes from its own `/registrations/<id>/actions/` request,
    // fired after the list renders - track them so dates aren't read before they load.
    // A failed request counts as settled too: uat1 sometimes fails one (net::ERR_FAILED),
    // and that card then shows no date, which the date readers already skip.
    const loadedActions = new Set<string>();
    const actionsId = (url: string): string | undefined =>
      url.match(/\/v2\/registrations\/([^/]+)\/actions\//)?.[1];
    const onResponse = (resp: Response): void => {
      const id = actionsId(resp.url());
      if (id) loadedActions.add(id);
    };
    const onRequestFailed = (req: Request): void => {
      const id = actionsId(req.url());
      if (!id) return;
      console.log(`Review actions request failed for ${id}: ${req.failure()?.errorText}`);
      loadedActions.add(id);
    };
    this.page.on('response', onResponse);
    this.page.on('requestfailed', onRequestFailed);
    try {
      // Match the request the action sends, not one already in flight (a response-based
      // wait picked up the page's initial Pending list after switching to Submitted).
      const listRequest = this.page.waitForRequest(
        (req) => req.method() === 'GET' && req.url().includes(listPath) && req.url().includes('sort=')
      );
      await action();
      const listResponse = await (await listRequest).response();
      // The body can be gone if the app superseded the request - then count cards instead.
      const body = listResponse ? await listResponse.json().catch(() => null) : null;
      await expect(this.cards.first().or(this.noSubmissionsMessage)).toBeVisible();
      if (body) {
        const ids: string[] = (body.data ?? [])
          .filter((item: any) => item.type === 'registrations')
          .map((item: any) => item.id);
        await expect
          .poll(() => ids.filter((id) => !loadedActions.has(id)), {
            message: 'Every listed registration should have its review actions loaded',
          })
          .toEqual([]);
      } else {
        const cardCount = await this.cards.count();
        await expect
          .poll(() => loadedActions.size, {
            message: 'Every listed registration should have its review actions loaded',
          })
          .toBeGreaterThanOrEqual(cardCount);
      }
    } finally {
      this.page.off('response', onResponse);
      this.page.off('requestfailed', onRequestFailed);
    }
  }

  /** Port of `verify_results_exist`. */
  async resultsExist(): Promise<boolean> {
    return (await this.cards.count()) > 0;
  }

  /** Port of `get_titles_from_page`: each card's title is its first (link-styled) button. */
  async getTitlesFromPage(): Promise<string[]> {
    const titles: string[] = [];
    for (const card of await this.cards.all()) {
      titles.push((await card.getByRole('button').first().innerText()).trim());
    }
    return titles;
  }

  /**
   * Port of `get_dates_from_page`: each card's relative date, as an age in days. A
   * registration without review actions shows no date, so its card is left out, as in
   * Python (`waitForSubmissions` has already waited for the actions to load).
   */
  async getDatesFromPage(): Promise<number[]> {
    const dates: number[] = [];
    for (const card of await this.cards.all()) {
      const lines = (await card.innerText()).split('\n').map((line) => line.trim());
      const relativeTime = lines.find((line) => RELATIVE_TIME.test(line));
      if (!relativeTime) {
        console.log(`Could not find relative date in card:\n${lines.join('\n')}`);
        continue;
      }
      dates.push(relativeTimeToDays(relativeTime));
    }
    return dates;
  }

  /** Reads `readPage` on every page of the paginated list. */
  private async collectAllPages<T>(readPage: () => Promise<T[]>): Promise<T[]> {
    const values: T[] = [];
    for (;;) {
      values.push(...(await readPage()));
      if (!(await this.nextPageButton.isVisible()) || !(await this.nextPageButton.isEnabled())) break;
      await this.waitForSubmissions(() => this.nextPageButton.click());
    }
    return values;
  }

  /** Port of `get_all_titles`. */
  getAllTitles(): Promise<string[]> {
    return this.collectAllPages(() => this.getTitlesFromPage());
  }

  /** Port of `get_all_dates`. */
  getAllDates(): Promise<number[]> {
    return this.collectAllPages(() => this.getDatesFromPage());
  }

  // ---------- Moderators tab ----------

  /** Port of `search_input` (the Moderators tab's search box). */
  get searchInput(): Locator {
    return this.page.getByPlaceholder('Search', { exact: true });
  }

  get addModeratorButton(): Locator {
    return this.page.getByRole('button', { name: 'Add moderator', exact: true });
  }

  get moderatorRows(): Locator {
    return this.page.getByRole('table').locator('tbody tr');
  }

  moderatorRow(name: string): Locator {
    return this.moderatorRows.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  /** Port of `user_name` - the moderator's name link in the row. */
  moderatorName(name: string): Locator {
    return this.moderatorRow(name).getByRole('link', { name, exact: true });
  }

  /** Port of `user_permission`. Its accessible name is an i18n key, hence the role alone. */
  moderatorPermission(name: string): Locator {
    return this.moderatorRow(name).getByRole('combobox');
  }

  /** Port of `no_results_message`. */
  get noResultsMessage(): Locator {
    return this.moderatorRows.getByText('No results found.', { exact: true });
  }

  async waitForModerators(action: () => Promise<void>, method = 'GET'): Promise<void> {
    const response = this.page.waitForResponse(
      (resp: Response) =>
        resp.request().method() === method &&
        resp.url().includes(`/v2/providers/registrations/${this.providerId}/moderators/`)
    );
    await action();
    await response;
  }

  /** Types into the Moderators search box and waits for the filtered list. */
  async searchModerators(text: string): Promise<void> {
    await this.searchInput.clear();
    await this.waitForModerators(() => this.searchInput.fill(text));
    await expect(this.moderatorRows.first()).toBeVisible();
  }

  /** Port of `select_permission_from_dropdown_listbox`. */
  async selectModeratorPermission(name: string, permission: string): Promise<void> {
    await this.moderatorPermission(name).click();
    const option = this.page.getByRole('option').filter({ hasText: exactText(permission) });
    await this.waitForModerators(() => option.click(), 'PATCH');
  }

  /** Port of `click_on_remove_moderator_icon`. */
  removeModeratorButton(name: string): Locator {
    return this.moderatorRow(name).getByRole('button', { name: 'Delete', exact: true });
  }

  get addModeratorModal(): AddModeratorModal {
    return new AddModeratorModal(this.page);
  }

  get removeModeratorModal(): RemoveModeratorModal {
    return new RemoveModeratorModal(this.page);
  }
}

/** Port of `AddModeratorModal`. */
export class AddModeratorModal {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('dialog', { name: 'Add Moderator' });
  }

  get searchInput(): Locator {
    return this.root.getByPlaceholder('Search by name or user information');
  }

  /** Port of `select_user_checkbox`. The checkbox has no label; its id is the user's guid. */
  userCheckbox(userId: string): Locator {
    return this.root.getByRole('checkbox').and(this.page.locator(`[id="${userId}"]`));
  }

  button(name: string): Locator {
    return this.root.getByRole('button', { name, exact: true });
  }
}

/** Port of `DeleteModeratorModal` - a PrimeNG confirm dialog. */
export class RemoveModeratorModal {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('alertdialog', { name: 'Remove moderator' }).or(
      this.page.getByRole('dialog', { name: 'Remove moderator' })
    );
  }

  button(name: string): Locator {
    return this.root.getByRole('button', { name, exact: true });
  }
}

/** Port of `ModeratorSettingsPage` - `/registries/<provider>/moderation/settings`. */
export class ModeratorSettingsPage extends BasePage {
  constructor(
    page: Page,
    private readonly providerId = MODERATION_PROVIDER
  ) {
    super(page);
  }

  get url(): string {
    return moderationUrl(this.providerId, '/settings');
  }

  get identity(): Locator {
    // The DOM text is lower-case; CSS capitalizes it on screen.
    return this.page.getByRole('heading', { name: 'Configure reviews notification preferences', exact: true });
  }

  async open(): Promise<this> {
    await this.goto();
    await this.verify();
    return this;
  }

  /**
   * Port of `new_pending_submission_notification_freq`. The combobox's `aria-label` is an
   * i18n key, which overrides its `<label for>` ("New pending submissions"), so
   * `getByLabel` can't find it; its id is the stable hook.
   */
  get newPendingSubmissionNotificationFreq(): Locator {
    return this.page.locator('#subscription-provider_new_pending_submissions');
  }

  /** Port of `new_pending_withdraw_requests_notification_freq`. See above. */
  get newPendingWithdrawRequestsNotificationFreq(): Locator {
    return this.page.locator('#subscription-provider_new_pending_withdraw_requests');
  }

  get userSettingsLink(): Locator {
    return this.page.getByRole('link', { name: 'User settings', exact: true });
  }

  /** Picks `frequency` in `dropdown` and waits for the subscription to be saved. */
  async selectFrequency(dropdown: Locator, frequency: string): Promise<void> {
    await dropdown.click();
    const option = this.page.getByRole('option').filter({ hasText: exactText(frequency) });
    const saved = this.page.waitForResponse(
      (resp: Response) => resp.request().method() !== 'GET' && resp.url().includes('/subscriptions/')
    );
    await option.click();
    expect((await saved).ok()).toBe(true);
  }

  /** Port of `select_from_pending_submissions_dropdown`. */
  selectFromPendingSubmissionsDropdown(frequency: string): Promise<void> {
    return this.selectFrequency(this.newPendingSubmissionNotificationFreq, frequency);
  }

  /** Port of `select_from_withdraw_requests_dropdown`. */
  selectFromWithdrawRequestsDropdown(frequency: string): Promise<void> {
    return this.selectFrequency(this.newPendingWithdrawRequestsNotificationFreq, frequency);
  }
}
