import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { createSession } from '../src/api/session';
import { RegistriesLandingPage } from '../src/pages/BrowsePages';
import { Navbar } from '../src/pages/components/Navbar';
import { FileDetailPage } from '../src/pages/FileDetailPage';
import { safeLogin } from '../src/pages/LoginPage';
import {
  DraftRegistrationMetadataPage,
  DraftRegistrationReviewPage,
  DraftRegistrationSummaryPage,
  RegistrationAddNewPage,
  RegistriesDiscoverPage,
} from '../src/pages/RegistriesPage';
import { RegistrationFilesListPage, RegistrationPage, registrationUrl } from '../src/pages/RegistrationPage';
import { SearchPage } from '../src/pages/SearchPage';
import { clickExpectingDownload, clickExpectingPopup, clickExpectingPopupByHref } from '../src/utils';
import {
  MODIFIED_ASCENDING,
  MODIFIED_DESCENDING,
  NAME_A_TO_Z,
  NAME_Z_TO_A,
  checkDownloadAsZip,
  checkFileDownload,
  checkSort,
} from '../src/utils/registrationFiles';



const FILES_TITLE = 'Selenium Registration to Test Files Page';

const test = base.extend<{
  draftRegistration: string;
  filesRegistrationGuid: string;
  registrationFilesPage: RegistrationFilesListPage;
}>({

  draftRegistration: async ({ session }, use) => {
    const schemas = await osfApi.getRegistrationSchemasForProvider(session, 'osf');
    const schema = schemas.find(([name]) => name === 'Open-Ended Registration');
    if (!schema) throw new Error("No 'Open-Ended Registration' schema for the osf registry.");
    const draftId = await osfApi.createDraftRegistrationWithoutProject(session, schema[1]);
    await use(draftId);
    await osfApi.deleteDraftRegistration(session, draftId).catch((error) => {
      console.error('\n=== CLEANUP FAILED (IGNORED) ===');
      console.error(`Error: ${error}`);
    });
  },

  filesRegistrationGuid: async ({}, use) => {
    const guid = await osfApi.getRegistrationByTitle(FILES_TITLE);
    if (!guid) throw new Error(`Registration with title '${FILES_TITLE}' not found on the server.`);
    await use(guid);
  },

  /** Port of `registration_files_page`; logs in first (the class's `must_be_logged_in_as_registration_user`). */
  registrationFilesPage: async (
    { page, filesRegistrationGuid, mustBeLoggedInAsRegistrationUser, hideMetadataFeaturePopover },
    use
  ) => {
    void mustBeLoggedInAsRegistrationUser;
    void hideMetadataFeaturePopover;
    await page.goto(registrationUrl(filesRegistrationGuid, 'files'));
    await use(await RegistrationFilesListPage.expectOn(page));
  },
});

test.describe('Registries Search', { tag: ['@smoke', '@core'] }, () => {
  test('search results exist', async ({ page }) => {
    const landingPage = new RegistriesLandingPage(page);
    await landingPage.goto();
    await landingPage.verify(settings.LONG_TIMEOUT_MS);


    const navbar = new Navbar(page);
    await navbar.registriesHeader.click();
    await navbar.registriesDiscoverItem.click();
    await landingPage.verify(settings.LONG_TIMEOUT_MS);
    await landingPage.searchBox.fill('QA Test');

    // The landing page's search now routes to the OSF Search page (Registrations tab).
    const searchPage = new SearchPage(page);
    await searchPage.waitForResults(() => landingPage.searchBox.press('Enter'));
    await searchPage.verify();
    await expect(searchPage.searchInput).toHaveValue('QA Test');
    await expect(searchPage.searchResults.first()).toBeVisible();
    await expect(searchPage.firstCardObjectTypeLabel).toHaveText(/^\s*Registration/);
  });

  test('detail page', async ({ page, hideMetadataFeaturePopover }) => {
    void hideMetadataFeaturePopover;
    const searchPage = new SearchPage(page);
    await searchPage.goto();
    await searchPage.verify();
    await searchPage.openTab(searchPage.registrationsTabLink);

    if (!settings.PRODUCTION) {
      // Newest first, to avoid old registrations not converted to the new templates.
      await searchPage.applySort(searchPage.sortByDateCreatedNewest, '-dateCreated');
    }
    await searchPage.searchInput.fill('test');
    await searchPage.waitForResults(() => searchPage.searchInput.press('Enter'));
    await expect(searchPage.searchResults.first()).toBeVisible();

 
    const titleLink = searchPage.firstSearchResultTitle;
    const targetTitle = ((await titleLink.textContent()) ?? '').trim();
    const popup = await clickExpectingPopupByHref(page, titleLink, await titleLink.getAttribute('href'));
    try {
      const detailPage = await RegistrationPage.expectOn(popup, settings.LONG_TIMEOUT_MS);
      const detailTitle = ((await detailPage.title.textContent()) ?? '').trim();
      expect(detailTitle).not.toBe('');
      expect(targetTitle).toContain(detailTitle);
    } finally {
      await popup.close();
    }
  });
});


let providers: osfApi.RegistrationProvider[] = [];
let providersError: Error | undefined;
try {
  providers = osfApi.getRegistrationProvidersSync();
} catch (error) {
  providersError = error as Error;
}

test.describe('Branded Registries Pages', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ throttleOnProd }) => {
    void throttleOnProd;
  });

  if (providersError) {
    test('discover page', () => {
      throw providersError;
    });
  }

  for (const provider of providers) {
    test(`discover page [${provider.id}]`, async ({ page }) => {

      test.skip(!provider.brandedDiscoveryPage, `${provider.id} has no branded discovery page`);

      const discoverPage = new RegistriesDiscoverPage(page, provider.id);
      await discoverPage.goto();
      await discoverPage.verify(settings.LONG_TIMEOUT_MS);

      const providerId = provider.id.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      await expect(page, `Expected provider id '${provider.id}' to be in the URL`).toHaveURL(
        new RegExp(providerId, 'i')
      );
      await expect(page).toHaveURL(/registries\//);
    });
  }
});

test.describe('Draft Registration', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('subjects sort order', async ({ page, mustBeLoggedIn, draftRegistration }) => {
    void mustBeLoggedIn;
    const metadataPage = new DraftRegistrationMetadataPage(page, draftRegistration);
    await metadataPage.goto();
    await metadataPage.verify(settings.LONG_TIMEOUT_MS);

    await expect(metadataPage.topLevelSubjects.first()).toBeVisible();
    const subjects = await DraftRegistrationMetadataPage.readSubjectNames(metadataPage.topLevelSubjects);
    expect(subjects.length, 'need at least two subjects to check sorting').toBeGreaterThan(1);
    expect(subjects).toEqual([...subjects].sort());

    await metadataPage.expandFirstSubjectButton.click();
    await expect(metadataPage.firstSubjectSecondLevelSubjects.first()).toBeVisible();
    const secondLevel = await DraftRegistrationMetadataPage.readSubjectNames(
      metadataPage.firstSubjectSecondLevelSubjects
    );
    expect(secondLevel).toEqual([...secondLevel].sort());
  });
});

test.describe('Registration Submission', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });


  test('submit no project registration', async ({ page }) => {
    test.skip(true, 'Schema are different on different environments');
    test.setTimeout(settings.VERY_LONG_TIMEOUT_MS * 3);

    const registrationUserSession = await createSession(
      settings.REGISTRATIONS_USER,
      settings.REGISTRATIONS_USER_PASSWORD
    );
    try {
      await safeLogin(page, settings.REGISTRATIONS_USER, settings.REGISTRATIONS_USER_PASSWORD);
      const addNewPage = new RegistrationAddNewPage(page);
      await addNewPage.goto();
      await addNewPage.verify(settings.LONG_TIMEOUT_MS);

      // "No" (no existing project) is selected by default, so there's no Project select.
      await expect(addNewPage.projectDropdown).toHaveCount(0);

      await addNewPage.schemaDropdown.click();
      await addNewPage.selectOption('Open-Ended Registration');
      await addNewPage.researchPlanConfirmCheckbox.check();
      await addNewPage.createDraftButton.click();

      const metadataPage = await DraftRegistrationMetadataPage.expectOn(page, settings.LONG_TIMEOUT_MS);
      await metadataPage.titleInput.fill('Selenium Test No Project Registration');
      await metadataPage.descriptionInput.fill('This is a test registration created using Selenium.');
      await metadataPage.licenseDropdown.click();
      await metadataPage.selectOption('CC0 1.0 Universal');
      await metadataPage.selectTopLevelSubject('Engineering');
      await expect(metadataPage.selectedSubject('Engineering')).toHaveText('Engineering');
      await metadataPage.tagInput.fill('selenium');
      await metadataPage.tagInput.press('Enter');
      await metadataPage.nextPageButton.click();

      const summaryPage = await DraftRegistrationSummaryPage.expectOn(page, settings.LONG_TIMEOUT_MS);
      await expect(summaryPage.pageHeading).toHaveText('Summary');
      await summaryPage.summaryTextbox.fill('Test summary AQA');
      await summaryPage.nextPageButton.click();

      const reviewPage = await DraftRegistrationReviewPage.expectOn(page, settings.LONG_TIMEOUT_MS);
      await expect(reviewPage.title).toHaveText('Selenium Test No Project Registration');
      await expect(reviewPage.description).toHaveText('This is a test registration created using Selenium.');
      await expect(reviewPage.license).toHaveText('CC0 1.0 Universal');
      await expect(reviewPage.subject).toHaveText('Engineering');
      await expect(reviewPage.tags).toHaveText('selenium');

      await reviewPage.registerButton.click();
      // Make the registration public immediately.
      await reviewPage.immediateRadioButton.check();
      await reviewPage.submitButton.click();


      await page.waitForURL((url) => !url.pathname.includes('/registries/'), {
        timeout: settings.VERY_LONG_TIMEOUT_MS,
      });
      const guid = new URL(page.url()).pathname.split('/')[1];
      await osfApi.deleteProject(registrationUserSession, guid).catch((error) => {
        console.error('\n=== CLEANUP FAILED (IGNORED) ===');
        console.error(`Error: ${error}`);
      });
    } finally {
      await registrationUserSession.dispose();
    }
  });
});

test.describe('Registration Files Pages', { tag: '@core' }, () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('files list page', async ({ registrationFilesPage }) => {
    await registrationFilesPage.openArchive();
    // `searchFor` waits for the file's row to show.
    await registrationFilesPage.searchFor('aaa_selenium.txt');
  });

  test('file detail page', async ({ page, registrationFilesPage }) => {
    test.skip(true, 'ENG-9640');
    const fileName = 'aaa_selenium.txt';

    await registrationFilesPage.openArchive();
    await registrationFilesPage.searchFor(fileName);
    // The file name opens its detail page in a new tab.
    const popup = await clickExpectingPopup(page, registrationFilesPage.fileLink(fileName));
    try {
      const fileDetailPage = await FileDetailPage.expectOn(popup);
      await expect(fileDetailPage.fileRenderer).toBeVisible();

      const fileTitle = ((await fileDetailPage.fileTitle.textContent()) ?? '').trim();
      const download = await clickExpectingDownload(popup, fileDetailPage.downloadButton);
      expect(download.suggestedFilename()).toBe(fileTitle);

      await fileDetailPage.revisionsTab.click();
      await fileDetailPage.firstRevisionToggleButton.click();

      await expect(fileDetailPage.copyMd5Button).toBeVisible();
      await expect(fileDetailPage.copySha2Button).toBeVisible();

      await fileDetailPage.keywordsTab.click();
      const timestamp = new Date().toISOString();
      await fileDetailPage.tagInput.fill(timestamp);
      await fileDetailPage.tagInput.press('Enter');
      await expect(fileDetailPage.tag(timestamp)).toBeVisible();
    } finally {
      await popup.close();
    }
  });

  test('file download', async ({ page, registrationFilesPage }) => {
    await checkFileDownload(page, registrationFilesPage);
  });

  test('download as zip', async ({ page, registrationFilesPage, filesRegistrationGuid }) => {
    await checkDownloadAsZip(page, registrationFilesPage, filesRegistrationGuid);
  });

  test('sort name a to z', async ({ registrationFilesPage }) => {
    await checkSort(registrationFilesPage, NAME_A_TO_Z);
  });

  test('sort name z to a', async ({ registrationFilesPage }) => {
    await checkSort(registrationFilesPage, NAME_Z_TO_A);
  });

  test('sort modified date descending', async ({ registrationFilesPage }) => {
    await checkSort(registrationFilesPage, MODIFIED_DESCENDING);
  });

  test('sort modified date ascending', async ({ registrationFilesPage }) => {
    await checkSort(registrationFilesPage, MODIFIED_ASCENDING);
  });
});
