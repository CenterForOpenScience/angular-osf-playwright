import { Locator } from '@playwright/test';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import { ProjectSearchResults, RegistrationSearchResults, PreprintSearchResults, FileSearchResults } from '../src/pages/SearchPage';
import { ProfilePage } from '../src/pages/ProfilePage';
import * as osfApi from '../src/api/osfApi';
import {
  verifyPreprintCard,
  verifyRegistrationCard,
  verifyProjectCard,
  verifyFileCard,
} from '../src/utils/searchCards';

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

/** Port of `utils.extract_ui_date` - the profile page's "Date joined"-style text uses abbreviated month names ("Aug 12, 2024"), unlike the search-card dates `normalizeUiDate` in `src/utils/searchCards.ts` parses. Returns an ISO `YYYY-MM-DD` string. */
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
    await profilePageShort.checkFilteringByResourceType('Book');
  });

  test('clearing of applied filters on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.projectsTabLink);
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.projectsTabLink);
    await profilePageShort.checkSortingByCreatedDate('created');
  });

  test('sorting by modified date on projects tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.projectsTabLink);
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
    await profilePageShort.checkFilteringByResourceType('Book');
  });

  test('clearing of applied filters on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on all tab', async ({ profilePageShort }) => {
    await profilePageShort.checkSortingByCreatedDate(['created', 'registered']);
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
    await profilePageShort.checkFilteringByResourceType('StudyRegistration', { verifyOnCard: false });
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
    const resultCountBeforeFilter = await profilePageShort.getResultsCount();
    await profilePageShort.optionCheckboxByIndex('1').click({ force: true });
    await profilePageShort.waitForResultsLoad();
    await profilePageShort.expectFilterNarrowedResults(resultCountBeforeFilter, numberOfRecords);
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
    await profilePageShort.openTab(profilePageShort.registrationsTabLink);
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.registrationsTabLink);
    await profilePageShort.checkSortingByCreatedDate('registered');
  });

  test('sorting by modified date on registrations tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.registrationsTabLink);
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
    await profilePageShort.openTab(profilePageShort.preprintsTabLink);
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.preprintsTabLink);
    await profilePageShort.checkSortingByCreatedDate('created');
  });

  test('sorting by modified date on preprints tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.preprintsTabLink);
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
    await profilePageShort.checkFilteringByResourceType('Book');
  });

  test('filtering by community schema on files tab', async ({ profilePageShort }) => {
    await profilePageShort.filesTabLink.click();
    await profilePageShort.checkFilteringByIncludesCommunitySchema();
  });

  test('clearing of applied filters on files tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.filesTabLink);
    await profilePageShort.checkClearingOfAppliedFilters();
  });

  test('sorting by created date on files tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.filesTabLink);
    await profilePageShort.checkSortingByCreatedDate('created');
  });

  test('sorting by modified date on files tab', async ({ profilePageShort }) => {
    await profilePageShort.openTab(profilePageShort.filesTabLink);
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
