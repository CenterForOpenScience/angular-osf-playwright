import { BrowserContext, Locator, Page, Request, Route, expect } from '@playwright/test';

import * as settings from '../../config/settings';
import { PreprintProvider } from '../api/osfApi';
import { clickExpectingPopup } from '../utils';
import { BasePage } from './BasePage';
import { SearchPage } from './SearchPage';

/**
 * Port of `pages/preprints.py` and `components/preprints.py`. The Python locators
 * targeted the Ember app (`data-test-*`, `data-analytics-*`, hashed `_class_xyz`
 * names) or long class-list XPaths; everything below was re-verified against the
 * Angular app via `tests/_debug_inspect.spec.ts` and uses roles, labels and the
 * app's `osf-*` component tags instead.
 */

/** OSF API requests in flight per page, and when the last one started or ended. */
interface ApiTraffic {
  inFlight: Set<Request>;
  lastActivity: number;
}
const apiTraffic = new WeakMap<Page, ApiTraffic>();
const trackedContexts = new WeakSet<BrowserContext>();

function trafficOf(page: Page): ApiTraffic {
  let traffic = apiTraffic.get(page);
  if (!traffic) {
    traffic = { inFlight: new Set(), lastActivity: Date.now() };
    apiTraffic.set(page, traffic);
  }
  return traffic;
}

/** The page a request was made from, if any (not for service worker requests). */
function pageOf(request: Request): Page | null {
  try {
    return request.frame().page();
  } catch {
    return null;
  }
}

/**
 * Tracks the OSF API requests of every page in the page's browser context - so that
 * a tab the app opens (the moderator's view of a preprint) is tracked from its first
 * request, before the test gets hold of it.
 */
function trackApiTraffic(page: Page): void {
  const context = page.context();
  if (trackedContexts.has(context)) return;
  trackedContexts.add(context);
  const done = (request: Request) => {
    const requestPage = pageOf(request);
    if (!requestPage) return;
    const traffic = trafficOf(requestPage);
    if (traffic.inFlight.delete(request)) traffic.lastActivity = Date.now();
  };
  context.on('request', (request) => {
    const requestPage = pageOf(request);
    if (!requestPage || !request.url().startsWith(settings.API_DOMAIN)) return;
    const traffic = trafficOf(requestPage);
    traffic.inFlight.add(request);
    traffic.lastActivity = Date.now();
  });
  context.on('requestfinished', done);
  context.on('requestfailed', done);
}

/**
 * Waits until the page has had no OSF API request in flight for `quietMs`. The preprint
 * pages render their buttons first and then re-render them as their data arrives (the
 * detail page's review actions and withdrawal requests, the Review step's contributors
 * and subjects). A click landing on a button as it's replaced does nothing - seen on
 * Firefox, where Edit didn't open the edit page and Submit didn't submit.
 */
async function waitForApiIdle(page: Page, quietMs = 500): Promise<void> {
  if (!trackedContexts.has(page.context())) return;
  const traffic = trafficOf(page);
  await expect
    .poll(() => traffic.inFlight.size === 0 && Date.now() - traffic.lastActivity >= quietMs, {
      message: 'OSF API requests have settled',
      intervals: [100],
    })
    .toBe(true);
}

/** Short `/<guid>` URL of a preprint - the app redirects it to `/preprints/<provider>/<guid>`. */
export function preprintUrl(guid: string): string {
  return `${settings.OSF_HOME}/${guid}`;
}

/**
 * Reads a list of contributor names. Waits for the list first - it renders after the
 * page itself - and drops the ", " the app puts between names.
 */
export async function readContributorNames(names: Locator): Promise<string[]> {
  await expect(names.first()).toBeVisible();
  return (await names.allInnerTexts()).map((name) => name.trim().replace(/,$/, '').trim());
}

/** The guid at the end of a preprint detail/new-version URL, e.g. `abc12_v2`. */
export function guidFromUrl(url: string): string {
  return new URL(url).pathname.replace(/\/$/, '').split('/').pop() as string;
}

/**
 * Port of `BasePreprintPage.url` - a provider's preprint pages live on its custom
 * domain when it has one, under `/preprints/<id>/` otherwise, and the OSF provider's
 * directly under `/preprints/`.
 */
function providerUrl(provider: PreprintProvider | undefined, path: string): string {
  if (!provider || provider.id === 'osf') {
    return `${settings.OSF_HOME}/preprints/${path}`;
  }
  if (provider.domainRedirectEnabled) {
    return new URL(path, provider.domain).toString();
  }
  return `${settings.OSF_HOME}/preprints/${provider.id}/${path}`;
}

/**
 * Port of `PreprintLandingPage`. A branded provider's landing page shows the
 * provider's name as its heading - `BasePreprintPage.verify()` checked the same
 * branding through the old navbar title.
 */
export class PreprintLandingPage extends BasePage {
  constructor(
    page: Page,
    private readonly provider?: PreprintProvider
  ) {
    super(page);
  }

  get url(): string {
    return providerUrl(this.provider, '');
  }

  get identity(): Locator {
    const name = this.provider && this.provider.id !== 'osf' ? this.provider.name : 'Preprints';
    return this.page.getByRole('heading', { level: 1, name, exact: true });
  }

  get addPreprintButton(): Locator {
    return this.page.getByRole('button', { name: 'Add A Preprint', exact: true });
  }

  get searchInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Search Preprint...' });
  }
}

/** Port of `NewPreprintsProviderServicePage` - the "Select a preprint service" step. */
export class PreprintProviderSelectPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/preprints/select`;
  }

  get identity(): Locator {
    return this.page.getByRole('heading', { name: 'Select a preprint service', exact: true });
  }

  get nextButton(): Locator {
    return this.page.getByRole('button', { name: 'Next', exact: true });
  }

  /** Clicks the Select button on the given provider's card. */
  async selectProvider(providerName: string): Promise<void> {
    await this.page
      .locator('p-card')
      .filter({ has: this.page.getByRole('heading', { name: providerName, exact: true }) })
      .getByRole('button', { name: 'Select', exact: true })
      .click();
  }
}

/**
 * Port of `PreprintSubmitPage` / `PreprintEditPage` / `CreatePreprintVersion`. Adding a
 * preprint, editing one and creating a new version are now the same stepper with
 * different steps (and heading), so they share this class.
 */
export class PreprintSubmitPage extends BasePage {
  constructor(
    page: Page,
    private readonly provider?: PreprintProvider
  ) {
    super(page);
    trackApiTraffic(page);
  }

  protected get headingText(): string {
    return 'Add a preprint';
  }

  get url(): string {
    return providerUrl(this.provider, 'submit');
  }

  get identity(): Locator {
    return this.page.getByRole('heading', { level: 1, name: this.headingText, exact: true });
  }

  button(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  get nextButton(): Locator {
    return this.button('Next');
  }

  stepHeading(name: string): Locator {
    return this.page.getByRole('heading', { level: 2, name, exact: true });
  }

  /**
   * Clicks Next and waits for the next step's heading. The Review step's first
   * heading is "Consent To Publish" - its "Title and Abstract" summary heading would
   * also match the first step. Then waits for the step to load its data (see
   * `waitForApiIdle`) - the Review step's Submit does nothing if clicked before.
   */
  async goToNextStep(nextStepHeading: string): Promise<void> {
    await this.nextButton.click();
    await expect(this.stepHeading(nextStepHeading)).toBeVisible();
    await waitForApiIdle(this.page);
  }

  // Title and Abstract step

  get titleInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Title', exact: true });
  }

  get abstractInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Abstract', exact: true });
  }

  // File step

  /**
   * "Upload From Your Computer" + "Upload File". No file on disk is needed - the
   * file chooser takes the content directly.
   */
  async uploadFileFromComputer(fileName: string): Promise<void> {
    await this.button('Upload From Your Computer').click();
    const fileChooser = this.page.waitForEvent('filechooser');
    await this.button('Upload File').click();
    await (await fileChooser).setFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('OSF Playwright preprint test file'),
    });
    await expect(this.page.getByText(fileName, { exact: true })).toBeVisible();
  }

  get projectSelectInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Select Project' });
  }

  /** "Select From Existing OSF Project": pick the project, then the file in it. */
  async selectFileFromExistingProject(projectTitle: string, fileName: string): Promise<void> {
    await this.button('Select From Existing OSF Project').click();
    await this.projectSelectInput.click();
    await this.projectSelectInput.pressSequentially(projectTitle);
    await this.page.getByRole('option', { name: projectTitle, exact: true }).first().click();
    await this.button(fileName).click();
    await expect(this.page.getByText(fileName, { exact: true })).toBeVisible();
  }

  // Metadata step

  get contributorsTableRows(): Locator {
    return this.page.locator('osf-contributors-table').getByRole('row');
  }

  contributorRow(name: string): Locator {
    return this.contributorsTableRows.filter({
      has: this.page.getByRole('link', { name, exact: true }),
    });
  }

  /** Contributor names in the Metadata step's table, in table order. */
  getContributorTableNames(): Promise<string[]> {
    return readContributorNames(this.page.locator('osf-contributors-table tbody').getByRole('link'));
  }

  /** The PrimeNG reorderable-row drag handle (the bars icon in a row's first cell). */
  contributorDragHandle(row: Locator): Locator {
    return row.locator('.p-datatable-reorderable-row-handle');
  }

  async selectLicense(licenseName: string): Promise<void> {
    await this.page.locator('osf-license').getByRole('combobox').click();
    await this.page.getByRole('option', { name: licenseName, exact: true }).click();
  }

  private get subjectsSection(): Locator {
    return this.page.locator('osf-preprints-subjects');
  }

  /** Port of `select_top_level_subject` - ticks a top-level subject in the tree. */
  async selectTopLevelSubject(subjectName: string): Promise<void> {
    await this.subjectsSection
      .getByRole('treeitem', { name: subjectName, exact: true })
      .getByRole('checkbox')
      .first()
      .click();
  }

  /** A chip in the "selected subjects" list above the tree. */
  selectedSubject(subjectName: string): Locator {
    return this.subjectsSection.locator('p-chip').filter({ hasText: subjectName });
  }

  get tagsInput(): Locator {
    return this.page.locator('osf-tags-input').getByRole('textbox');
  }

  // Author Assertions step

  /** One of the Author Assertions cards (Conflict of Interest, Public Data, ...). */
  assertionCard(heading: string): Locator {
    return this.page
      .locator('p-card')
      .filter({ has: this.page.getByRole('heading', { name: heading, exact: true }) });
  }

  get conflictOfInterestYes(): Locator {
    return this.assertionCard('Conflict of Interest').getByRole('radio', { name: 'Yes', exact: true });
  }

  get conflictOfInterestInput(): Locator {
    return this.assertionCard('Conflict of Interest').getByRole('textbox');
  }

  get publicDataAvailable(): Locator {
    return this.assertionCard('Public Data').getByRole('radio', { name: 'Available', exact: true });
  }

  get publicDataInput(): Locator {
    return this.assertionCard('Public Data').getByRole('textbox', { name: 'Link to data' });
  }

  get preregistrationUnavailable(): Locator {
    return this.assertionCard('Public Preregistration').getByRole('radio', {
      name: 'Unavailable',
      exact: true,
    });
  }

  get preregistrationInput(): Locator {
    return this.assertionCard('Public Preregistration').getByRole('textbox');
  }

  // Review step

  /** Contributor names in the Review step's Contributors section. */
  getReviewContributorNames(): Promise<string[]> {
    return readContributorNames(
      this.page
        .locator('section:has(> h3)')
        .filter({ has: this.page.getByRole('heading', { name: 'Contributors', exact: true }) })
        .locator('osf-contributors-list [data-test-contributor-name]')
    );
  }
}

/** Port of `PreprintEditPage` - "Edit" and "Edit And Resubmit" on the detail page. */
export class PreprintEditPage extends PreprintSubmitPage {
  protected get headingText(): string {
    return 'Edit a preprint';
  }

  /**
   * The form renders empty and fills in the saved values once the preprint loads - a
   * title typed before that is overwritten, and the old title saved (seen on a new
   * version's edit page).
   */
  static async openLoaded(page: Page): Promise<PreprintEditPage> {
    const editPage = await PreprintEditPage.expectOn(page);
    await expect(editPage.titleInput).not.toHaveValue('');
    await waitForApiIdle(page);
    return editPage;
  }
}

/** The "Create New Version" stepper (File, Review) - was the `CreatePreprintVersion` modal. */
export class PreprintNewVersionPage extends PreprintSubmitPage {
  protected get headingText(): string {
    return 'Create New Version';
  }
}

/** Port of `EditPreprintContributors` / `AddUnregisteredUserModal` - one dialog, two views. */
export class AddContributorDialog {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('dialog', { name: /^Add (Registered|Unregistered) Contributor$/ });
  }

  get searchInput(): Locator {
    return this.root.getByRole('textbox', { name: 'Search by name or user information' });
  }

  button(name: string): Locator {
    return this.root.getByRole('button', { name, exact: true });
  }

  /** The checkbox next to a search result. */
  contributorCheckbox(name: string): Locator {
    return this.root
      .locator('.users-list > div')
      .filter({ has: this.page.getByRole('link', { name, exact: true }) })
      .getByRole('checkbox');
  }

  get fullNameInput(): Locator {
    return this.root.getByRole('textbox', { name: 'Full Name' });
  }

  get emailInput(): Locator {
    return this.root.getByRole('textbox', { name: 'Email' });
  }
}

/** Port of `PreprintWithdrawPage` - now a dialog on the detail page. */
export class PreprintWithdrawDialog {
  constructor(private readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('dialog', { name: 'Withdraw preprint' });
  }

  get reasonInput(): Locator {
    return this.root.getByRole('textbox', { name: 'Reason For Withdrawal' });
  }

  get withdrawButton(): Locator {
    return this.root.getByRole('button', { name: 'Withdraw', exact: true });
  }
}

/**
 * Port of `PreprintDetailPage` and `PendingPreprintDetailPage` - a moderator opens the
 * same detail page with `?mode=moderator`, which adds the Make Decision button.
 */
export class PreprintPage extends BasePage {
  constructor(
    page: Page,
    private readonly guid?: string
  ) {
    super(page);
    trackApiTraffic(page);
  }

  get url(): string | null {
    return this.guid ? preprintUrl(this.guid) : null;
  }

  get identity(): Locator {
    return this.page.locator('osf-preprint-details');
  }

  /** Also waits for the page to load its data - see `waitUntilLoaded`. */
  async verify(timeout: number = settings.TIMEOUT_MS): Promise<this> {
    await super.verify(timeout);
    await this.waitUntilLoaded();
    return this;
  }

  /**
   * Waits for the page's data to load (see `waitForApiIdle`). The moderator view's
   * decision dialog, for one, resets its options and text box when the withdrawal
   * request arrives - a comment typed before that is lost.
   */
  async waitUntilLoaded(): Promise<void> {
    await waitForApiIdle(this.page);
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

  get title(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  button(name: string): Locator {
    return this.page.getByRole('button', { name, exact: true });
  }

  get editButton(): Locator {
    return this.button('Edit');
  }

  get withdrawButton(): Locator {
    return this.button('Withdraw');
  }

  get createNewVersionButton(): Locator {
    return this.button('Create New Version');
  }

  get downloadButton(): Locator {
    return this.button('Download preprint');
  }

  /**
   * "Pending: ...", "Accepted: ...", "Rejected: ..." etc. under the title. The
   * moderator view shows its own banner component in the same place.
   */
  get statusBanner(): Locator {
    return this.page
      .locator('osf-preprint-status-banner, osf-moderation-status-banner')
      .getByRole('alert');
  }

  get withdrawnBanner(): Locator {
    return this.page.getByText('This preprint has been withdrawn.', { exact: true });
  }

  get withdrawReason(): Locator {
    return this.page.getByRole('heading', { name: 'Reason for withdrawal', exact: true });
  }

  /** A titled section of the page (Abstract, License, Subjects, ...). */
  section(heading: string): Locator {
    return this.page
      .locator('section:has(> h3)')
      .filter({ has: this.page.getByRole('heading', { name: heading, exact: true }) });
  }

  get abstract(): Locator {
    return this.section('Abstract');
  }

  get subjects(): Locator {
    return this.section('Subjects').locator('p-tag');
  }

  get licenseName(): Locator {
    return this.section('License').getByRole('button').first();
  }

  get publicationDate(): Locator {
    return this.section('Original Publication Date').locator('p');
  }

  /** The "OSF preprints are not peer reviewed..." warning on OSF-provider preprints. */
  get osfBanner(): Locator {
    return this.page.locator('osf-preprint-warning-banner');
  }

  private get fileSection(): Locator {
    return this.page.locator('osf-preprint-file-section');
  }

  get fileName(): Locator {
    return this.fileSection.locator('p').first();
  }

  get fileVersion(): Locator {
    return this.fileSection.locator('p').filter({ hasText: /^\s*Version:/ });
  }

  get submittedDate(): Locator {
    return this.fileSection.locator('span').filter({ hasText: /^\s*(Submitted|Created):/ });
  }

  get lastEditedDate(): Locator {
    return this.fileSection.locator('span').filter({ hasText: /^\s*Last edited\s*:/ });
  }

  /** The version picker in the DOI section ("Version: 2"). */
  get doiVersion(): Locator {
    return this.page.locator('osf-preprint-doi-section').getByRole('combobox');
  }

  /** Port of `get_preprint_versions` - opens the DOI section's version list and reads it. */
  async getPreprintVersions(): Promise<string[]> {
    await this.page
      .locator('osf-preprint-doi-section')
      .getByRole('button', { name: 'dropdown trigger' })
      .click();
    const options = this.page.getByRole('listbox').getByRole('option');
    await expect(options.first()).toBeVisible();
    const versions = await options.allInnerTexts();
    await this.page.keyboard.press('Escape');
    return versions.map((version) => version.trim());
  }

  private get metrics(): Locator {
    return this.page.locator('osf-preprint-metrics-info');
  }

  get viewsCount(): Locator {
    return this.metrics.getByText(/^Views:/);
  }

  get downloadsCount(): Locator {
    return this.metrics.getByText(/^Downloads:/);
  }

  /** Reads the number out of "Views: 12" / "Downloads: 3". */
  static async readCount(locator: Locator): Promise<number> {
    await expect(locator).toBeVisible();
    const text = await locator.innerText();
    return parseInt(text.replace(/^\D*/, ''), 10);
  }

  // Moderator view (`?mode=moderator`)

  get makeDecisionButton(): Locator {
    return this.button('Make Decision');
  }

  get decisionDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Submit your decision' });
  }

  /** A decision radio by its label start: Accept/Reject/Withdraw submission, Approve/Decline withdrawal. */
  decisionOption(label: string): Locator {
    return this.decisionDialog.getByRole('radio', { name: new RegExp(`^${label}`) });
  }

  /**
   * The decision's text box - its label depends on the decision ("Explain the
   * reasoning...", "Reason for withdrawal...", "Reason for denial..."), and there's
   * only ever one.
   */
  get decisionComment(): Locator {
    return this.decisionDialog.getByRole('textbox');
  }

  get submitDecisionButton(): Locator {
    return this.decisionDialog.getByRole('button', { name: 'Submit Decision', exact: true });
  }
}

/** Port of `PreprintDiscoverPage` - the preprints tab of the main search page. */
export class PreprintDiscoverPage extends SearchPage {
  get url(): string {
    return `${settings.OSF_HOME}/search?search=1&tab=5`;
  }
}

/**
 * Port of `BrandedPreprintsDiscoverPage` (`/preprints/<id>/discover`). It renders the
 * same search results component as `/search`, under the provider's heading.
 */
export class BrandedPreprintsDiscoverPage extends SearchPage {
  constructor(
    page: Page,
    private readonly provider: PreprintProvider,
    private readonly query = ''
  ) {
    super(page);
  }

  get url(): string {
    return providerUrl(this.provider, `discover${this.query}`);
  }

  get identity(): Locator {
    return this.page.getByRole('heading', { level: 1, name: this.provider.name, exact: true });
  }

  get resultTitleLinks(): Locator {
    return this.page.locator('osf-resource-card').getByRole('heading', { level: 2 }).getByRole('link');
  }

  get noResults(): Locator {
    return this.page.getByText('No results found.', { exact: true });
  }
}

/** Port of `ReviewsDashboardPage` - "My Reviewing" (`/preprints/my-reviewing`). */
export class ReviewsDashboardPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/preprints/my-reviewing`;
  }

  get identity(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'My Reviewing', exact: true });
  }

  /** Port of `click_provider_group_link(provider_name, 'Submissions')`. */
  submissionsButton(providerName: string): Locator {
    return this.page
      .locator('osf-my-reviewing-navigation')
      .filter({ has: this.page.getByRole('heading', { name: providerName, exact: true }) })
      .getByRole('button', { name: /^Submissions/ });
  }
}

/**
 * Port of `ReviewsSubmissionsPage` / `ReviewsWithdrawalsPage` - one moderation page
 * (`/preprints/<id>/moderation/...`) with Submissions and Withdrawal Request tabs.
 */
export class PreprintModerationPage extends BasePage {
  get identity(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'Moderation', exact: true });
  }

  get withdrawalRequestsTab(): Locator {
    return this.page.getByRole('tab', { name: 'Withdrawal Request', exact: true });
  }

  /** The "<N> Pending" filter button - selected by default. */
  get pendingFilter(): Locator {
    return this.page.getByRole('button', { name: /^\d+ Pending$/ });
  }

  /**
   * Opens the newest listed item with this title in the new tab the app opens for
   * it, and returns that tab. The list is sorted newest first, like in Python.
   */
  async openItem(title: string): Promise<Page> {
    const item = this.page.getByRole('button', { name: title, exact: true }).first();
    // So that `PreprintPage.waitUntilLoaded` sees the new tab's requests from the start.
    trackApiTraffic(this.page);
    return clickExpectingPopup(this.page, item);
  }
}

/** The sortable columns of the My Preprints table, by header text, and their API sort field. */
const MY_PREPRINTS_SORT_FIELDS = { Title: 'title', Modified: 'date_modified' } as const;

/**
 * Port of `MyPreprintsPage` (`/my-preprints`). Filtering, sorting and paging all reload
 * the table from `/v2/users/me/preprints/`, and the old rows stay up until the new ones
 * render - so every action here waits for its own request and then for the table to show
 * what it returned (`syncWithList`). The Python sort icons (`th[psortablecolumn] svg`)
 * were there in every sort state, so the column headers' `aria-sort` is checked instead.
 */
export class MyPreprintsPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/my-preprints`;
  }

  get identity(): Locator {
    return this.page.getByRole('heading', { level: 1, name: 'My Preprints', exact: true });
  }

  get addPreprintButton(): Locator {
    return this.page.getByRole('button', { name: 'Add a Preprint', exact: true });
  }

  get filterInput(): Locator {
    return this.page.getByPlaceholder('Filter by title, description, and tags');
  }

  /** The table's preprint rows - not the skeleton rows shown while it loads. */
  get rows(): Locator {
    return this.page
      .locator('osf-my-preprints tbody')
      .getByRole('row')
      .filter({ hasNot: this.page.locator('p-skeleton') });
  }

  get titleCells(): Locator {
    return this.rows.locator('td:first-child');
  }

  /** Port of `is_preprint_visible` - the rows whose title is exactly `title`. */
  rowWithTitle(title: string): Locator {
    return this.rows.filter({
      has: this.page.getByRole('cell', { name: title, exact: true }),
    });
  }

  columnHeader(name: keyof typeof MY_PREPRINTS_SORT_FIELDS): Locator {
    return this.page.getByRole('columnheader', { name, exact: true });
  }

  /** Waits for the table's first load. */
  async waitUntilLoaded(): Promise<void> {
    await expect(this.rows.first()).toBeVisible();
    await expect(this.filterInput).toBeVisible();
  }

  /**
   * Runs `action`, waits for the preprints list request it causes (the one whose query
   * matches `matches`), then until the table shows the titles the latest such request
   * returned. The response is read as it passes through a route: reading it afterwards
   * with `waitForResponse` failed once on Chromium ("No data found for resource"), the
   * body already discarded.
   */
  private async syncWithList(
    matches: (query: URLSearchParams) => boolean,
    action: () => Promise<void>
  ): Promise<void> {
    let titles: string[] | null = null;
    const isListRequest = (url: URL) =>
      url.pathname.endsWith('/v2/users/me/preprints/') && matches(url.searchParams);
    const captureTitles = async (route: Route) => {
      // This page route takes precedence over the context's QA-header route (see
      // src/fixtures), so the header has to be added here too.
      const response = await route.fetch({
        headers: { ...route.request().headers(), ...settings.QA_HEADERS },
      });
      const data = await response.json();
      titles = (data.data as any[]).map((preprint) => preprint.attributes.title);
      await route.fulfill({ response });
    };
    await this.page.route(isListRequest, captureTitles);
    try {
      await action();
      await expect(async () => {
        expect(titles, 'preprints list request answered').not.toBeNull();
        expect(await this.titleCells.allInnerTexts()).toEqual(titles);
      }).toPass({ timeout: settings.TIMEOUT_MS });
    } finally {
      await this.page.unroute(isListRequest, captureTitles);
    }
  }

  /** Types into the filter box; the table filters by title, description and tags. */
  async filterBy(text: string): Promise<void> {
    await this.syncWithList(
      (query) => query.get('filter[title,tags,description]') === text,
      () => this.filterInput.fill(text)
    );
  }

  /** Clicks a column header - the first click sorts ascending, the next descending. */
  async sortBy(column: keyof typeof MY_PREPRINTS_SORT_FIELDS): Promise<void> {
    const field = MY_PREPRINTS_SORT_FIELDS[column];
    await this.syncWithList(
      (query) => query.get('sort')?.replace(/^-/, '') === field,
      () => this.columnHeader(column).click()
    );
  }
}
