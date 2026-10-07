import { Page, Locator, expect, test } from '@playwright/test';

import * as settings from '../../config/settings';
import {
  ProjectSearchResults,
  RegistrationSearchResults,
  PreprintSearchResults,
  FileSearchResults,
  UserSearchResults,
} from '../pages/SearchPage';
import { FileDetailPage } from '../pages/FileDetailPage';
import { PreprintPage } from '../pages/PreprintPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { ProjectPage } from '../pages/ProjectPage';
import { UserProfilePage } from '../pages/UserProfilePage';
import { present, clickExpectingPopup, clickExpectingPopupByHref } from './index';

/**
 * Search-result card validators shared by specs that render the
 * `osf-search-results-container` component outside `/search` - port of
 * `tests/test_profile.py`'s `_validate_*_card` helpers, which
 * `tests/test_institutions.py` imports from there. Moved out of
 * `tests/profile.spec.ts` because importing one spec file from another would
 * register its tests twice. `verifyUserCard` is `tests/test_institutions.py`'s
 * inline `test_search_card_users` body (identical to `search.spec.ts`'s
 * `verifyUserSearchCard`).
 */

/** Port of the local `normalize_ui_date`/date-comparison approach `search.spec.ts` uses for its own card-validation helpers. */
export function normalizeUiDate(dateString: string): Date {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const simple = dateString.match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (simple) {
    const monthIndex = months.indexOf(simple[1]);
    if (monthIndex !== -1) {
      return new Date(Date.UTC(parseInt(simple[3], 10), monthIndex, parseInt(simple[2], 10)));
    }
  }

  // The Angular project-detail page ("Feb 17, 2026, 10:51 AM"-style) renders this
  // timestamp in whatever timezone the browser/OS is set to (verified live: on a
  // Europe/Kiev runner, an API `date_created` of 17:40 UTC displayed here as "8:40
  // PM", i.e. plain local-time rendering) - unlike the old React/Ember frontend the
  // Python suite this was ported from, which the prior version of this function
  // assumed was fixed to America/New_York and "corrected" back to UTC accordingly.
  // That correction applied a bogus offset on top of an already-local timestamp,
  // occasionally pushing the date across midnight and failing this comparison by
  // exactly one day depending on the runner's own timezone. Simply dropping the
  // time-of-day instead (rather than converting it) has the same failure mode near
  // the runner's local midnight: a project created shortly before local midnight
  // still renders as "today" here but as "yesterday" on the UTC-based card above.
  // The fix is to construct the date using the *local* Date constructor (matching
  // how the browser rendered it, since neither playwright.config nor the browser
  // context overrides timezoneId - the browser and this Node process share the
  // runner's system timezone) so it resolves to the correct UTC instant, then read
  // its UTC calendar day back off - putting it on equal footing with the "simple"
  // (already UTC) card date above.
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const withTime = dateString.match(/^([A-Za-z]+) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!withTime) {
    throw new Error(`Unrecognized date format: ${dateString}`);
  }
  const monthIndex = monthsShort.indexOf(withTime[1]);
  let hour = parseInt(withTime[4], 10) % 12;
  if (withTime[6] === 'PM') hour += 12;
  const minute = parseInt(withTime[5], 10);
  const year = parseInt(withTime[3], 10);
  const day = parseInt(withTime[2], 10);
  const localInstant = new Date(year, monthIndex, day, hour, minute);
  return new Date(
    Date.UTC(localInstant.getUTCFullYear(), localInstant.getUTCMonth(), localInstant.getUTCDate())
  );
}

export async function contributorNames(locator: Locator): Promise<string[]> {
  const texts = await locator.allInnerTexts();
  return texts.map((text) => text.trim().replace(/,$/, '').trim());
}

export async function verifyPreprintCard(page: Page, preprintPage: PreprintSearchResults): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await preprintPage.searchResults.count()).toBeGreaterThan(0);

  const preprintTitle = (await preprintPage.preprintTitle.innerText()).trim();
  const preprintHref = await preprintPage.preprintTitle.getAttribute('href');
  const searchDateTextFull = await preprintPage.dateCreated.innerText();
  const searchCardDate = searchDateTextFull.split('Date created:')[1].trim();

  const cardContributorNames = await contributorNames(preprintPage.preprintCardContributorLinks);
  const hasMoreContributors = await present(preprintPage.preprintCardContributorsMore);
  let moreCount = 0;
  if (hasMoreContributors) {
    const moreText = await preprintPage.preprintCardContributorsMore.innerText();
    const match = moreText.match(/\d+/);
    moreCount = match ? parseInt(match[0], 10) : 0;
  }

  const popup = await clickExpectingPopupByHref(page, preprintPage.preprintTitle, preprintHref);
  const preprintDetail = new PreprintPage(popup);

  await expect(preprintDetail.identity).toBeVisible();
  const preprintDetailTitle = (await preprintDetail.preprintTitle.innerText()).trim();

  // The file-section date is rendered synchronously alongside `identity` (already
  // awaited above), so a genuinely-absent field is decided immediately - use
  // `QUICK_TIMEOUT_MS`, not the default ~25s, to avoid an unnecessary long wait.
  const hasDateOnDetail = await present(preprintDetail.dateCreated, settings.QUICK_TIMEOUT_MS);
  let preprintDateCreated = '';
  if (hasDateOnDetail) {
    const preprintDateTextFull = await preprintDetail.dateCreated.innerText();
    preprintDateCreated = preprintDateTextFull.split('Created:')[1].trim();
  }

  await present(preprintDetail.allContributors, 15000);
  const detailContributorNames = await contributorNames(preprintDetail.allContributors);

  expect(preprintTitle).toBe(preprintDetailTitle);
  if (hasDateOnDetail) {
    expect(normalizeUiDate(searchCardDate).getTime()).toBe(
      normalizeUiDate(preprintDateCreated).getTime()
    );
  }

  const totalOnDetail = detailContributorNames.length;
  if (totalOnDetail === 0) {
    expect(cardContributorNames.length).toBe(0);
    expect(hasMoreContributors).toBe(false);
  } else if (totalOnDetail <= 4) {
    expect([...cardContributorNames].sort()).toEqual([...detailContributorNames].sort());
    expect(hasMoreContributors).toBe(false);
  } else {
    const detailNameSet = new Set(detailContributorNames);
    for (const name of cardContributorNames) {
      expect(detailNameSet.has(name)).toBe(true);
    }
    expect(hasMoreContributors).toBe(true);
    expect(moreCount).toBe(totalOnDetail - cardContributorNames.length);
  }
}

export async function verifyRegistrationCard(
  page: Page,
  registrationPage: RegistrationSearchResults
): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await registrationPage.searchResults.count()).toBeGreaterThan(0);

  const withdrawnBadge = page.locator('osf-resource-card:first-of-type p-tag', {
    hasText: 'Withdrawn',
  });
  if ((await withdrawnBadge.count()) > 0) {
    test.skip(true, 'Withdrawn Registration');
  }

  const cardContributorNames = await contributorNames(
    registrationPage.registrationCardContributorLinks
  );
  const hasMoreContributors = await present(registrationPage.registrationCardContributorsMore);
  let moreCount = 0;
  if (hasMoreContributors) {
    const moreText = await registrationPage.registrationCardContributorsMore.innerText();
    const match = moreText.match(/\d+/);
    moreCount = match ? parseInt(match[0], 10) : 0;
  }

  const searchCardTitle = await registrationPage.registrationTitle.innerText();
  const registrationHref = await registrationPage.registrationTitle.getAttribute('href');
  const dates = (await registrationPage.registrationDates.innerText()).split('|');
  const searchCardRegDate = dates[0].replace('Date registered:', '').trim();

  await registrationPage.secondaryMetadataDropdown.click();
  await expect(
    page.locator('osf-resource-card:first-of-type osf-registration-secondary-metadata')
  ).toContainText('URL');

  // Provider/Template aren't guaranteed on every registration (e.g. older
  // registrations predating the current template system) - guard them like
  // License/DOI below instead of assuming they're always there.
  const hasProviderOnCard = await present(registrationPage.registrationProvider, settings.QUICK_TIMEOUT_MS);
  let searchCardProvider = '';
  if (hasProviderOnCard) {
    searchCardProvider = (await registrationPage.registrationProvider.innerText())
      .split('Provider:')[1]
      .trim();
  }
  const hasTemplateOnCard = await present(registrationPage.registrationTemplate, settings.QUICK_TIMEOUT_MS);
  let searchCardTemplate = '';
  if (hasTemplateOnCard) {
    searchCardTemplate = (await registrationPage.registrationTemplate.innerText())
      .split('Registration Template:')[1]
      .trim();
  }
  const searchCardUrl = (await registrationPage.registrationUrl.innerText())
    .split('URL:')[1]
    .trim();

  const hasLicenseOnCard = await present(registrationPage.registrationLicense, settings.QUICK_TIMEOUT_MS);
  let searchCardLicense = '';
  if (hasLicenseOnCard) {
    searchCardLicense = (await registrationPage.registrationLicense.innerText())
      .split('License:')[1]
      .trim();
  }

  const hasDoiOnCard = await present(registrationPage.registrationDoi, settings.QUICK_TIMEOUT_MS);
  let searchCardDoi = '';
  if (hasDoiOnCard) {
    searchCardDoi = (await registrationPage.registrationDoi.innerText()).split('DOI:')[1].trim();
  }

  const popup = await clickExpectingPopupByHref(page, registrationPage.registrationTitle, registrationHref);
  await expect(popup.locator('osf-registration-blocks-data').first()).toBeVisible();
  await expect(popup.locator('h3:text-is("Registry") ~ p')).not.toHaveText('');

  const regDetail = new RegistrationPage(popup);
  const regTitle = await regDetail.title.innerText();
  const registeredDate = await regDetail.registeredDate.innerText();

  expect(searchCardTitle).toBe(regTitle);
  expect(normalizeUiDate(searchCardRegDate).getTime()).toBe(
    normalizeUiDate(registeredDate).getTime()
  );
  if (hasProviderOnCard) {
    await expect(regDetail.overviewRegistry).toHaveText(searchCardProvider);
  }
  if (hasTemplateOnCard) {
    await expect(regDetail.overviewRegistrationType).toHaveText(searchCardTemplate);
  }
  expect(popup.url()).toContain(searchCardUrl);
  if (hasLicenseOnCard) {
    await expect(regDetail.overviewLicense).toHaveText(searchCardLicense);
  }
  if (hasDoiOnCard) {
    const detailDoi = await regDetail.registrationDoi.innerText();
    expect(searchCardDoi).toContain(detailDoi);
  }

  await present(regDetail.allContributors, 15000);
  const detailContributorNames = await contributorNames(regDetail.allContributors);

  const totalOnDetail = detailContributorNames.length;
  if (totalOnDetail === 0) {
    expect(cardContributorNames.length).toBe(0);
    expect(hasMoreContributors).toBe(false);
  } else if (totalOnDetail <= 4) {
    expect([...cardContributorNames].sort()).toEqual([...detailContributorNames].sort());
    expect(hasMoreContributors).toBe(false);
  } else {
    const detailNameSet = new Set(detailContributorNames);
    for (const name of cardContributorNames) {
      expect(detailNameSet.has(name)).toBe(true);
    }
    expect(hasMoreContributors).toBe(true);
    expect(moreCount).toBe(totalOnDetail - cardContributorNames.length);
  }
}

export async function verifyProjectCard(page: Page, projectPage: ProjectSearchResults): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await projectPage.searchResults.count()).toBeGreaterThan(0);

  let isProjectComponent = true;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    isProjectComponent = (await projectPage.firstCardType.innerText()) === 'Project Component';
    if (!isProjectComponent) break;
    await page.reload();
    await expect(page.locator('osf-resource-card').first()).toBeVisible();
  }
  if (isProjectComponent) {
    test.skip(true, 'Project component skipped');
  }

  const projectTitle = await projectPage.projectTitle.innerText();
  const projectHref = await projectPage.projectTitle.getAttribute('href');
  const dates = (await projectPage.projectDates.innerText()).split('|');
  const searchCardDateCreated = dates[0].replace('Date created:', '').trim();

  await projectPage.secondaryMetadataDropdown.click();
  await expect(
    page.locator('osf-resource-card:first-of-type osf-project-secondary-metadata')
  ).toContainText('URL');

  // `settings.QUICK_TIMEOUT_MS` (not the default `present()` timeout) here: the
  // accordion's secondary-metadata block is already fully rendered synchronously by
  // the time we get here (the `toContainText('URL')` wait above already settled it),
  // so an absent field is decided immediately, not "not yet arrived". With the
  // default ~25s timeout, three sequential absent fields (a real card shape - see
  // the debug DOM dump in the session that found this) cost up to 75s and blow
  // through the suite's 60s per-test timeout before the popup-click assertion below
  // ever runs, surfacing as an opaque "context closed" failure on that unrelated line.
  const hasLicenseOnCard = await present(projectPage.projectLicense, settings.QUICK_TIMEOUT_MS);
  let searchCardLicense = '';
  if (hasLicenseOnCard) {
    searchCardLicense = (await projectPage.projectLicense.innerText()).split('License:')[1].trim();
  }

  const hasDoiOnCard = await present(projectPage.projectDoi, settings.QUICK_TIMEOUT_MS);
  let searchCardDoi = '';
  if (hasDoiOnCard) {
    searchCardDoi = (await projectPage.projectDoi.innerText()).split('DOI:')[1].trim();
  }

  const hasCollectionOnCard = await present(projectPage.projectCollection, settings.QUICK_TIMEOUT_MS);
  let searchCardCollection = '';
  if (hasCollectionOnCard) {
    searchCardCollection = (await projectPage.projectCollection.innerText())
      .split('Collection:')[1]
      .trim();
  }

  const popup = await clickExpectingPopupByHref(page, projectPage.projectTitle, projectHref);
  await expect(popup.locator('h1.flex.align-items-center')).toBeVisible();

  const projectDetail = new ProjectPage(popup);
  const projectDetailTitle = await projectDetail.title.innerText();
  const projectDetailDateCreated = await projectDetail.dateCreated.innerText();
  // `osf-resource-license` renders a `p-skeleton` placeholder while it fetches the
  // license name, then swaps it for the real `<div>` - verified live via
  // `tests/_debug_inspect.spec.ts` per CLAUDE.md. Reading `.innerText()` right away
  // (as this used to) can win the race against that swap and return "" instead of
  // the actual license name.
  await projectDetail.license
    .locator('p-skeleton')
    .waitFor({ state: 'detached', timeout: settings.TIMEOUT_MS })
    .catch(() => undefined);
  const projectDetailLicense = await projectDetail.license.innerText();

  await present(popup.locator('h3:text-is("Contributors") ~ div a'), 15000);

  expect(projectTitle).toBe(projectDetailTitle);
  expect(normalizeUiDate(searchCardDateCreated).getTime()).toBe(
    normalizeUiDate(projectDetailDateCreated).getTime()
  );
  if (hasLicenseOnCard) {
    expect(searchCardLicense).toBe(projectDetailLicense);
  } else {
    expect(projectDetailLicense).toBe('No License');
  }
  if (hasCollectionOnCard) {
    const projectDetailCollection = await projectDetail.collection.innerText();
    expect(projectDetailCollection).toContain(searchCardCollection);
  } else {
    await expect(projectDetail.collection).toContainText('No collections');
  }
  if (hasDoiOnCard) {
    const projectDetailDoi = await projectDetail.doi.innerText();
    expect(searchCardDoi).toContain(projectDetailDoi);
  }
}

export async function verifyFileCard(
  page: Page,
  filePage: FileSearchResults,
  chevronMenuFirstCard: Locator
): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await filePage.searchResults.count()).toBeGreaterThan(0);

  const searchCardTitle = (await filePage.fileTitle.innerText()).trim();
  const fileHref = await filePage.fileTitle.getAttribute('href');
  const fromHref = await filePage.fromProjectLink.getAttribute('href');
  const parentProjectGuid = (fromHref ?? '').replace(/\/+$/, '').split('/').pop() ?? '';

  await chevronMenuFirstCard.click();

  let searchCardFunder: string | null = null;
  if (await present(filePage.funderLink)) {
    searchCardFunder = (await filePage.funderLink.innerText()).trim();
  }

  const popup = await clickExpectingPopupByHref(page, filePage.fileTitle, fileHref);

  if (popup.url().includes('/preprints/')) {
    test.skip(true, 'File belongs to a preprint — navigates to preprint page, not file detail');
  }

  const fileDetailPage = new FileDetailPage(popup);
  const fileDetailTitle = (await fileDetailPage.fileTitle.innerText()).trim();
  expect(searchCardTitle).toBe(fileDetailTitle);

  const breadcrumbText = (await fileDetailPage.breadcrumbs.innerText()).toLowerCase();
  expect(breadcrumbText).toContain(parentProjectGuid);

  if (searchCardFunder) {
    const detailFunder = (await fileDetailPage.funder.innerText()).trim();
    expect(searchCardFunder).toBe(detailFunder);
  }
}

/** `cardSearchFilter[resourceType]` each profile tab sends to SHARE (verified live). */
const PROFILE_TAB_RESOURCE_TYPES: Record<string, string> = {
  Project: 'Project,ProjectComponent',
  Registration: 'Registration,RegistrationComponent',
  Preprint: 'Preprint',
};

/**
 * Opens a results tab on the user's profile and returns its result count. The profile
 * fires an All-tab `index-card-search` on load, and a tab clicked before that returns
 * can pick up the All response and total instead (seen: 5 and 7 read back for users
 * whose cards said 1 and 4). So it waits for the request carrying this tab's own
 * resource-type filter, then for every card on screen to have the tab's type badge,
 * and only then reads the count.
 */
async function profileTabResultCount(
  popup: Page,
  profilePage: UserProfilePage,
  tab: Locator,
  expectedType: string
): Promise<number> {
  const resourceTypes = PROFILE_TAB_RESOURCE_TYPES[expectedType];
  const response = popup.waitForResponse(
    (res) =>
      res.url().includes('index-card-search') &&
      new URL(res.url()).searchParams.get('cardSearchFilter[resourceType]') === resourceTypes
  );
  await tab.click();
  await response;
  await expect(
    popup.locator('p.type.py-1.px-3.font-bold').filter({ hasNotText: expectedType })
  ).toHaveCount(0);
  return parseInt((await profilePage.resultCount.innerText()).trim().split(' ')[0], 10);
}

export async function verifyUserCard(page: Page, userSearchPage: UserSearchResults): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await userSearchPage.searchResults.count()).toBeGreaterThan(0);

  const searchCardName = (await userSearchPage.userName.innerText()).trim();
  const hasOrcid = await present(userSearchPage.orcidBadge);

  await userSearchPage.secondaryMetadataDropdown.click();
  await expect(
    page.locator('osf-resource-card:first-of-type osf-user-secondary-metadata')
  ).toContainText('Public projects');

  const publicProjects = parseInt(
    (await userSearchPage.userPublicProjects.innerText()).split(':')[1].trim(),
    10
  );
  const publicRegistrations = parseInt(
    (await userSearchPage.userPublicRegistrations.innerText()).split(':')[1].trim(),
    10
  );
  const publicPreprints = parseInt(
    (await userSearchPage.userPublicPreprints.innerText()).split(':')[1].trim(),
    10
  );

  const popup = await clickExpectingPopup(page, userSearchPage.userName);
  const profilePage = new UserProfilePage(popup);
  await expect(profilePage.identity).toBeVisible();

  const profileName = (await profilePage.profileName.innerText()).trim();
  expect(searchCardName).toBe(profileName);
  if (hasOrcid) {
    expect(await present(profilePage.orcidLink)).toBe(true);
  }

  // Withdrawn/spam items are counted on the card but not on the profile, so a tab
  // can legitimately show fewer - even zero - results than the card says.
  if (publicProjects > 0) {
    const profileProjects = await profileTabResultCount(popup, profilePage, profilePage.projectsTab, 'Project');
    expect(publicProjects).toBeGreaterThanOrEqual(profileProjects);
  }
  if (publicRegistrations > 0) {
    const profileRegistrations = await profileTabResultCount(
      popup,
      profilePage,
      profilePage.registrationsTab,
      'Registration'
    );
    expect(publicRegistrations).toBeGreaterThanOrEqual(profileRegistrations);
  }
  if (publicPreprints > 0) {
    const profilePreprints = await profileTabResultCount(popup, profilePage, profilePage.preprintsTab, 'Preprint');
    expect(publicPreprints).toBeGreaterThanOrEqual(profilePreprints);
  }
}
