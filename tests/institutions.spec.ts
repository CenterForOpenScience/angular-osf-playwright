import { Locator, Page, Response } from '@playwright/test';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import {
  SearchPage,
  ProjectSearchResults,
  RegistrationSearchResults,
  PreprintSearchResults,
  FileSearchResults,
  UserSearchResults,
} from '../src/pages/SearchPage';
import {
  InstitutionsLandingPage,
  InstitutionBrandedPage,
  InstitutionAdminDashboardPage,
} from '../src/pages/InstitutionsPage';
import * as osfApi from '../src/api/osfApi';
import { clickExpectingPopup, present } from '../src/utils';
import {
  verifyPreprintCard,
  verifyRegistrationCard,
  verifyProjectCard,
  verifyFileCard,
  verifyUserCard,
} from '../src/utils/searchCards';



const INSTITUTION_NAME = settings.TEST4 || settings.STAGE4 ? 'Exoft' : 'Center For Open Science';

const test = base.extend<{
  landingPage: InstitutionsLandingPage;
  institutionPage: InstitutionBrandedPage;
}>({
  landingPage: async ({ page }, use) => {
    const landingPage = new InstitutionsLandingPage(page);
    await landingPage.goto();
    await expect(landingPage.institutionList.first()).toBeVisible();
    await use(landingPage);
  },
  /** Port of the `institution_page` fixture + `select_institution()` that every search test opened with. */
  institutionPage: async ({ page, landingPage }, use) => {
    await landingPage.searchFor(INSTITUTION_NAME);
    await landingPage.institutionList.first().click();
    const institutionPage = new InstitutionBrandedPage(page);
    await expect(institutionPage.institutionName).toContainText(INSTITUTION_NAME);
    await expect(institutionPage.searchResults.first()).toBeVisible();
    await use(institutionPage);
  },
});

async function checkSearchInFilteringOptionsFor(
  searchPage: SearchPage,
  menu: Locator,
  dropdown: Locator,
  recordIndex = '1'
): Promise<void> {
  await menu.click();
  await dropdown.click();
  await searchPage.checkSearchInFilteringOptions(recordIndex);
}

/** Port of `test_search_results_exist_*_tab`: search "test", open the tab, check the first card's type. */
async function checkSearchResultsExist(
  institutionPage: InstitutionBrandedPage,
  tabLink: Locator | null,
  expectedType: RegExp
): Promise<void> {
  await institutionPage.searchInput.fill('test');
  await institutionPage.searchInput.press('Enter');
  await institutionPage.waitForResultsLoad();
  if (tabLink) {
    await institutionPage.openTab(tabLink);
  }
  await expect(institutionPage.searchResults.first()).toBeVisible();
  expect(await institutionPage.searchResults.count()).toBeGreaterThan(0);
  await expect(institutionPage.firstCardObjectTypeLabel).toHaveText(expectedType);
}


async function checkAdditionalFilterShownOnCard(
  page: Page,
  institutionPage: InstitutionBrandedPage,
  checkboxId: string,
  optionName: string,
  cardLabel: string
): Promise<void> {
  await institutionPage.additionalFiltersMenu.click();
  const option = page.locator(`input#checkbox-${checkboxId}`);
  if (!(await present(option))) {
    test.skip(true, 'Record was not found in the list');
  }
  const numberOfRecords = await institutionPage.getRecordCountForAdditionalFilters(optionName);
  const resultCountBeforeFilter = await institutionPage.getResultsCount();
  await option.click();
  await institutionPage.waitForResultsLoad();
  await institutionPage.expectFilterNarrowedResults(resultCountBeforeFilter, numberOfRecords);
  await institutionPage.chevronMenuFirstCard.click();
  const linkOnCard = page
    .locator('osf-resource-card')
    .first()
    .locator('p', { hasText: cardLabel })
    .locator('a[href^="http"]')
    .first();
  await expect(linkOnCard).toBeVisible();
}

const skipOnTest4AndStage4 = (): void =>
  test.skip(settings.TEST4 || settings.STAGE4, 'Test is not applicable for test4 and stage4 environments');

// -------------------------------------------------------------------------------
// TestInstitutionsPage (2 tests)
// -------------------------------------------------------------------------------

test.describe('Institutions Page', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ throttleOnProd }) => {
    void throttleOnProd;
  });

  test('select institution', async ({ page, landingPage }) => {
    await landingPage.institutionList.first().click();
    await new InstitutionBrandedPage(page).verify();
  });

  test('filter by institution', async ({ landingPage }) => {
    await landingPage.searchFor(INSTITUTION_NAME);
  });
});

// -------------------------------------------------------------------------------
// TestInstitutionAdminDashboardPage (1 test)
// -------------------------------------------------------------------------------

test.describe('Institution Admin Dashboard Page', { tag: ['@core'] }, () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  
  test('institution admin dashboard', async ({ page, session, mustBeLoggedIn }) => {
    void mustBeLoggedIn;
    const apiQaUsers = await osfApi.getInstitutionUsersPerDepartment(session, 'cos', 'QA');
    const metricsData = await osfApi.getInstitutionMetricsSummary(session, 'cos');
    const apiPublicProjectCount: number = metricsData.attributes.public_project_count;
    const apiPrivateProjectCount: number = metricsData.attributes.private_project_count;

    const dashboardPage = new InstitutionAdminDashboardPage(page, 'cos');
    await dashboardPage.goto();
    await dashboardPage.verify();

    // Select 'QA' from the departments listbox and check the users table against the API.
    await dashboardPage.tab('Users').click();
    await dashboardPage.allDepartmentsDropdown.click();
    await dashboardPage.departmentOption('QA').click();
    await expect(dashboardPage.usersInDepartment('QA')).toHaveCount(apiQaUsers.length);

    await dashboardPage.tab('Summary').click();
    const totalDisplayedProjectsCount = await dashboardPage.readCount(
      dashboardPage.totalProjectsCount
    );

    await dashboardPage.publicVsPrivateHeader.click();
    expect(await dashboardPage.readCount(dashboardPage.publicProjectsCount)).toBe(
      apiPublicProjectCount
    );
    expect(await dashboardPage.readCount(dashboardPage.privateProjectsCount)).toBe(
      apiPrivateProjectCount
    );
    expect(totalDisplayedProjectsCount).toBe(apiPublicProjectCount + apiPrivateProjectCount);
  });
});

test.describe('Institution Page Search', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ throttleOnProd }) => {
    void throttleOnProd;
  });

  // -------------------------------------------------------------------------------
  // TestInstitutionPageSearch (5 tests)
  // -------------------------------------------------------------------------------

  test.describe('Search Results', () => {
    test('search results exist on all tab', async ({ institutionPage }) => {
      await institutionPage.searchInput.fill('test');
      await institutionPage.searchInput.press('Enter');
      await institutionPage.waitForResultsLoad();
      await expect(institutionPage.searchResults.first()).toBeVisible();
      expect(await institutionPage.searchResults.count()).toBeGreaterThan(0);
    });

    test('search results exist on projects tab', async ({ institutionPage }) => {
      await checkSearchResultsExist(institutionPage, institutionPage.projectsTabLink, /^\s*Project/);
    });

    test('search results exist on registrations tab', async ({ institutionPage }) => {
      await checkSearchResultsExist(
        institutionPage,
        institutionPage.registrationsTabLink,
        /^\s*Registration/
      );
    });

    test('search results exist on preprints tab', async ({ institutionPage }) => {
      await checkSearchResultsExist(institutionPage, institutionPage.preprintsTabLink, /^\s*Preprint\s*$/);
    });

    test('search results exist on files tab', async ({ institutionPage }) => {
      await checkSearchResultsExist(institutionPage, institutionPage.filesTabLink, /^\s*File\s*$/);
    });
  });

  // -------------------------------------------------------------------------------
  // TestInstitutionsPageSearchAllTab (22 tests)
  // -------------------------------------------------------------------------------

  test.describe('All Tab', () => {
    test('filtering by creator on all tab', async ({ institutionPage }) => {
      await institutionPage.checkFilteringByCreator();
    });

    test('filtering by date created on all tab', async ({ institutionPage }) => {
      await institutionPage.checkFilteringByDateCreated('Date created');
    });

    test('filtering by funder on all tab', async ({ institutionPage }) => {
      await institutionPage.checkFilteringByFunder();
    });

    test('filtering by subject on all tab', async ({ institutionPage }) => {
      await institutionPage.checkFilteringBySubject();
    });

    test('filtering by license on all tab', async ({ institutionPage }) => {
      await institutionPage.checkFilteringByLicense();
    });

   
    test('filtering by resource type on all tab', async ({ page, institutionPage }) => {
      await institutionPage.resourceTypeMenu.click();
      await institutionPage.resourceTypeMultiselectDropdown.click();
      await institutionPage.multiselectFilterInput.fill('preprin');
      if (!(await present(institutionPage.optionByIndex('1')))) {
        test.skip(true, 'Record was not found in the list');
      }
      const nameOfRecord = await institutionPage.getRecordName('1');
      await institutionPage.optionCheckboxByIndex('1').click({ force: true });
      await institutionPage.waitForResultsLoad();
      const typeBadges = page.locator('osf-resource-card p[class*="type"]');
      await expect(typeBadges.first()).toBeVisible();
      await expect(
        typeBadges.filter({ hasNotText: new RegExp(`^\\s*${nameOfRecord}\\s*$`) })
      ).toHaveCount(0);
    });

    test('filtering by part of collection on all tab', async ({ institutionPage }) => {
      skipOnTest4AndStage4();
      await institutionPage.checkFilteringByPartOfCollection();
    });

    test('filtering by provider on all tab', async ({ page, institutionPage }) => {
      await institutionPage.providerMenu.click();
      await institutionPage.providerMultiselectDropdown.click();
      await institutionPage.multiselectFilterInput.fill('regis');
      if (!(await present(institutionPage.optionByIndex('1')))) {
        test.skip(true, 'Record was not found in the list');
      }
      const nameOfRecord = await institutionPage.getRecordName('1');
      const numberOfRecords = await institutionPage.getRecordCount('1');
      const resultCountBeforeFilter = await institutionPage.getResultsCount();
      await institutionPage.optionCheckboxByIndex('1').click({ force: true });
      await institutionPage.waitForResultsLoad();
      await institutionPage.expectFilterNarrowedResults(resultCountBeforeFilter, numberOfRecords);
      await institutionPage.chevronMenuFirstCard.click();
      const recordLocator = page.locator('p', { hasText: 'Provider:' }).locator('a').first();
      await expect(recordLocator).toContainText(nameOfRecord);
    });

    test('filtering by institution on all tab', async ({ institutionPage }) => {
      await institutionPage.checkFilteringByInstitution('3');
    });

    test('sorting by created date on all tab', async ({ institutionPage }) => {
      await institutionPage.checkSortingByCreatedDate(['created', 'registered']);
    });

    test('sorting by modified date on all tab', async ({ institutionPage }) => {
      await institutionPage.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.creatorDropdownMenu,
        institutionPage.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.dateCreatedMenu,
        institutionPage.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.funderMenu,
        institutionPage.funderMultiselectDropdown
      );
    });

    test('search in filtering by subject on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.subjectMenu,
        institutionPage.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.licenseMenu,
        institutionPage.licenseMultiselectDropdown
      );
    });

    test('search in filtering by resource type on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.resourceTypeMenu,
        institutionPage.resourceTypeMultiselectDropdown
      );
    });

    test('search in filtering by institution on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.institutionMenu,
        institutionPage.institutionMultiselectDropdown
      );
    });

    test('search in filtering by provider on all tab', async ({ institutionPage }) => {
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.providerMenu,
        institutionPage.providerMultiselectDropdown,
        '2'
      );
    });

    test('search in filtering by part of collection on all tab', async ({ institutionPage }) => {
      skipOnTest4AndStage4();
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.partOfCollectionMenu,
        institutionPage.partOfCollectionMultiselectDropdown
      );
    });

    test('search card all', async ({ page, institutionPage }) => {
      let resultType = (await institutionPage.nodeType.innerText()).trim();
      const knownTypes = ['Project', 'Registration', 'Preprint', 'File'];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (knownTypes.includes(resultType)) break;
        if (attempt < 2) {
          await page.reload();
          await expect(institutionPage.searchResults.first()).toBeVisible();
          resultType = (await institutionPage.nodeType.innerText()).trim();
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
          await verifyFileCard(page, new FileSearchResults(page), institutionPage.chevronMenuFirstCard);
          break;
        default:
          throw new Error(`Unknown search result type: ${resultType}`);
      }
    });
  });

  // -------------------------------------------------------------------------------
  // TestInstitutionsPagePreprintsTab (21 tests)
  // -------------------------------------------------------------------------------

  test.describe('Preprints Tab', () => {
    test('filtering by creator on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringByCreator();
    });

    test('filtering by date created on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringByDateCreated('Date created');
    });

    test('filtering by subject on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringBySubject();
    });

    test('filtering by license on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringByLicense();
    });

    test('filtering by institution on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringByInstitution();
    });

    test('filtering by provider on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringByProvider();
    });

    test('filtering by supplemental materials on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringBySupplementalMaterials();
    });

    test('filtering by data on preprints tab', async ({ institutionPage }) => {
      skipOnTest4AndStage4();
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkFilteringByData(
        'section:has(h3:text-is("Public Data")) p:has-text("http")'
      );
    });

    test('filtering by preregistered analysis plan on preprints tab', async ({
      page,
      institutionPage,
    }) => {
      skipOnTest4AndStage4();
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkAdditionalFilterShownOnCard(
        page,
        institutionPage,
        'hasPreregisteredAnalysisPlan',
        'Preregistered analysis plan',
        'Associated preregistration'
      );
    });

    test('filtering by preregistered study design on preprints tab', async ({
      page,
      institutionPage,
    }) => {
      skipOnTest4AndStage4();
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkAdditionalFilterShownOnCard(
        page,
        institutionPage,
        'hasPreregisteredStudyDesign',
        'Preregistered study design',
        'Associated study design'
      );
    });

    test('clearing of applied filters on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkClearingOfAppliedFilters();
    });

    test('search card preprints', async ({ page, institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await verifyPreprintCard(page, new PreprintSearchResults(page));
    });

    test('sorting by created date on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await institutionPage.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.creatorDropdownMenu,
        institutionPage.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.dateCreatedMenu,
        institutionPage.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by subject on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.subjectMenu,
        institutionPage.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.licenseMenu,
        institutionPage.licenseMultiselectDropdown
      );
    });

    test('search in filtering by institution on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.institutionMenu,
        institutionPage.institutionMultiselectDropdown
      );
    });

    test('search in filtering by provider on preprints tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.preprintsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.providerMenu,
        institutionPage.providerMultiselectDropdown
      );
    });
  });

  // -------------------------------------------------------------------------------
  // TestInstitutionsPageRegistrationsTab (29 tests)
  // -------------------------------------------------------------------------------

  test.describe('Registrations Tab', () => {
    test('filtering by creator on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByCreator();
    });

    test('filtering by date created on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByDateCreated('Date registered');
    });

    test('filtering by subject on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringBySubject();
    });

    test('filtering by license on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByLicense();
    });

    test('filtering by institution on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByInstitution();
    });

    test('filtering by provider on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByProvider();
    });

    test('filtering by funder on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByFunder();
    });


    test('filtering by resource type on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByResourceType('StudyRegistration', {
        verifyOnCard: false,
      });
    });

    test('filtering by data on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByData('i[class*="custom-icon-data"]');
    });

    test('filtering by registration template on registrations tab', async ({
      page,
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.registrationTemplateMenu.click();
      await institutionPage.registrationTemplateMultiselectDropdown.click();
      if (!(await present(institutionPage.optionByIndex('1')))) {
        test.skip(true, 'Record was not found in the list');
      }
      const nameOfRecord = await institutionPage.getRecordName('1');
      const numberOfRecords = await institutionPage.getRecordCount('1');
      const resultCountBeforeFilter = await institutionPage.getResultsCount();
      await institutionPage.optionCheckboxByIndex('1').click({ force: true });
      await institutionPage.waitForResultsLoad();
      await institutionPage.expectFilterNarrowedResults(resultCountBeforeFilter, numberOfRecords);
      await institutionPage.chevronMenuFirstCard.click();
      const recordLocator = page.locator('p', { hasText: 'Registration Template' }).first();
      await expect(recordLocator).toContainText(nameOfRecord);
    });

    test('filtering by includes community on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByIncludesCommunitySchema();
    });

    test('filtering by analytic code on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByAdditionalOptions(
        'hasAnalyticCodeResource',
        'Analytic code',
        'i[class*="custom-icon-code"]'
      );
    });

    test('filtering by papers on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByAdditionalOptions(
        'hasPapersResource',
        'Papers',
        'i[class*="custom-icon-papers"]'
      );
    });

    test('filtering by supplemental resource on registrations tab', async ({
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByAdditionalOptions(
        'hasSupplementalResource',
        'Supplemental resource',
        'i[class*="custom-icon-supplements"]'
      );
    });

    test('filtering by materials on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkFilteringByAdditionalOptions(
        'hasMaterialsResource',
        'Materials',
        'i[class*="custom-icon-supplements"]'
      );
    });

    test('clearing of applied filters on registration tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkClearingOfAppliedFilters();
    });

    test('search card registrations', async ({ page, institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await verifyRegistrationCard(page, new RegistrationSearchResults(page));
    });

    test('sorting by created date on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkSortingByCreatedDate('registered');
    });

    test('sorting by modified date on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await institutionPage.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.creatorDropdownMenu,
        institutionPage.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on registrations tab', async ({
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.dateCreatedMenu,
        institutionPage.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.funderMenu,
        institutionPage.funderMultiselectDropdown
      );
    });

    test('search in filtering by subject on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.subjectMenu,
        institutionPage.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.licenseMenu,
        institutionPage.licenseMultiselectDropdown
      );
    });

    test('search in filtering by resource type on registrations tab', async ({
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.resourceTypeMenu,
        institutionPage.resourceTypeMultiselectDropdown
      );
    });

    test('search in filtering by institution on registrations tab', async ({
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.institutionMenu,
        institutionPage.institutionMultiselectDropdown
      );
    });

    test('search in filtering by community schema on registrations tab', async ({
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.includesCommunitySchemaMenu,
        institutionPage.includesCommunitySchemaMultiselectDropdown
      );
    });

    test('search in filtering by provider on registrations tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      if (!(await present(institutionPage.providerMenu))) {
        test.skip(true, 'Provider menu was not found on the page');
      }
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.providerMenu,
        institutionPage.providerMultiselectDropdown
      );
    });

    test('search in filtering by registration template on registrations tab', async ({
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.registrationsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.registrationTemplateMenu,
        institutionPage.registrationTemplateMultiselectDropdown
      );
    });
  });

  // -------------------------------------------------------------------------------
  // TestInstitutionsPageFilesTab (14 tests)
  // -------------------------------------------------------------------------------

  test.describe('Files Tab', () => {
    test('filtering by date created on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkFilteringByDateCreated('Date created');
    });

    test('filtering by funder on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkFilteringByFunder();
    });

    test('filtering by license on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkFilteringByLicense();
    });

    test('filtering by resource type on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkFilteringByResourceType('Book');
    });

    test('filtering by includes community on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkFilteringByIncludesCommunitySchema();
    });

    test('clearing of applied filters on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkClearingOfAppliedFilters();
    });

    test('sorting by created date on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await institutionPage.checkSortingByModifiedDate();
    });

    test('search card files', async ({ page, institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await verifyFileCard(page, new FileSearchResults(page), institutionPage.chevronMenuFirstCard);
    });

    test('search in filtering by date created on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.dateCreatedMenu,
        institutionPage.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.funderMenu,
        institutionPage.funderMultiselectDropdown
      );
    });

    test('search in filtering by license on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.licenseMenu,
        institutionPage.licenseMultiselectDropdown
      );
    });

    test('search in filtering by community schema on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.includesCommunitySchemaMenu,
        institutionPage.includesCommunitySchemaMultiselectDropdown
      );
    });

    test('search in filtering by resource type on files tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.filesTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.resourceTypeMenu,
        institutionPage.resourceTypeMultiselectDropdown
      );
    });
  });

  // -------------------------------------------------------------------------------
  // TestInstitutionsPageProjectsTab (22 tests)
  // -------------------------------------------------------------------------------

  test.describe('Projects Tab', () => {
    test('filtering by creator on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByCreator();
    });

    test('filtering by date created on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByDateCreated('Date created');
    });

    test('filtering by funder on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByFunder();
    });

    test('filtering by subject on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringBySubject('1');
    });

    test('filtering by license on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByLicense();
    });

    test('filtering by institution on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByInstitution();
    });

    test('filtering by part of collection on projects tab', async ({ institutionPage }) => {
      skipOnTest4AndStage4();
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByPartOfCollection();
    });

    test('filtering by includes community schema on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByIncludesCommunitySchema();
    });

    test('filtering by associated preprint on projects tab', async ({ page, institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.additionalFiltersMenu.click();
      const additionalOption = page.locator('input#checkbox-supplements');
      if (!(await present(additionalOption))) {
        test.skip(true, 'Record was not found in the list');
      }
      const numberOfRecords = await institutionPage.getRecordCountForAdditionalFilters(
        'Associated preprint'
      );
      const resultCountBeforeFilter = await institutionPage.getResultsCount();
      await additionalOption.click();
      await institutionPage.waitForResultsLoad();
      await institutionPage.expectFilterNarrowedResults(resultCountBeforeFilter, numberOfRecords);
      const popup = await clickExpectingPopup(page, institutionPage.firstSearchResultTitle);
      await expect(
        popup.locator('osf-overview-supplements p', { hasText: 'Preprints' }).first()
      ).toBeVisible();
    });

    test('clearing of applied filters on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkClearingOfAppliedFilters();
    });

    test('filtering by resource type on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkFilteringByResourceType('Book');
    });

    test('sorting by created date on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkSortingByCreatedDate('created');
    });

    test('sorting by modified date on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await institutionPage.checkSortingByModifiedDate();
    });

    test('search in filtering by creator on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.creatorDropdownMenu,
        institutionPage.additionalMultiselectDropdown
      );
    });

    test('search in filtering by date created on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.dateCreatedMenu,
        institutionPage.dateCreatedMultiselectDropdown
      );
    });

    test('search in filtering by funder on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.funderMenu,
        institutionPage.funderMultiselectDropdown
      );
    });

    test('search in filtering by subject on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.subjectMenu,
        institutionPage.subjectMultiselectDropdown
      );
    });

    test('search in filtering by license on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.licenseMenu,
        institutionPage.licenseMultiselectDropdown
      );
    });

    test('search in filtering by resource type on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.resourceTypeMenu,
        institutionPage.resourceTypeMultiselectDropdown
      );
    });

    test('search in filtering by institution on projects tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.institutionMenu,
        institutionPage.institutionMultiselectDropdown
      );
    });

    test('search in filtering by part of collection on projects tab', async ({
      institutionPage,
    }) => {
      skipOnTest4AndStage4();
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.partOfCollectionMenu,
        institutionPage.partOfCollectionMultiselectDropdown
      );
    });

    test('search in filtering by community schema on projects tab', async ({
      institutionPage,
    }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await checkSearchInFilteringOptionsFor(
        institutionPage,
        institutionPage.includesCommunitySchemaMenu,
        institutionPage.includesCommunitySchemaMultiselectDropdown
      );
    });

    test('search card projects', async ({ page, institutionPage }) => {
      await institutionPage.openTab(institutionPage.projectsTabLink);
      await verifyProjectCard(page, new ProjectSearchResults(page));
    });
  });

  // -------------------------------------------------------------------------------
  // TestInstitutionsPageUsersTab (6 tests)
  // -------------------------------------------------------------------------------

  test.describe('Users Tab', () => {
    // User cards show no dates (see `search.spec.ts`'s Users Tab), so these check that
    // each sort option sends the matching SHARE `sort` request and the results reload.
    test('sorting by created date on users tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.usersTabLink);
      await institutionPage.applySort(institutionPage.sortByDateCreatedNewest, '-dateCreated');
      await institutionPage.applySort(institutionPage.sortByDateCreatedOldest, 'dateCreated');
    });

    test('sorting by modified date on users tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.usersTabLink);
      await institutionPage.applySort(institutionPage.sortByDateModifiedNewest, '-dateModified');
      await institutionPage.applySort(institutionPage.sortByDateModifiedOldest, 'dateModified');
    });

    test('search results exist on users tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.usersTabLink);
      expect(await institutionPage.searchResults.count()).toBeGreaterThan(0);
      await expect(institutionPage.firstCardObjectTypeLabel).toHaveText('User');
    });

    test('filtering on users tab', async ({ institutionPage }) => {
      await institutionPage.openTab(institutionPage.usersTabLink);
      await institutionPage.institutionAffiliationMenu.click();
      await institutionPage.additionalMultiselectDropdown.click();
      if (!(await present(institutionPage.optionByIndex('1')))) {
        test.skip(true, 'Record was not found in the list');
      }
      const nameOfInstitution = await institutionPage.getRecordName('1');
      const numberOfUsers = await institutionPage.getRecordCount('1');
      await institutionPage.optionByIndex('1').click();
      await institutionPage.waitForResultsLoad();
      const resultCountAfterFilterApplying = await institutionPage.getResultsCount();
      expect(resultCountAfterFilterApplying).toBe(numberOfUsers);
      await institutionPage.expectEveryResultCardToContain(nameOfInstitution);
    });

    test('clearing of applied filters on users tab', async ({ page, institutionPage }) => {
      await institutionPage.openTab(institutionPage.usersTabLink);
      const resultCountWithoutFilter = await institutionPage.getResultsCount();
      await institutionPage.institutionAffiliationMenu.click();
      await institutionPage.additionalMultiselectDropdown.click();
      await institutionPage.optionByIndex('2').click();
      await institutionPage.waitForResultsLoad();
      const resultCountAfterFilterApplying = await institutionPage.getResultsCount();
      expect(resultCountAfterFilterApplying).not.toBe(resultCountWithoutFilter);
      await page.locator('span.p-chip-remove-icon').click();
      await expect
        .poll(() => institutionPage.getResultsCount(), { timeout: settings.LONG_TIMEOUT_MS })
        .toBe(resultCountWithoutFilter);
    });

    test('search card users', async ({ page, institutionPage }) => {
      await institutionPage.openTab(institutionPage.usersTabLink);
      await verifyUserCard(page, new UserSearchResults(page));
    });
  });
});

// -------------------------------------------------------------------------------
// TestInstitutionLandingPages (parametrized per institution in Python)
// -------------------------------------------------------------------------------

// Fetched while tests are collected. Caught here: an error thrown at load time would
// stop Playwright from loading this file and abort the whole run.
let institutionIds: string[] = [];
let institutionIdsError: Error | undefined;
try {
  institutionIds = osfApi.getAllInstitutionIdsSync();
} catch (error) {
  institutionIdsError = error as Error;
}

// Up to three throttle waits (up to 180s each) plus the normal per-test budget.
const LANDING_PAGE_TIMEOUT_MS = 3 * 180000 + settings.VERY_LONG_TIMEOUT_MS;

test.describe('Institution Landing Pages', { tag: ['@core'] }, () => {

  test.beforeEach(async () => {
    test.setTimeout(LANDING_PAGE_TIMEOUT_MS);
  });

  test.afterAll(async () => {
    test.setTimeout(LANDING_PAGE_TIMEOUT_MS);
    await osfApi.waitForApiThrottleToClear();
  });

  if (institutionIdsError) {
    test('institution landing pages', () => {
      throw institutionIdsError;
    });
  }

  // One test per institution, like pytest's `@pytest.mark.parametrize('institution',
  // institutions())` - the list comes from the API while tests are collected.
  for (const institutionId of institutionIds) {
    test(`institution landing page [${institutionId}]`, async ({ page }) => {
      const institutionPage = new InstitutionBrandedPage(page, institutionId);
      const namedHeading = institutionPage.institutionName.filter({ hasText: /\S/ });

      const institutionResponses: Response[] = [];
      page.on('response', (response) => {
        if (response.url().startsWith(`${settings.API_DOMAIN}/v2/institutions/${institutionId}/`)) {
          institutionResponses.push(response);
        }
      });
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        institutionResponses.length = 0;
        await institutionPage.goto();
        await institutionPage.verify();
        if (await present(namedHeading, settings.QUICK_TIMEOUT_MS * 3)) break;
        const throttled = institutionResponses.at(-1);
        if (throttled?.status() !== 429) break;
        // The API's own Retry-After, not a guessed delay.
        const retryAfter = Number(throttled.headers()['retry-after']) || 60;
        await page.waitForTimeout((Math.min(retryAfter, 180) + 1) * 1000);
      }
      // `osf-institutions-search` renders even for an id that doesn't exist (verified
      // live), so require the institution's name in the heading as well.
      await expect(institutionPage.institutionName).toHaveText(/\S/);
    });
  }
});
