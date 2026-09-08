import { Page, Locator } from '@playwright/test';

import { test as base, expect } from '../src/fixtures';
import {
  SearchPage,
  RegistrationSearchResults,
  ProjectSearchResults,
  PreprintSearchResults,
  UserSearchResults,
  FileSearchResults,
} from '../src/pages/SearchPage';
import { FileDetailPage } from '../src/pages/FileDetailPage';
import { PreprintPage } from '../src/pages/PreprintPage';
import { RegistrationPage } from '../src/pages/RegistrationPage';
import { ProjectPage } from '../src/pages/ProjectPage';
import { UserProfilePage } from '../src/pages/UserProfilePage';
import { present, clickExpectingPopup } from '../src/utils';


const test = base.extend<{
  searchPage: SearchPage;
  searchPageShort: SearchPage;
  registrationSearchPage: RegistrationSearchResults;
  preprintSearchPage: PreprintSearchResults;
  projectSearchPage: ProjectSearchResults;
  userSearchPage: UserSearchResults;
  fileSearchPage: FileSearchResults;
}>({
  searchPage: async ({ page }, use) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto();
    await use(searchPage);
  },
  searchPageShort: async ({ page }, use) => {
    const searchPage = new SearchPage(page);
    await searchPage.goto();
    await use(searchPage);
  },
  registrationSearchPage: async ({ page }, use) => {
    const registrationSearchPage = new RegistrationSearchResults(page);
    await registrationSearchPage.goto();
    await use(registrationSearchPage);
  },
  preprintSearchPage: async ({ page }, use) => {
    const preprintSearchPage = new PreprintSearchResults(page);
    await preprintSearchPage.goto();
    await use(preprintSearchPage);
  },
  projectSearchPage: async ({ page }, use) => {
    const projectSearchPage = new ProjectSearchResults(page);
    await projectSearchPage.goto();
    await use(projectSearchPage);
  },
  userSearchPage: async ({ page }, use) => {
    const userSearchPage = new UserSearchResults(page);
    await userSearchPage.goto();
    await use(userSearchPage);
  },
  fileSearchPage: async ({ page }, use) => {
    const fileSearchPage = new FileSearchResults(page);
    await fileSearchPage.goto();
    await use(fileSearchPage);
  },
});

/** Port of `normalize_ui_date`. */
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

  // "Feb 17, 2026, 10:51 AM" - registration overview page format, interpreted as
  // America/New_York local time then converted to UTC (matching the Python source).
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

async function contributorNames(locator: Locator): Promise<string[]> {
  const texts = await locator.allInnerTexts();
  return texts.map((text) => text.trim().replace(/,$/, '').trim());
}

async function checkSearchInFilteringOptionsFor(
  searchPageShort: SearchPage,
  menu: Locator,
  dropdown: Locator,
  recordIndex = '1'
): Promise<void> {
  await menu.click();
  await dropdown.click();
  await searchPageShort.checkSearchInFilteringOptions(recordIndex);
}


async function verifyPreprintSearchCard(
  page: Page,
  preprintSearchPage: PreprintSearchResults
): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await preprintSearchPage.searchResults.count()).toBeGreaterThan(0);

  const preprintTitle = (await preprintSearchPage.preprintTitle.innerText()).trim();
  const searchDateTextFull = await preprintSearchPage.dateCreated.innerText();
  const searchCardDate = searchDateTextFull.split('Date created:')[1].trim();

  const cardContributorNames = await contributorNames(
    preprintSearchPage.preprintCardContributorLinks
  );
  const hasMoreContributors = await present(preprintSearchPage.preprintCardContributorsMore);
  let moreCount = 0;
  if (hasMoreContributors) {
    const moreText = await preprintSearchPage.preprintCardContributorsMore.innerText();
    const match = moreText.match(/\d+/);
    moreCount = match ? parseInt(match[0], 10) : 0;
  }

  const popup = await clickExpectingPopup(page, preprintSearchPage.preprintTitle);
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

async function verifyRegistrationSearchCard(
  page: Page,
  registrationSearchPage: RegistrationSearchResults
): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await registrationSearchPage.searchResults.count()).toBeGreaterThan(0);

  const withdrawnBadge = page.locator('osf-resource-card:first-of-type p-tag', {
    hasText: 'Withdrawn',
  });
  if ((await withdrawnBadge.count()) > 0) {
    test.skip(true, 'Withdrawn Registration');
  }

  const cardContributorNames = await contributorNames(
    registrationSearchPage.registrationCardContributorLinks
  );
  const hasMoreContributors = await present(
    registrationSearchPage.registrationCardContributorsMore
  );
  let moreCount = 0;
  if (hasMoreContributors) {
    const moreText = await registrationSearchPage.registrationCardContributorsMore.innerText();
    const match = moreText.match(/\d+/);
    moreCount = match ? parseInt(match[0], 10) : 0;
  }

  const searchCardTitle = await registrationSearchPage.registrationTitle.innerText();
  const dates = (await registrationSearchPage.registrationDates.innerText()).split('|');
  const searchCardRegDate = dates[0].replace('Date registered:', '').trim();

  await registrationSearchPage.secondaryMetadataDropdown.click();
  await expect(
    page.locator('osf-resource-card:first-of-type osf-registration-secondary-metadata')
  ).toContainText('URL');

  const searchCardProvider = (await registrationSearchPage.registrationProvider.innerText())
    .split('Provider:')[1]
    .trim();
  const searchCardTemplate = (await registrationSearchPage.registrationTemplate.innerText())
    .split('Registration Template:')[1]
    .trim();
  const searchCardUrl = (await registrationSearchPage.registrationUrl.innerText())
    .split('URL:')[1]
    .trim();

  const hasLicenseOnCard = await present(registrationSearchPage.registrationLicense);
  let searchCardLicense = '';
  if (hasLicenseOnCard) {
    searchCardLicense = (await registrationSearchPage.registrationLicense.innerText())
      .split('License:')[1]
      .trim();
  }

  const hasDoiOnCard = await present(registrationSearchPage.registrationDoi);
  let searchCardDoi = '';
  if (hasDoiOnCard) {
    searchCardDoi = (await registrationSearchPage.registrationDoi.innerText())
      .split('DOI:')[1]
      .trim();
  }

  const popup = await clickExpectingPopup(page, registrationSearchPage.registrationTitle);
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

async function verifyProjectSearchCard(
  page: Page,
  projectSearchPage: ProjectSearchResults
): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await projectSearchPage.searchResults.count()).toBeGreaterThan(0);

  let isProjectComponent = true;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    isProjectComponent = (await projectSearchPage.firstCardType.innerText()) === 'Project Component';
    if (!isProjectComponent) break;
    await page.reload();
    await expect(page.locator('osf-resource-card').first()).toBeVisible();
  }
  if (isProjectComponent) {
    test.skip(true, 'Project component skipped');
  }

  const projectTitle = await projectSearchPage.projectTitle.innerText();
  const dates = (await projectSearchPage.projectDates.innerText()).split('|');
  const searchCardDateCreated = dates[0].replace('Date created:', '').trim();

  await projectSearchPage.secondaryMetadataDropdown.click();
  await expect(
    page.locator('osf-resource-card:first-of-type osf-project-secondary-metadata')
  ).toContainText('URL');

  const hasLicenseOnCard = await present(projectSearchPage.projectLicense);
  let searchCardLicense = '';
  if (hasLicenseOnCard) {
    searchCardLicense = (await projectSearchPage.projectLicense.innerText())
      .split('License:')[1]
      .trim();
  }

  const hasDoiOnCard = await present(projectSearchPage.projectDoi);
  let searchCardDoi = '';
  if (hasDoiOnCard) {
    searchCardDoi = (await projectSearchPage.projectDoi.innerText()).split('DOI:')[1].trim();
  }

  const hasCollectionOnCard = await present(projectSearchPage.projectCollection);
  let searchCardCollection = '';
  if (hasCollectionOnCard) {
    searchCardCollection = (await projectSearchPage.projectCollection.innerText())
      .split('Collection:')[1]
      .trim();
  }

  const popup = await clickExpectingPopup(page, projectSearchPage.projectTitle);
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

async function verifyFileSearchCard(
  page: Page,
  fileSearchPage: FileSearchResults
): Promise<void> {
  await expect(page.locator('osf-resource-card').first()).toBeVisible();
  expect(await fileSearchPage.searchResults.count()).toBeGreaterThan(0);

  const searchCardTitle = (await fileSearchPage.fileTitle.innerText()).trim();
  const fromHref = await fileSearchPage.fromProjectLink.getAttribute('href');
  const parentProjectGuid = (fromHref ?? '').replace(/\/+$/, '').split('/').pop() ?? '';

  const searchPage = new SearchPage(page);
  await searchPage.chevronMenuFirstCard.click();

  let searchCardFunder: string | null = null;
  if (await present(fileSearchPage.funderLink)) {
    searchCardFunder = (await fileSearchPage.funderLink.innerText()).trim();
  }

  const popup = await clickExpectingPopup(page, fileSearchPage.fileTitle);

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

async function verifyUserSearchCard(page: Page, userSearchPage: UserSearchResults): Promise<void> {
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

  if (publicProjects > 0) {
    await profilePage.projectsTab.click();
    await expect(popup.locator('p.type.py-1.px-3.font-bold').first()).toContainText('Project');
    const resultText = (await profilePage.resultCount.innerText()).trim();
    const profileProjects = parseInt(resultText.split(' ')[0], 10);
    expect(publicProjects).toBeGreaterThanOrEqual(profileProjects);
  }
  if (publicRegistrations > 0) {
    await profilePage.registrationsTab.click();
    await expect(popup.locator('p.type.py-1.px-3.font-bold').first()).toContainText(
      'Registration'
    );
    const resultText = (await profilePage.resultCount.innerText()).trim();
    const profileRegistrations = parseInt(resultText.split(' ')[0], 10);
    expect(publicRegistrations).toBeGreaterThanOrEqual(profileRegistrations);
  }
  if (publicPreprints > 0) {
    await profilePage.preprintsTab.click();
    await expect(popup.locator('p.type.py-1.px-3.font-bold').first()).toContainText('Preprint');
    const resultText = (await profilePage.resultCount.innerText()).trim();
    const profilePreprints = parseInt(resultText.split(' ')[0], 10);
    expect(publicPreprints).toBeGreaterThanOrEqual(profilePreprints);
  }
}


async function clickTabAndVerifyType(
  page: Page,
  searchPage: SearchPage,
  tabLink: Locator,
  expectedTypePattern: string | RegExp
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await tabLink.click();
    await searchPage.waitForResultsLoad();
    await expect(searchPage.searchResults.first()).toBeVisible();
    try {
      await expect(searchPage.firstCardObjectTypeLabel).toHaveText(expectedTypePattern, {
        timeout: 8000,
      });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.reload();
      await searchPage.waitForResultsLoad();
    }
  }
}

test.describe('Search Page', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ throttleOnProd }) => {
    void throttleOnProd;
  });


  test.describe('Search Results', () => {
    test('search results exist on all tab', async ({ searchPage }) => {
      await searchPage.searchInput.fill('test');
      await searchPage.searchInput.press('Enter');
      await searchPage.waitForResultsLoad();
      await expect(searchPage.searchResults.first()).toBeVisible();
      expect(await searchPage.searchResults.count()).toBeGreaterThan(0);
    });

    test('search results exist on projects tab', async ({ page, searchPage }) => {
      await searchPage.searchInput.fill('test');
      await searchPage.searchInput.press('Enter');
      await searchPage.waitForResultsLoad();
      await clickTabAndVerifyType(page, searchPage, searchPage.projectsTabLink, /^\s*Project/);
      expect(await searchPage.searchResults.count()).toBeGreaterThan(0);
    });

    test('search results exist on registrations tab', async ({ page, searchPage }) => {
      await searchPage.searchInput.fill('test');
      await searchPage.searchInput.press('Enter');
      await searchPage.waitForResultsLoad();
      await clickTabAndVerifyType(
        page,
        searchPage,
        searchPage.registrationsTabLink,
        /^\s*Registration/
      );
      expect(await searchPage.searchResults.count()).toBeGreaterThan(0);
    });

    test('search results exist on preprints tab', async ({ page, searchPage }) => {
      await searchPage.searchInput.fill('test');
      await searchPage.searchInput.press('Enter');
      await searchPage.waitForResultsLoad();
      await clickTabAndVerifyType(page, searchPage, searchPage.preprintsTabLink, 'Preprint');
      expect(await searchPage.searchResults.count()).toBeGreaterThan(0);
    });

    test('search results exist on files tab', async ({ page, searchPage }) => {
      await searchPage.searchInput.fill('test');
      await searchPage.searchInput.press('Enter');
      await searchPage.waitForResultsLoad();
      await clickTabAndVerifyType(page, searchPage, searchPage.filesTabLink, 'File');
      expect(await searchPage.searchResults.count()).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------------
  // TestSearchPageAllTab (21 tests, 3 skipped ENG-10674)
  // -------------------------------------------------------------------------------
  test.describe('All Tab', () => {
    test('filtering by creator on all tab', async ({ searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.checkFilteringByCreator();
    });

    test('filtering by date created on all tab', async ({ searchPageShort }) => {
      await searchPageShort.checkFilteringByDateCreated('Date created');
    });

    test('filtering by funder on all tab', async ({ searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.checkFilteringByFunder();
    });

    test('filtering by subject on all tab', async ({ searchPageShort }) => {
      await searchPageShort.checkFilteringBySubject();
    });

    test('filtering by license on all tab', async ({ searchPageShort }) => {
      await searchPageShort.checkFilteringByLicense();
    });

    test('filtering by resource type on all tab', async ({ page, searchPageShort }) => {
      await searchPageShort.resourceTypeMenu.click();
      await searchPageShort.resourceTypeMultiselectDropdown.click();
      await searchPageShort.multiselectFilterInput.fill('preprin');
      const nameOfRecord = await searchPageShort.getRecordName('1');
      await searchPageShort.optionCheckboxByIndex('1').click({ force: true });
      const resourceTypeInCard = page.locator(`p[class*="type"]:text-is("${nameOfRecord}")`).first();
      await expect(resourceTypeInCard).toBeVisible();
    });

    test('filtering by part of collection on all tab', async ({ searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.checkFilteringByPartOfCollection();
    });

    test('filtering by provider on all tab', async ({ page, searchPageShort }) => {
      await searchPageShort.providerMenu.click();
      await searchPageShort.providerMultiselectDropdown.click();
      await searchPageShort.multiselectFilterInput.fill('regis');
      const nameOfRecord = await searchPageShort.getRecordName('1');
      const numberOfRecords = await searchPageShort.getRecordCount('1');
      await searchPageShort.optionCheckboxByIndex('1').click({ force: true });
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
      await searchPageShort.chevronMenuFirstCard.click();
      const recordLocator = page.locator('p', { hasText: 'Provider:' }).locator('a').first();
      await expect(recordLocator).toContainText(nameOfRecord);
    });

    test('filtering by institution on all tab', async ({ searchPageShort }) => {
      await searchPageShort.checkFilteringByInstitution('3');
    });

    test('sorting by created date on all tab', async ({ searchPageShort }) => {
      await searchPageShort.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on all tab', async ({ searchPageShort }) => {
      await searchPageShort.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.creatorDropdownMenu,
        searchPageShort.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.dateCreatedMenu,
        searchPageShort.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.funderMenu,
        searchPageShort.funderMultiselectDropdown
      );
    });

    test('search in filtering by subject on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.subjectMenu,
        searchPageShort.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.licenseMenu,
        searchPageShort.licenseMultiselectDropdown
      );
    });

    test('search in filtering by resource type on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.resourceTypeMenu,
        searchPageShort.resourceTypeMultiselectDropdown
      );
    });

    test('search in filtering by institution on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.institutionMenu,
        searchPageShort.institutionMultiselectDropdown
      );
    });

    test('search in filtering by provider on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.providerMenu,
        searchPageShort.providerMultiselectDropdown,
        '2'
      );
    });

    test('search in filtering by part of collection on all tab', async ({ searchPageShort }) => {
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.partOfCollectionMenu,
        searchPageShort.partOfCollectionMultiselectDropdown
      );
    });

    test('search card all', async ({ page, searchPage }) => {
      await expect(page.locator('osf-resource-card').first()).toBeVisible();
      expect(await searchPage.searchResults.count()).toBeGreaterThan(0);

      let resultType = (await searchPage.nodeType.innerText()).trim();
      const knownTypes = ['Project', 'Registration', 'Preprint', 'File', 'User'];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (knownTypes.includes(resultType)) break;
        if (attempt < 2) {
          await page.reload();
          await expect(page.locator('osf-resource-card').first()).toBeVisible();
          resultType = (await searchPage.nodeType.innerText()).trim();
        } else {
          throw new Error(`Unknown search result type: ${resultType}`);
        }
      }

      switch (resultType) {
        case 'Project':
          await verifyProjectSearchCard(page, new ProjectSearchResults(page));
          break;
        case 'Registration':
          await verifyRegistrationSearchCard(page, new RegistrationSearchResults(page));
          break;
        case 'Preprint':
          await verifyPreprintSearchCard(page, new PreprintSearchResults(page));
          break;
        case 'File':
          await verifyFileSearchCard(page, new FileSearchResults(page));
          break;
        case 'User':
          await verifyUserSearchCard(page, new UserSearchResults(page));
          break;
        default:
          throw new Error(`Unknown search result type: ${resultType}`);
      }
    });
  });

  // -------------------------------------------------------------------------------
  // TestSearchPagePreprintsTab (20 tests)
  // -------------------------------------------------------------------------------
  test.describe('Preprints Tab', () => {
    test('filtering by creator on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkFilteringByCreator();
    });

    test('filtering by date created on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkFilteringByDateCreated('Date created');
    });

    test('filtering by subject on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkFilteringBySubject();
    });

    test('filtering by license on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkFilteringByLicense();
    });

    test('filtering by institution on preprints tab', async ({ searchPageShort }) => {
      test.skip(true, 'ENG-10674');
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkFilteringByInstitution();
    });

    test('filtering by provider on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkFilteringByProvider();
    });

    test('filtering by supplemental materials on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkFilteringBySupplementalMaterials();
    });

    test('filtering by data on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      const publicDataSelector = 'section:has(h3:text-is("Public Data")) p:text("http")';
      await searchPageShort.checkFilteringByData(publicDataSelector);
    });

    test('filtering by preregistered analysis plan on preprints tab', async ({
      page,
      searchPageShort,
    }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.additionalFiltersMenu.click();
      const option = page.locator('input#checkbox-hasPreregisteredAnalysisPlan');
      const numberOfRecords = await searchPageShort.getRecordCountForAdditionalFilters(
        'Preregistered analysis plan'
      );
      await option.click();
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
      await searchPageShort.chevronMenuFirstCard.click();
      const elementOnCard = page
        .locator('p:text("Associated preregistration") a[href*="http"]')
        .first();
      await expect(elementOnCard).toBeVisible();
    });

    test('filtering by preregistered study design on preprints tab', async ({
      page,
      searchPageShort,
    }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.additionalFiltersMenu.click();
      const option = page.locator('input#checkbox-hasPreregisteredStudyDesign');
      const numberOfRecords = await searchPageShort.getRecordCountForAdditionalFilters(
        'Preregistered study design'
      );
      await option.click();
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
      await searchPageShort.chevronMenuFirstCard.click();
      const elementOnCard = page
        .locator('p:text("Associated study design") a[href*="http"]')
        .first();
      await expect(elementOnCard).toBeVisible();
    });

    test('clearing of applied filters on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkClearingOfAppliedFilters();
    });

    test('search card preprints', async ({ page, preprintSearchPage }) => {
      await verifyPreprintSearchCard(page, preprintSearchPage);
    });

    test('sorting by created date on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await searchPageShort.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.creatorDropdownMenu,
        searchPageShort.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.dateCreatedMenu,
        searchPageShort.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by subject on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.subjectMenu,
        searchPageShort.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.licenseMenu,
        searchPageShort.licenseMultiselectDropdown
      );
    });

    test('search in filtering by institution on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.institutionMenu,
        searchPageShort.institutionMultiselectDropdown
      );
    });

    test('search in filtering by provider on preprints tab', async ({ searchPageShort }) => {
      await searchPageShort.preprintsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.providerMenu,
        searchPageShort.providerMultiselectDropdown
      );
    });
  });

  // -------------------------------------------------------------------------------
  // TestSearchPageRegistrationsTab (29 tests)
  // -------------------------------------------------------------------------------
  test.describe('Registrations Tab', () => {
    test('filtering by creator on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByCreator();
    });

    test('filtering by date created on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByDateCreated('Date registered');
    });

    test('filtering by subject on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringBySubject();
    });

    test('filtering by license on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByLicense();
    });

    test('filtering by institution on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByInstitution();
    });

    test('filtering by provider on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByProvider();
    });

    test('filtering by funder on registrations tab', async ({ searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByFunder();
    });

    test('filtering by resource type on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByResourceType('', 'Registration');
    });

    test('filtering by data on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByData('i[class*="custom-icon-data"]');
    });

    test('filtering by registration template on registrations tab', async ({
      page,
      searchPageShort,
    }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.registrationTemplateMenu.click();
      await searchPageShort.registrationTemplateMultiselectDropdown.click();
      const nameOfRecord = await searchPageShort.getRecordName('1');
      const numberOfRecords = await searchPageShort.getRecordCount('1');
      await searchPageShort.optionCheckboxByIndex('1').click({ force: true });
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
      await searchPageShort.chevronMenuFirstCard.click();
      const recordLocator = page.locator('p', { hasText: 'Registration Template' }).first();
      await expect(recordLocator).toContainText(nameOfRecord);
    });

    test('filtering by includes community on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByIncludesCommunitySchema();
    });

    test('filtering by analytic code on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByAdditionalOptions(
        'hasAnalyticCodeResource',
        'Analytic code',
        'i[class*="custom-icon-code"]'
      );
    });

    test('filtering by papers on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByAdditionalOptions(
        'hasPapersResource',
        'Papers',
        'i[class*="custom-icon-papers"]'
      );
    });

    test('filtering by supplemental resource on registrations tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByAdditionalOptions(
        'hasSupplementalResource',
        'Supplemental resource',
        'i[class*="custom-icon-supplements"]'
      );
    });

    test('filtering by materials on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkFilteringByAdditionalOptions(
        'hasMaterialsResource',
        'Materials',
        'i[class*="custom-icon-supplements"]'
      );
    });

    test('clearing of applied filters on registration tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkClearingOfAppliedFilters();
    });

    test('search card registrations', async ({ page, registrationSearchPage }) => {
      await verifyRegistrationSearchCard(page, registrationSearchPage);
    });

    test('sorting by created date on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkSortingByCreatedDate('registered');
    });

    test('sorting by modified date on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await searchPageShort.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.creatorDropdownMenu,
        searchPageShort.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on registrations tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.dateCreatedMenu,
        searchPageShort.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.funderMenu,
        searchPageShort.funderMultiselectDropdown
      );
    });

    test('search in filtering by subject on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.subjectMenu,
        searchPageShort.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.licenseMenu,
        searchPageShort.licenseMultiselectDropdown
      );
    });

    test('search in filtering by resource type on registrations tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.resourceTypeMenu,
        searchPageShort.resourceTypeMultiselectDropdown
      );
    });

    test('search in filtering by institution on registrations tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.institutionMenu,
        searchPageShort.institutionMultiselectDropdown
      );
    });

    test('search in filtering by community schema on registrations tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.includesCommunitySchemaMenu,
        searchPageShort.includesCommunitySchemaMultiselectDropdown
      );
    });

    test('search in filtering by provider on registrations tab', async ({ searchPageShort }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.providerMenu,
        searchPageShort.providerMultiselectDropdown
      );
    });

    test('search in filtering by registration template on registrations tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.registrationsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.registrationTemplateMenu,
        searchPageShort.registrationTemplateMultiselectDropdown
      );
    });
  });

  // -------------------------------------------------------------------------------
  // TestSearchPageFilesTab (14 tests)
  // -------------------------------------------------------------------------------
  test.describe('Files Tab', () => {
    test('filtering by date created on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.checkFilteringByDateCreated('Date created');
    });

    test('filtering by funder on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.checkFilteringByFunder();
    });

    test('filtering by license on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.checkFilteringByLicense();
    });

    test('filtering by resource type on files tab', async ({ page, searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.resourceTypeMenu.click();
      await searchPageShort.resourceTypeMultiselectDropdown.click();
      await searchPageShort.multiselectFilterInput.fill('Book');
      const numberOfRecords = await searchPageShort.getRecordCount('1');
      await searchPageShort.optionCheckboxByIndex('1').click({ force: true });
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
      await searchPageShort.chevronMenuFirstCard.click();
      const resourceTypeInCard = page.locator('p', { hasText: 'Resource type:' }).first();
      await expect(resourceTypeInCard).toContainText('Book');
    });

    test('filtering by includes community on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.checkFilteringByIncludesCommunitySchema();
    });

    test('clearing of applied filters on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.checkClearingOfAppliedFilters();
    });

    test('sorting by created date on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await searchPageShort.checkSortingByModifiedDate();
    });

    test('search card files', async ({ page, fileSearchPage }) => {
      await verifyFileSearchCard(page, fileSearchPage);
    });

    test('search in filtering by date created on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.dateCreatedMenu,
        searchPageShort.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.funderMenu,
        searchPageShort.funderMultiselectDropdown
      );
    });

    test('search in filtering by license on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.licenseMenu,
        searchPageShort.licenseMultiselectDropdown
      );
    });

    test('search in filtering by community schema on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.includesCommunitySchemaMenu,
        searchPageShort.includesCommunitySchemaMultiselectDropdown
      );
    });

    test('search in filtering by resource type on files tab', async ({ searchPageShort }) => {
      await searchPageShort.filesTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.resourceTypeMenu,
        searchPageShort.resourceTypeMultiselectDropdown
      );
    });
  });

  // -------------------------------------------------------------------------------
  // TestSearchPageProjectsTab (23 tests, 6 skipped ENG-10674)
  // -------------------------------------------------------------------------------
  test.describe('Projects Tab', () => {
    test('filtering by creator on projects tab', async ({ searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringByCreator();
    });

    test('filtering by date created on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringByDateCreated('Date created');
    });

    test('filtering by funder on projects tab', async ({ searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringByFunder();
    });

    test('filtering by subject on projects tab', async ({ searchPageShort }) => {
      test.skip(true, 'ENG-10674');
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringBySubject();
    });

    test('filtering by license on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringByLicense();
    });

    test('filtering by institution on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringByInstitution();
    });

    test('filtering by part of collection on projects tab', async ({ searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringByPartOfCollection();
    });

    test('filtering by includes community schema on projects tab', async ({
      searchPageShort,
    }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkFilteringByIncludesCommunitySchema();
    });

    test('filtering by associated preprint on projects tab', async ({ page, searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.additionalFiltersMenu.click();
      const additionalOption = page.locator('input#checkbox-supplements');
      if (!(await present(additionalOption))) {
        test.skip(true, 'Record was not found in the list');
      }
      const numberOfRecords = await searchPageShort.getRecordCountForAdditionalFilters(
        'Associated preprint'
      );
      await additionalOption.click();
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBeLessThanOrEqual(numberOfRecords as number);
      const popup = await clickExpectingPopup(page, searchPageShort.firstSearchResultTitle);
      const locator = popup.locator('osf-overview-supplements p', { hasText: 'Preprints' });
      await expect(locator).toBeVisible();
    });

    test('clearing of applied filters on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkClearingOfAppliedFilters();
    });

    test('filtering by resource type on projects tab', async ({ page, searchPageShort }) => {
      // test.skip(true, 'ENG-10674');
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.resourceTypeMenu.click();
      await searchPageShort.resourceTypeMultiselectDropdown.click();
      await searchPageShort.multiselectFilterInput.fill('Book');
      const numberOfRecords = await searchPageShort.getRecordCount('1');
      await searchPageShort.optionCheckboxByIndex('1').click({ force: true });
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBe(numberOfRecords);
      await searchPageShort.chevronMenuFirstCard.click();
      const resourceTypeInCard = page.locator('p', { hasText: 'Resource type:' }).first();
      await expect(resourceTypeInCard).toContainText('Book');
    });

    test('sorting by created date on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await searchPageShort.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.creatorDropdownMenu,
        searchPageShort.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.dateCreatedMenu,
        searchPageShort.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.funderMenu,
        searchPageShort.funderMultiselectDropdown
      );
    });

    test('search in filtering by subject on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.subjectMenu,
        searchPageShort.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.licenseMenu,
        searchPageShort.licenseMultiselectDropdown
      );
    });

    test('search in filtering by resource type on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.resourceTypeMenu,
        searchPageShort.resourceTypeMultiselectDropdown
      );
    });

    test('search in filtering by institution on projects tab', async ({ searchPageShort }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.institutionMenu,
        searchPageShort.institutionMultiselectDropdown
      );
    });

    test('search in filtering by part of collection on projects tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.partOfCollectionMenu,
        searchPageShort.partOfCollectionMultiselectDropdown
      );
    });

    test('search in filtering by community schema on projects tab', async ({
      searchPageShort,
    }) => {
      await searchPageShort.projectsTabLink.click();
      await checkSearchInFilteringOptionsFor(
        searchPageShort,
        searchPageShort.includesCommunitySchemaMenu,
        searchPageShort.includesCommunitySchemaMultiselectDropdown
      );
    });

    test('search card projects', async ({ page, projectSearchPage }) => {
      await verifyProjectSearchCard(page, projectSearchPage);
    });
  });

  // -------------------------------------------------------------------------------
  // TestSearchPageUsersTab (6 tests)
  // -------------------------------------------------------------------------------
  test.describe('Users Tab', () => {
    test('sorting by created date on users tab', async ({ searchPageShort }) => {
      await searchPageShort.usersTabLink.click();
      await searchPageShort.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on users tab', async ({ searchPageShort }) => {
      await searchPageShort.usersTabLink.click();
      await searchPageShort.checkSortingByModifiedDate();
    });

    test('search results exist on users tab', async ({ searchPageShort }) => {
      await searchPageShort.usersTabLink.click();
      await expect(searchPageShort.searchResults.first()).toBeVisible();
      expect(await searchPageShort.searchResults.count()).toBeGreaterThan(0);
      expect(await searchPageShort.firstCardObjectTypeLabel.innerText()).toBe('User');
    });

    test('filtering on users tab', async ({ page, searchPageShort }) => {
      await searchPageShort.usersTabLink.click();
      await expect(searchPageShort.searchResults.first()).toBeVisible();
      await searchPageShort.institutionAffiliationMenu.click();
      await searchPageShort.additionalMultiselectDropdown.click();
      const nameOfInstitution = await searchPageShort.getRecordName('1');
      const numberOfUsers = await searchPageShort.getRecordCount('1');
      await searchPageShort.optionByIndex('1').click();
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).toBe(numberOfUsers);
      const institutionLocator = page
        .locator('p-accordion-panel a', { hasText: nameOfInstitution })
        .first();
      await expect(institutionLocator).toBeVisible();
    });

    test('clearing of applied filters on users tab', async ({ page, searchPageShort }) => {
      await searchPageShort.usersTabLink.click();
      await expect(searchPageShort.searchResults.first()).toBeVisible();
      const resultCountWithoutFilter = await searchPageShort.getResultsCount();
      await searchPageShort.institutionAffiliationMenu.click();
      await searchPageShort.additionalMultiselectDropdown.click();
      await searchPageShort.optionByIndex('1').click();
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterFilterApplying = await searchPageShort.getResultsCount();
      expect(resultCountAfterFilterApplying).not.toBe(resultCountWithoutFilter);
      await page.locator('span.p-chip-remove-icon').click();
      await searchPageShort.waitForResultsLoad();
      const resultCountAfterRemovingFilter = await searchPageShort.getResultsCount();
      expect(resultCountAfterRemovingFilter).toBe(resultCountWithoutFilter);
    });

    test('search card users', async ({ page, userSearchPage }) => {
      await verifyUserSearchCard(page, userSearchPage);
    });
  });
});
