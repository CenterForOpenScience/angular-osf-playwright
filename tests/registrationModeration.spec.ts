import * as settings from '../config/settings';
import { test, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { ModeratorDashboardPage, ModeratorSettingsPage } from '../src/pages/RegistriesPage';
import { SettingsNotificationsPage } from '../src/pages/UserPages';



const MODERATOR_USER = 'OSF Runscope Write';
const DEFAULT_SORT = 'Date: newest to oldest';


const titleCollator = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true, numeric: false });

/** Port of `verify_title_sorting`. */
function expectTitlesSorted(titles: string[], ascending = true): void {
  const expected = [...titles].sort((a, b) => {
    const order = titleCollator.compare(a, b);
    return ascending ? order : -order;
  });
  expect(titles, 'Title sorting failed').toEqual(expected);
}

/**
 * Cards show relative dates, read as an age in days: newest to oldest is ascending age,
 * oldest to newest is descending age.
 */
function expectDatesSorted(ages: number[], newestFirst: boolean): void {
  // Cards without a date are skipped, so an empty list would pass without checking anything.
  expect(ages.length, 'No submission card showed a readable date').toBeGreaterThan(0);
  const expected = [...ages].sort((a, b) => (newestFirst ? a - b : b - a));
  expect(ages, 'Date sorting failed').toEqual(expected);
}

type SortCheck = 'Title: A-Z' | 'Title: Z-A' | 'Date: newest to oldest' | 'Date: oldest to newest';

interface SortingCase {
  name: string;
  tab: 'Pending' | 'Submitted';
  /** Toggles clicked in order, as in the Python test (the tab's default toggle is never clicked). */
  toggles: string[];
  sort: SortCheck;
  emptyMessage: string;
}

async function checkSorting(dashboard: ModeratorDashboardPage, sortingCase: SortingCase): Promise<void> {
  await dashboard.selectTab(sortingCase.tab);
  for (const toggle of sortingCase.toggles) {
    await dashboard.selectToggle(toggle);
  }
  await expect(dashboard.selectedSortingOption).toHaveText(DEFAULT_SORT);

  // Python printed this message and passed; a skip shows the test checked nothing.
  test.skip(!(await dashboard.resultsExist()), sortingCase.emptyMessage);

  await dashboard.selectSortingOption(sortingCase.sort);
  switch (sortingCase.sort) {
    case 'Title: A-Z':
      expectTitlesSorted(await dashboard.getAllTitles());
      break;
    case 'Title: Z-A':
      expectTitlesSorted(await dashboard.getAllTitles(), false);
      break;
    case 'Date: newest to oldest':
      expectDatesSorted(await dashboard.getAllDates(), true);
      break;
    case 'Date: oldest to newest':
      expectDatesSorted(await dashboard.getAllDates(), false);
      break;
  }
}

function sortingCases(
  prefix: string,
  tab: SortingCase['tab'],
  toggles: string[],
  emptyMessage: string,
  names: [string, string, string, string] = [
    `${prefix} sort name a to z`,
    `${prefix} sort name z to a`,
    `${prefix} sort date newest to oldest`,
    `${prefix} sort date oldest to newest`,
  ],
  togglesPerCase: string[][] = [toggles, toggles, toggles, toggles]
): SortingCase[] {
  const sorts: SortCheck[] = ['Title: A-Z', 'Title: Z-A', 'Date: newest to oldest', 'Date: oldest to newest'];
  return sorts.map((sort, i) => ({ name: names[i], tab, toggles: togglesPerCase[i], sort, emptyMessage }));
}

const PENDING_CASES: SortingCase[] = [
  ...sortingCases('pending tab', 'Pending', [], 'No pending submissions were found.'),
  ...sortingCases('pending updates tab', 'Pending', ['Pending Updates'], 'No pending updates were found.', [
    'pending updates tab sort name a to z',
    'pending updates tab sort name z to a',
    'pending updates tab sort date newest to oldest',
    'pending updates sort date oldest to newest',
  ]),
  ...sortingCases(
    'pending withdrawal tab',
    'Pending',
    ['Pending Withdrawal'],
    'No pending withdrawals were found.',
    [
      'pending withdrawal tab sort name a to z',
      'pending withdrawal tab sort name z to a',
      'pending withdrawal tab sort date newest to oldest',
      'pending withdrawal sort date oldest to newest',
    ],
    // Python's a-to-z test clicks Pending Updates before Pending Withdrawal; the others don't.
    [['Pending Updates', 'Pending Withdrawal'], ['Pending Withdrawal'], ['Pending Withdrawal'], ['Pending Withdrawal']]
  ),
];

const SUBMITTED_CASES: SortingCase[] = [
  ...sortingCases('submitted tab', 'Submitted', [], 'No public submissions were found.'),
  ...sortingCases('submitted embargo tab', 'Submitted', ['Embargo'], 'No embargoed submissions were found.'),
  ...sortingCases('submitted rejected tab', 'Submitted', ['Rejected'], 'No rejected submissions were found.'),
  ...sortingCases('submitted withdrawn tab', 'Submitted', ['Withdrawn'], 'No withdrawn submissions were found.'),
];

test.describe('Registration Moderation', { tag: '@core' }, () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  // Port of `TestRegistrationModeration`. Add -> edit -> remove share one moderator, so
  // they run in order on one worker (a failure doesn't skip the rest, as in pytest).
  test.describe('Moderators', () => {
    test.describe.configure({ mode: 'default' });

    test.beforeEach(async ({ mustBeLoggedInAsAdminUser }) => {
      void mustBeLoggedInAsAdminUser;
    });

    test('add moderator', async ({ page, session }) => {
      const userId = await osfApi.getUserGuid(session, MODERATOR_USER);
      expect(userId, `User '${MODERATOR_USER}' not found`).toBeTruthy();
      const dashboard = await new ModeratorDashboardPage(page).open();
      await dashboard.selectTab('Moderators');

      await dashboard.addModeratorButton.click();
      const modal = dashboard.addModeratorModal;
      await modal.searchInput.fill(MODERATOR_USER);
      await modal.userCheckbox(userId!).check();
      await dashboard.waitForModerators(() => modal.button('Add').click(), 'POST');
      await expect(modal.root).toBeHidden();

      // Verify that user is added successfully and available in the list
      await dashboard.searchModerators(MODERATOR_USER);
      await expect(dashboard.moderatorName(MODERATOR_USER)).toHaveText(MODERATOR_USER);
    });

    test('edit moderator permission', async ({ page }) => {
      const moderatorPermission = 'Administrator';
      const dashboard = await new ModeratorDashboardPage(page).open();
      await dashboard.selectTab('Moderators');

      await dashboard.searchModerators(MODERATOR_USER);
      const permission = dashboard.moderatorPermission(MODERATOR_USER);
      const originalPermission = (await permission.innerText()).trim();
      // Checked before the change: re-picking the current value sends no PATCH to wait for.
      expect(originalPermission).not.toBe(moderatorPermission);
      await dashboard.selectModeratorPermission(MODERATOR_USER, moderatorPermission);
      await expect(permission).toHaveText(moderatorPermission);
    });

    test('remove moderator', async ({ page }) => {
      const dashboard = await new ModeratorDashboardPage(page).open();
      await dashboard.selectTab('Moderators');

      await dashboard.searchModerators(MODERATOR_USER);
      await dashboard.removeModeratorButton(MODERATOR_USER).click();
      await dashboard.waitForModerators(() => dashboard.removeModeratorModal.button('Remove').click(), 'DELETE');

      // Verify user is not in the moderators list
      await dashboard.searchModerators(MODERATOR_USER);
      await expect(dashboard.noResultsMessage).toBeVisible();
    });
  });

  // Ports of `TestRegistrationModerationPendingTabSorting` and
  // `TestRegistrationModerationSubmittedTabSorting`.
  for (const [describeName, cases] of [
    ['Pending tab sorting', PENDING_CASES],
    ['Submitted tab sorting', SUBMITTED_CASES],
  ] as const) {
    test.describe(describeName, () => {
      test.beforeEach(async ({ mustBeLoggedIn }) => {
        void mustBeLoggedIn;
      });

      for (const sortingCase of cases) {
        test(sortingCase.name, async ({ page }) => {
          const dashboard = await new ModeratorDashboardPage(page).open();
          await checkSorting(dashboard, sortingCase);
        });
      }
    });
  }

  // Port of `TestRegistrationModeratorNotifications`. Each test asserts the dropdown
  // isn't already at its value, so they rely on running in order (Daily -> Never -> Instant).
  test.describe('Moderator notifications', () => {
    test.describe.configure({ mode: 'default' });

    test.beforeEach(async ({ mustBeLoggedInAsUserTwo }) => {
      void mustBeLoggedInAsUserTwo;
    });

    const cases = [
      ['new pending submission notification', 'newPendingSubmissionNotificationFreq', 'selectFromPendingSubmissionsDropdown'],
      ['withdraw requests notification', 'newPendingWithdrawRequestsNotificationFreq', 'selectFromWithdrawRequestsDropdown'],
    ] as const;

    for (const [name, dropdown, select] of cases) {
      for (const frequency of ['Daily', 'Never', 'Instant']) {
        test(`${name} ${frequency.toLowerCase()}`, async ({ page }) => {
          const settingsPage = await new ModeratorSettingsPage(page).open();
          const freq = settingsPage[dropdown];
          await expect(freq).not.toHaveText(/^\s*$/);
          const initialFrequency = (await freq.innerText()).trim();
          expect(initialFrequency).not.toBe(frequency);

          await settingsPage[select](frequency);
          await expect(freq).toHaveText(frequency);
        });
      }
    }

    test('user settings link', async ({ page }) => {
      const settingsPage = await new ModeratorSettingsPage(page).open();
      await settingsPage.userSettingsLink.click();

      await expect(page).toHaveURL(/\/settings\/notifications/);
      const notificationsPage = new SettingsNotificationsPage(page);
      await expect(notificationsPage.notificationsSection).toBeVisible();
    });
  });
});
