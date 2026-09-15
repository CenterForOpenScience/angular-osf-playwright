import { Page, Locator } from '@playwright/test';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import { SearchPage, ProjectSearchResults, RegistrationSearchResults, PreprintSearchResults, FileSearchResults } from '../src/pages/SearchPage';
import { ProfilePage } from '../src/pages/ProfilePage';
import { FileDetailPage } from '../src/pages/FileDetailPage';
import { PreprintPage } from '../src/pages/PreprintPage';
import { RegistrationPage } from '../src/pages/RegistrationPage';
import { ProjectPage } from '../src/pages/ProjectPage';
import * as osfApi from '../src/api/osfApi';
import { present, clickExpectingPopup } from '../src/utils';

/**
 * Port of `tests/test_profile.py`. The profile page's tabs/filters/results
 * (`osf-search-results-container`) are the exact same Angular component the main
 * search page renders, so `ProfilePage` (`src/pages/ProfilePage.ts`) extends
 * `SearchPage` and this spec drives it through the same `checkFilteringBy*` /
 * `checkSortingBy*` / `checkSearchInFilteringOptions` helpers `tests/search.spec.ts`
 * uses - see that file and `PLAYWRIGHT_MIGRATION_RULES.md` for the shared
 * conventions. The Social/Name/Employment/Education editing tests at the bottom
 * (`pages/profile.py`'s own `ProfilePage`) are unrelated to those tabs and use
 * `ProfilePage`'s own locators/methods instead.
 */

const test = base.extend<{
  profilePageShort: ProfilePage;
  ownProfilePageShort: ProfilePage;
}>({
  profilePageShort: async ({ page, mustBeLoggedInAsProfileUser }, use) => {
    void mustBeLoggedInAsProfileUser;
    await use(await new ProfilePage(page).gotoShort());
  },
  ownProfilePageShort: async ({ page, mustBeLoggedIn }, use) => {
    void mustBeLoggedIn;
    await use(await new ProfilePage(page).gotoShort());
  },
});

/** Port of the local `normalize_ui_date`/date-comparison approach `search.spec.ts` uses for its own card-validation helpers. */
function normalizeUiDate(dateString: string): Date {
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

  const asUtcGuess = Date.UTC(year, monthIndex, day, hour, minute);
  const guess = new Date(asUtcGuess);
  const nyString = guess.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const utcString = guess.toLocaleString('en-US', { timeZone: 'UTC' });
  const offset = new Date(utcString).getTime() - new Date(nyString).getTime();
  const converted = new Date(asUtcGuess + offset);
  return new Date(Date.UTC(converted.getUTCFullYear(), converted.getUTCMonth(), converted.getUTCDate()));
}

/** Port of `utils.extract_ui_date` - the profile page's "Date joined"-style text uses abbreviated month names ("Aug 12, 2024"), unlike the search-card dates above. Returns an ISO `YYYY-MM-DD` string. */
function extractUiDate(text: string): string {
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const match = text.match(/([A-Za-z]+) (\d{1,2}), (\d{4})/);
  if (!match) {
    throw new Error(`No date found in UI text: ${text}`);
  }
  const monthIndex = monthsShort.indexOf(match[1]);
  if (monthIndex === -1) {
    throw new Error(`Unrecognized month: ${match[1]}`);
  }
  const month = String(monthIndex + 1).padStart(2, '0');
  const day = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

async function contributorNames(locator: Locator): Promise<string[]> {
  const texts = await locator.allInnerTexts();
  return texts.map((text) => text.trim().replace(/,$/, '').trim());
}

async function checkSearchInFilteringOptionsFor(
  profilePage: ProfilePage,
  menu: Locator,
  dropdown: Locator,
  recordIndex = '1'
): Promise<void> {
  await menu.click();
  await dropdown.click();
  await profilePage.checkSearchInFilteringOptions(recordIndex);
}

// ---------------------------------------------------------------------------
// Port of `_validate_preprint_card` / `_validate_registration_card` /
// `_validate_project_card` / `_validate_file_card` - these mirror
// `search.spec.ts`'s own `verify*SearchCard` helpers almost exactly (the Python
// source duplicates them the same way rather than sharing between the two test
// modules), applied to whichever tab is already open on the profile page instead
// of a freshly-navigated `/search` page.
// ---------------------------------------------------------------------------

async function verifyPreprintCard(page: Page, preprintPage: PreprintSearchResults): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await preprintPage.searchResults.count()).toBeGreaterThan(0);

  const preprintTitle = (await preprintPage.preprintTitle.innerText()).trim();
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

  const popup = await clickExpectingPopup(page, preprintPage.preprintTitle);
  const preprintDetail = new PreprintPage(popup);

  await expect(preprintDetail.identity).toBeVisible();
  const preprintDetailTitle = (await preprintDetail.preprintTitle.innerText()).trim();

  const hasDateOnDetail = await present(preprintDetail.dateCreated);
  let preprintDateCreated = '';
  if (hasDateOnDetail) {
    const preprintDateTextFull = await preprintDetail.dateCreated.innerText();
    preprintDateCreated = preprintDateTextFull.split('Submitted:')[1].trim();
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

async function verifyRegistrationCard(
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
  const dates = (await registrationPage.registrationDates.innerText()).split('|');
  const searchCardRegDate = dates[0].replace('Date registered:', '').trim();

  await registrationPage.secondaryMetadataDropdown.click();
  await expect(
    page.locator('osf-resource-card:first-of-type osf-registration-secondary-metadata')
  ).toContainText('URL');

  const searchCardProvider = (await registrationPage.registrationProvider.innerText())
    .split('Provider:')[1]
    .trim();
  const searchCardTemplate = (await registrationPage.registrationTemplate.innerText())
    .split('Registration Template:')[1]
    .trim();
  const searchCardUrl = (await registrationPage.registrationUrl.innerText())
    .split('URL:')[1]
    .trim();

  const hasLicenseOnCard = await present(registrationPage.registrationLicense);
  let searchCardLicense = '';
  if (hasLicenseOnCard) {
    searchCardLicense = (await registrationPage.registrationLicense.innerText())
      .split('License:')[1]
      .trim();
  }

  const hasDoiOnCard = await present(registrationPage.registrationDoi);
  let searchCardDoi = '';
  if (hasDoiOnCard) {
    searchCardDoi = (await registrationPage.registrationDoi.innerText()).split('DOI:')[1].trim();
  }

  const popup = await clickExpectingPopup(page, registrationPage.registrationTitle);
  await expect(popup.locator('osf-registration-blocks-data').first()).toBeVisible();
  await expect(popup.locator('h3:text-is("Registry") ~ p')).not.toHaveText('');

  const regDetail = new RegistrationPage(popup);
  const regTitle = await regDetail.title.innerText();
  const registeredDate = await regDetail.registeredDate.innerText();

  expect(searchCardTitle).toBe(regTitle);
  expect(normalizeUiDate(searchCardRegDate).getTime()).toBe(
    normalizeUiDate(registeredDate).getTime()
  );
  await expect(regDetail.overviewRegistry).toHaveText(searchCardProvider);
  await expect(regDetail.overviewRegistrationType).toHaveText(searchCardTemplate);
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

async function verifyProjectCard(page: Page, projectPage: ProjectSearchResults): Promise<void> {
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
  const dates = (await projectPage.projectDates.innerText()).split('|');
  const searchCardDateCreated = dates[0].replace('Date created:', '').trim();

  await projectPage.secondaryMetadataDropdown.click();
  await expect(
    page.locator('osf-resource-card:first-of-type osf-project-secondary-metadata')
  ).toContainText('URL');

  const hasLicenseOnCard = await present(projectPage.projectLicense);
  let searchCardLicense = '';
  if (hasLicenseOnCard) {
    searchCardLicense = (await projectPage.projectLicense.innerText()).split('License:')[1].trim();
  }

  const hasDoiOnCard = await present(projectPage.projectDoi);
  let searchCardDoi = '';
  if (hasDoiOnCard) {
    searchCardDoi = (await projectPage.projectDoi.innerText()).split('DOI:')[1].trim();
  }

  const hasCollectionOnCard = await present(projectPage.projectCollection);
  let searchCardCollection = '';
  if (hasCollectionOnCard) {
    searchCardCollection = (await projectPage.projectCollection.innerText())
      .split('Collection:')[1]
      .trim();
  }

  const popup = await clickExpectingPopup(page, projectPage.projectTitle);
  await expect(popup.locator('h1.flex.align-items-center')).toBeVisible();

  const projectDetail = new ProjectPage(popup);
  const projectDetailTitle = await projectDetail.title.innerText();
  const projectDetailDateCreated = await projectDetail.dateCreated.innerText();
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

async function verifyFileCard(
  page: Page,
  filePage: FileSearchResults,
  chevronMenuFirstCard: Locator
): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await filePage.searchResults.count()).toBeGreaterThan(0);

  const searchCardTitle = (await filePage.fileTitle.innerText()).trim();
  const fromHref = await filePage.fromProjectLink.getAttribute('href');
  const parentProjectGuid = (fromHref ?? '').replace(/\/+$/, '').split('/').pop() ?? '';

  await chevronMenuFirstCard.click();

  let searchCardFunder: string | null = null;
  if (await present(filePage.funderLink)) {
    searchCardFunder = (await filePage.funderLink.innerText()).trim();
  }

  const popup = await clickExpectingPopup(page, filePage.fileTitle);

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

// -------------------------------------------------------------------------------
// TestProfilePageProjectsTab (22 tests, 2 skipped ENG-10778)
// -------------------------------------------------------------------------------

test.describe('Profile Page Projects Tab', () => {
  test('filtering by creator on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByCreator('1');
  });

  test('filtering by date created on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByDateCreated('Date created');
  });

  test('filtering by institution on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByInstitution('1');
  });

  test('filtering by subject on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringBySubject('1');
  });

  test('filtering by license on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByLicense();
  });

  test('filtering by funder on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByFunder();
  });

  test('filtering by part of collection on projects tab', async ({ profilePageShort }) => {
    test.skip(true, 'ENG-10778');
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByPartOfCollection();
  });

  test('filtering by community schema on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByIncludesCommunitySchema();
  });

  test('filtering by additional option on projects tab', async ({ profilePageShort }) => {
    test.skip(true, 'ENG-10778');
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByAdditionalOptions('', '', '');
  });

  test('filtering by resource type on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkFilteringByResourceType('', 'Book');
  });

  test('clearing of applied filters on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkSortingByCreatedDate('created');
  });

  test('sorting by modified date on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await profilePageShort.checkSortingByModifiedDate();
  });

  test('search in filtering by creator on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.creatorDropdownMenu,
      profilePageShort.additionalMultiselectDropdown
    );
  });

  test('search in filtering by date created on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.dateCreatedMenu,
      profilePageShort.dateCreatedMultiselectDropdown
    );
  });

  test('search in filtering by institution on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.institutionMenu,
      profilePageShort.institutionMultiselectDropdown
    );
  });

  test('search in filtering by funder on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.funderMenu,
      profilePageShort.funderMultiselectDropdown
    );
  });

  test('search in filtering by subject on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.subjectMenu,
      profilePageShort.subjectMultiselectDropdown
    );
  });

  test('search in filtering by license on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.licenseMenu,
      profilePageShort.licenseMultiselectDropdown
    );
  });

  test('search in filtering by resource type on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.resourceTypeMenu,
      profilePageShort.resourceTypeMultiselectDropdown
    );
  });

  test('search in filtering by part of collection on projects tab', async ({ profilePageShort }) => {
    test.skip(true, 'ENG-10778');
    await profilePageShort.projectsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.partOfCollectionMenu,
      profilePageShort.partOfCollectionMultiselectDropdown
    );
  });

  test('search card projects', async ({ page, profilePageShort }) => {
    await profilePageShort.projectsTabLink.click();
    await verifyProjectCard(page, new ProjectSearchResults(page));
  });
});

// -------------------------------------------------------------------------------
// TestProfilePageAllTab (23 tests, 2 skipped ENG-10778)
// -------------------------------------------------------------------------------

test.describe('Profile Page All Tab', () => {
  test('filtering by creator on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringByCreator('1');
  });

  test('filtering by date created on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringByDateCreated('Date');
  });

  test('filtering by institution on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringByInstitution('1');
  });

  test('filtering by subject on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringBySubject('1');
  });

  test('filtering by license on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringByLicense();
  });

  test('filtering by funder on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringByFunder();
  });

  test('filtering by provider on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringByProvider('2');
  });

  test('filtering by additional option on all tab', async ({ profilePageShort }) => {
    test.skip(true, 'ENG-10778');
    await profilePageShort.checkFilteringByAdditionalOptions('', '', '');
  });

  test('filtering by part of collection on all tab', async ({ profilePageShort }) => {
    test.skip(true, 'ENG-10778');
    await profilePageShort.checkFilteringByPartOfCollection();
  });

  test('filtering by resource type on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkFilteringByResourceType('', 'Registration');
  });

  test('clearing of applied filters on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkSortingByCreatedDate('created');
  });

  test('sorting by modified date on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkSortingByModifiedDate();
  });

  test('search in filtering by creator on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.creatorDropdownMenu,
      profilePageShort.additionalMultiselectDropdown
    );
  });

  test('search in filtering by date created on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.dateCreatedMenu,
      profilePageShort.dateCreatedMultiselectDropdown
    );
  });

  test('search in filtering by institution on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.institutionMenu,
      profilePageShort.institutionMultiselectDropdown
    );
  });

  test('search in filtering by funder on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.funderMenu,
      profilePageShort.funderMultiselectDropdown
    );
  });

  test('search in filtering by subject on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.subjectMenu,
      profilePageShort.subjectMultiselectDropdown
    );
  });

  test('search in filtering by license on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.licenseMenu,
      profilePageShort.licenseMultiselectDropdown
    );
  });

  test('search in filtering by resource type on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.resourceTypeMenu,
      profilePageShort.resourceTypeMultiselectDropdown
    );
  });

  test('search in filtering by provider on all tab', async ({ profilePageShort }) => {
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.providerMenu,
      profilePageShort.providerMultiselectDropdown,
      '2'
    );
  });

  test('search in filtering by part of collection on all tab', async ({ profilePageShort }) => {
    test.skip(true, 'ENG-10778');
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.partOfCollectionMenu,
      profilePageShort.partOfCollectionMultiselectDropdown
    );
  });

  test('search card all', async ({ page, profilePageShort }) => {
    await expect(page.locator('osf-resource-card').first()).toBeVisible();
    expect(await profilePageShort.searchResults.count()).toBeGreaterThan(0);

    let resultType = (await profilePageShort.nodeType.innerText()).trim();
    const knownTypes = ['Project', 'Registration', 'Preprint', 'File'];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (knownTypes.includes(resultType)) break;
      if (attempt < 2) {
        await page.reload();
        await expect(page.locator('osf-resource-card').first()).toBeVisible();
        resultType = (await profilePageShort.nodeType.innerText()).trim();
      } else {
        throw new Error(`Unknown search result type: ${resultType}`);
      }
    }

    switch (resultType) {
      case 'Project':
        await verifyProjectCard(page, new ProjectSearchResults(page));
        break;
      case 'Registration':
        await verifyRegistrationCard(page, new RegistrationSearchResults(page));
        break;
      case 'Preprint':
        await verifyPreprintCard(page, new PreprintSearchResults(page));
        break;
      case 'File':
        await verifyFileCard(page, new FileSearchResults(page), profilePageShort.chevronMenuFirstCard);
        break;
      default:
        throw new Error(`Unknown search result type: ${resultType}`);
    }
  });
});

// -------------------------------------------------------------------------------
// TestProfilePageRegistrationsTab (29 tests)
// -------------------------------------------------------------------------------

test.describe('Profile Page Registrations Tab', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('filtering by creator on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByCreator();
  });

  test('filtering by date created on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByDateCreated('Date registered');
  });

  test('filtering by subject on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringBySubject('1');
  });

  test('filtering by license on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByLicense();
  });

  test('filtering by institution on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByInstitution('1');
  });

  test('filtering by provider on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByProvider();
  });

  test('filtering by funder on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByFunder();
  });

  test('filtering by resource type on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByResourceType('', 'Registration');
  });

  test('filtering by data on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByData('i[class*="custom-icon-data"]');
  });

  test('filtering by registration template on registrations tab', async ({
    page,
    profilePageShort,
  }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.registrationTemplateMenu.click();
    await profilePageShort.registrationTemplateMultiselectDropdown.click();
    const nameOfRecord = await profilePageShort.getRecordName('1');
    const numberOfRecords = await profilePageShort.getRecordCount('1');
    await profilePageShort.optionCheckboxByIndex('1').click({ force: true });
    await profilePageShort.waitForResultsLoad();
    const resultCountAfterFilterApplying = await profilePageShort.getResultsCount();
    expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
    await profilePageShort.chevronMenuFirstCard.click();
    const recordLocator = page.locator('p', { hasText: 'Registration Template' }).first();
    await expect(recordLocator).toContainText(nameOfRecord);
  });

  test('filtering by includes community on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByIncludesCommunitySchema();
  });

  test('filtering by analytic code on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByAdditionalOptions(
      'hasAnalyticCodeResource',
      'Analytic code',
      'i[class*="custom-icon-code"]'
    );
  });

  test('filtering by papers on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByAdditionalOptions(
      'hasPapersResource',
      'Papers',
      'i[class*="custom-icon-papers"]'
    );
  });

  test('filtering by supplemental resource on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByAdditionalOptions(
      'hasSupplementalResource',
      'Supplemental resource',
      'i[class*="custom-icon-supplements"]'
    );
  });

  test('filtering by materials on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkFilteringByAdditionalOptions(
      'hasMaterialsResource',
      'Materials',
      'i[class*="custom-icon-supplements"]'
    );
  });

  test('clearing of applied filters on registration tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkSortingByCreatedDate('registered');
  });

  test('sorting by modified date on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await profilePageShort.checkSortingByModifiedDate();
  });

  test('search in filtering by creator on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.creatorDropdownMenu,
      profilePageShort.additionalMultiselectDropdown
    );
  });

  test('search in filtering by date created on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.dateCreatedMenu,
      profilePageShort.dateCreatedMultiselectDropdown
    );
  });

  test('search in filtering by funder on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.funderMenu,
      profilePageShort.funderMultiselectDropdown
    );
  });

  test('search in filtering by subject on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.subjectMenu,
      profilePageShort.subjectMultiselectDropdown
    );
  });

  test('search in filtering by license on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.licenseMenu,
      profilePageShort.licenseMultiselectDropdown
    );
  });

  test('search in filtering by resource type on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.resourceTypeMenu,
      profilePageShort.resourceTypeMultiselectDropdown
    );
  });

  test('search in filtering by institution on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.institutionMenu,
      profilePageShort.institutionMultiselectDropdown
    );
  });

  test('search in filtering by community schema on registrations tab', async ({
    profilePageShort,
  }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.includesCommunitySchemaMenu,
      profilePageShort.includesCommunitySchemaMultiselectDropdown
    );
  });

  test('search in filtering by provider on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.providerMenu,
      profilePageShort.providerMultiselectDropdown
    );
  });

  test('search in filtering by registration template on registrations tab', async ({
    profilePageShort,
  }) => {
    await profilePageShort.registrationsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.registrationTemplateMenu,
      profilePageShort.registrationTemplateMultiselectDropdown
    );
  });

  test('search card registrations', async ({ page, profilePageShort }) => {
    await profilePageShort.registrationsTabLink.click();
    await verifyRegistrationCard(page, new RegistrationSearchResults(page));
  });
});

// -------------------------------------------------------------------------------
// TestProfilePagePreprintsTab (17 tests)
// -------------------------------------------------------------------------------

test.describe('Profile Page Preprints Tab', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('filtering by creator on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkFilteringByCreator();
  });

  test('filtering by date created on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkFilteringByDateCreated('Date created');
  });

  test('filtering by subject on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkFilteringBySubject('1');
  });

  test('filtering by license on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkFilteringByLicense();
  });

  test('filtering by institution on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkFilteringByInstitution('1');
  });

  test('filtering by provider on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkFilteringByProvider();
  });

  test('filtering by supplemental materials on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkFilteringBySupplementalMaterials();
  });

  test('clearing of applied filters on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkSortingByCreatedDate('registered');
  });

  test('sorting by modified date on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await profilePageShort.checkSortingByModifiedDate();
  });

  test('search in filtering by creator on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.creatorDropdownMenu,
      profilePageShort.additionalMultiselectDropdown
    );
  });

  test('search in filtering by date created on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.dateCreatedMenu,
      profilePageShort.dateCreatedMultiselectDropdown
    );
  });

  test('search in filtering by subject on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.subjectMenu,
      profilePageShort.subjectMultiselectDropdown
    );
  });

  test('search in filtering by license on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.licenseMenu,
      profilePageShort.licenseMultiselectDropdown
    );
  });

  test('search in filtering by institution on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.institutionMenu,
      profilePageShort.institutionMultiselectDropdown
    );
  });

  test('search in filtering by provider on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.providerMenu,
      profilePageShort.providerMultiselectDropdown
    );
  });

  test('search card preprints', async ({ page, profilePageShort }) => {
    await profilePageShort.preprintsTabLink.click();
    await verifyPreprintCard(page, new PreprintSearchResults(page));
  });
});

// -------------------------------------------------------------------------------
// TestProfilePageFilesTab (14 tests)
// -------------------------------------------------------------------------------

test.describe('Profile Page Files Tab', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('filtering by date created on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkFilteringByDateCreated('Date created');
  });

  test('filtering by funder on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkFilteringByFunder();
  });

  test('filtering by license on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkFilteringByLicense();
  });

  test('filtering by resource type on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkFilteringByResourceType('', 'Book');
  });

  test('filtering by community schema on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkFilteringByIncludesCommunitySchema();
  });

  test('clearing of applied filters on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkSortingByCreatedDate('created');
  });

  test('sorting by modified date on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkSortingByModifiedDate();
  });

  test('search card files', async ({ page, profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await verifyFileCard(page, new FileSearchResults(page), profilePageShort.chevronMenuFirstCard);
  });

  test('search in filtering by date created on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.dateCreatedMenu,
      profilePageShort.dateCreatedMultiselectDropdown
    );
  });

  test('search in filtering by funder on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.funderMenu,
      profilePageShort.funderMultiselectDropdown
    );
  });

  test('search in filtering by license on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.licenseMenu,
      profilePageShort.licenseMultiselectDropdown
    );
  });

  // Python's `test_search_in_filtering_by_resource_type_on_files_tab` never actually
  // called `check_search_in_filtering_options` (it stopped right after opening the
  // dropdown) - the test passed without asserting anything. Restored here.
  test('search in filtering by resource type on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.resourceTypeMenu,
      profilePageShort.resourceTypeMultiselectDropdown
    );
  });

  test('search in filtering by community schema on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await checkSearchInFilteringOptionsFor(
      profilePageShort,
      profilePageShort.includesCommunitySchemaMenu,
      profilePageShort.includesCommunitySchemaMultiselectDropdown
    );
  });
});

// -------------------------------------------------------------------------------
// TestUserSocialLinks (11 tests)
// -------------------------------------------------------------------------------

const LINK_ID_MAP: Record<string, string> = {
  github: 'osframeworktesting',
  linkedin: 'in/openscienceframework-test-29b4a8408/',
  researcherid: 'S-1234-6789',
  x: 'OsfTesting',
  googlescholar: 'TEST12345',
  impactstory: 'IMP-12345',
  researchgate: 'osframeworktesting/selenium.testing:',
  baiduscholar: 'CN-TEST123',
  ssrn: '100-234-7896',
  yourwebsite: 'https://mywebapp.com',
  academia: 'collection:personal:7PZSFFBN',
};

const LINK_PLACEHOLDER_MAP: Record<string, string> = {
  github: 'username',
  linkedin: 'in/userID, profie/view?profileID, or pub/pubID',
  researcherid: 'x-xxxx-xxxx',
  x: 'twitterhandle',
  googlescholar: 'profileID',
  impactstory: 'profileID',
  researchgate: 'profileID',
  baiduscholar: 'profileID',
  ssrn: 'profileID',
  yourwebsite: 'https://yourwebsite.com',
  academia: 'profileId',
};

const LINK_LOGO_MAP: Record<string, string> = {
  github: 'github.svg',
  linkedin: 'linkedin.svg',
  researcherid: 'researcherID.png',
  x: 'x.svg',
  googlescholar: 'scholar.svg',
  impactstory: 'impactstory.png',
  researchgate: 'researchGate.svg',
  baiduscholar: 'baiduScholar.png',
  ssrn: 'ssrn.svg',
  yourwebsite: 'globe.svg',
  academia: 'profileId',
};

const PROFILE_ID_PLACEHOLDER_LINKS = ['googlescholar', 'impactstory', 'researchgate', 'baiduscholar', 'ssrn'];

const TESTABLE_LINKS = [
  'github',
  'linkedin',
  'researcherid',
  'x',
  'impactstory',
  'googlescholar',
  'researchgate',
  'baiduscholar',
  'ssrn',
  'yourwebsite',
];

test.describe('User Social Links', { tag: ['@core'] }, () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  for (const socialLink of TESTABLE_LINKS) {
    test(`profile links [${socialLink}]`, async ({ session, ownProfilePageShort, page }) => {
      const userName = (await ownProfilePageShort.profileName.innerText()).trim();
      try {
        const linkId = LINK_ID_MAP[socialLink];
        const placeholderText = LINK_PLACEHOLDER_MAP[socialLink];
        await ownProfilePageShort.clickOnButton('Edit Profile');
        await ownProfilePageShort.selectProfileTab('Social');
        if (PROFILE_ID_PLACEHOLDER_LINKS.includes(socialLink)) {
          await ownProfilePageShort.sendSocialLinkInputProfileId(socialLink, linkId);
        } else {
          await ownProfilePageShort.sendSocialLinkInput(linkId, placeholderText);
        }
        await ownProfilePageShort.clickOnSaveButton('Social');

        const profilePage = new ProfilePage(page);
        await profilePage.goto();
        await expect(profilePage.identity).toBeVisible();

        const expectedLogo = LINK_LOGO_MAP[socialLink];
        const actualLogoSrc = await profilePage.getSocialLinkLogo(socialLink);
        expect(actualLogoSrc).toContain(expectedLogo);
      } finally {
        await osfApi.updateUserSocial(session, userName);
      }
    });
  }

  test('profile link', async ({ session, ownProfilePageShort }) => {
    const createdDate = (await ownProfilePageShort.profileCreatedDate.innerText()).trim();
    const userName = (await ownProfilePageShort.profileName.innerText()).trim();

    const userData = await osfApi.getUserDetails(session, userName);
    const apiRegisteredDate: string = userData.data.attributes.date_registered;
    const userGuid: string = userData.data.id;

    const uiDate = extractUiDate(createdDate);
    expect(uiDate).toBe(apiRegisteredDate.slice(0, 10));

    const userProfileLink = (await ownProfilePageShort.profileLink.innerText()).trim();
    expect(userProfileLink).toContain(userGuid);
  });
});
