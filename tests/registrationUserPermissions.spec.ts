import { Page } from '@playwright/test';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { FileDetailPage } from '../src/pages/FileDetailPage';
import {
  RegistrationContributorsPage,
  RegistrationFilesListPage,
  RegistrationMetadataPage,
  registrationUrl,
} from '../src/pages/RegistrationPage';
import {
  clickExpectingDownload,
  clickExpectingPopup,
  generateAwardInformation,
  waitForApiWrite,
} from '../src/utils';


const METADATA_TITLE = 'Selenium Registration To Test Metadata User Permissions';
const CONTRIBUTORS_TITLE = 'Selenium Registration to Test Contributors Page';
const FILES_TITLE = 'Selenium Registration to Test Files Page';

const ADMIN_CONTRIBUTOR = 'OSF Selenium Registrations';
const WRITE_CONTRIBUTOR = 'OSF Runscope Write';
const READ_CONTRIBUTOR = 'OSF Runscope Read';

async function findRegistration(title: string): Promise<string> {
  const guid = await osfApi.getRegistrationByTitle(title);
  if (!guid) throw new Error(`Registration with title '${title}' not found on the server.`);
  return guid;
}

type PermissionFixtures = {
  registrationGuid: string;
  registrationMetadataPage: RegistrationMetadataPage;
  contributorsRegistrationGuid: string;
  registrationContributorsPage: RegistrationContributorsPage;
  filesRegistrationGuid: string;
  registrationFilesPage: RegistrationFilesListPage;
};

const test = base.extend<PermissionFixtures>({
  registrationGuid: async ({}, use) => {
    await use(await findRegistration(METADATA_TITLE));
  },

  registrationMetadataPage: async ({ page, registrationGuid }, use) => {
    await osfApi.updateRegistrationMetadataWithCustomData(registrationGuid);
    await page.goto(registrationUrl(registrationGuid, 'metadata/osf'));
    const metadataPage = new RegistrationMetadataPage(page);
    await metadataPage.verify();
    await use(metadataPage);
  },

  contributorsRegistrationGuid: async ({}, use) => {
    await use(await findRegistration(CONTRIBUTORS_TITLE));
  },

  registrationContributorsPage: async ({ page, contributorsRegistrationGuid }, use) => {
    await page.goto(registrationUrl(contributorsRegistrationGuid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();
    await use(contributorsPage);
  },

  filesRegistrationGuid: async ({}, use) => {
    await use(await findRegistration(FILES_TITLE));
  },

  registrationFilesPage: async ({ page, filesRegistrationGuid }, use) => {
    await page.goto(registrationUrl(filesRegistrationGuid, 'files'));
    const filesPage = new RegistrationFilesListPage(page);
    await filesPage.verify();
    await use(filesPage);
  },
});

async function reloadMetadataPage(metadataPage: RegistrationMetadataPage, page: Page): Promise<void> {
  await page.reload();
  await metadataPage.verify();
}

// ---------- Metadata page ----------

async function expectMetadataIsReadOnly(metadataPage: RegistrationMetadataPage): Promise<void> {
  for (const section of [
    'Title',
    'Description',
    'Contributors',
    'Subjects',
    'Resource Information',
    'Funding/Support Information',
    'Affiliated Institutions',
    'Tags',
  ]) {
    await expect(metadataPage.section(section)).toBeVisible();
  }
  await expect(metadataPage.licenseInfo).toBeVisible();
  await expect(metadataPage.section('Contributors').getByRole('link').first()).toBeVisible();

  await expect(metadataPage.editButtons).toHaveCount(0);
}

// ---------- Contributors page ----------

function contributorNames(contributorsPage: RegistrationContributorsPage) {
  return contributorsPage.tableRows.locator('td p a');
}

async function readContributors(contributorsPage: RegistrationContributorsPage): Promise<string[]> {
  return (await contributorsPage.getContributorsList()).map((name) => name.trim());
}


async function checkPermissionFilters(contributorsPage: RegistrationContributorsPage): Promise<void> {
  await contributorsPage.selectPermissionFilterFromDropdownList('Administrator');
  await expect.poll(() => readContributors(contributorsPage)).toContain(ADMIN_CONTRIBUTOR);

  await contributorsPage.selectPermissionFilterFromDropdownList('Read');
  await expect.poll(() => readContributors(contributorsPage)).toContain(READ_CONTRIBUTOR);
  expect(await readContributors(contributorsPage)).not.toContain(ADMIN_CONTRIBUTOR);

  await contributorsPage.selectPermissionFilterFromDropdownList('Read + Write');
  await expect.poll(() => readContributors(contributorsPage)).toContain(WRITE_CONTRIBUTOR);
  expect(await readContributors(contributorsPage)).not.toContain(ADMIN_CONTRIBUTOR);
}

async function checkBibliographicFilters(
  page: Page,
  contributorsPage: RegistrationContributorsPage
): Promise<void> {
  // All three contributors are bibliographic.
  await expect(contributorNames(contributorsPage)).toHaveCount(3);
  await contributorsPage.selectBibliographyFilterFromDropdownList('Bibliographic');
  await expect(contributorNames(contributorsPage)).toHaveCount(3);

  await page.reload();
  await contributorsPage.verify();
  await expect(contributorNames(contributorsPage)).toHaveCount(3);
  await contributorsPage.selectBibliographyFilterFromDropdownList('Non-Bibliographic');
  await expect(contributorsPage.tableRows.getByText('No contributors found.')).toBeVisible();
  await expect(contributorNames(contributorsPage)).toHaveCount(0);
}

async function checkContributorSearch(
  contributorsPage: RegistrationContributorsPage,
  contributorName: string
): Promise<void> {
  await contributorsPage.searchFor(contributorName);
  expect(await readContributors(contributorsPage)).toContain(contributorName);
}


async function checkNonEditableFunctions(contributorsPage: RegistrationContributorsPage): Promise<void> {
  await expect(contributorNames(contributorsPage)).toHaveCount(3);

  await expect(contributorsPage.addContributorButton).toHaveCount(0);
  await expect(contributorsPage.tableRows.getByRole('combobox')).toHaveCount(0);

  const checkboxes = contributorsPage.bibliographicCheckboxes;
  await expect(checkboxes).toHaveCount(3);
  for (const checkbox of await checkboxes.all()) {
    await expect(checkbox).toBeDisabled();
  }
}

// ---------- Files page ----------

async function checkFileDetailPage(
  page: Page,
  filesPage: RegistrationFilesListPage,
  filesRegistrationGuid: string
): Promise<void> {
  const fileName = 'aaa_selenium.txt';

  await filesPage.openArchive();
  await filesPage.searchFor(fileName);
  // The file name opens its detail page in a new tab.
  const popup = await clickExpectingPopup(page, filesPage.fileLink(fileName));
  try {
    const fileDetailPage = await FileDetailPage.expectOn(popup);
    await expect(fileDetailPage.fileRenderer).toBeVisible();
    // The heading is `text-transform: capitalize`d (Python lowercased its innerText); its text isn't.
    await expect(fileDetailPage.fileTitle).toHaveText(fileName);

    const download = await clickExpectingDownload(popup, fileDetailPage.downloadButton);
    expect(download.suggestedFilename()).toBe(fileName);

    await fileDetailPage.backToFilesLink.click();
    await popup.goto(registrationUrl(filesRegistrationGuid, 'files'));
    const filesPageInPopup = await RegistrationFilesListPage.expectOn(popup);
    await expect(filesPageInPopup.filesPageText).toHaveText('Files');
  } finally {
    await popup.close();
  }
}

async function checkFileDownload(page: Page, filesPage: RegistrationFilesListPage): Promise<void> {
  const fileName = 'download_file_for_registration.txt';

  await filesPage.openArchive();
  await filesPage.searchFor(fileName);
  await filesPage.fileMenuButton(fileName).click();
  const download = await clickExpectingDownload(page, filesPage.menuItem('Download'));
  expect(download.suggestedFilename()).toBe(fileName);
}

async function checkDownloadAsZip(
  page: Page,
  filesPage: RegistrationFilesListPage,
  filesRegistrationGuid: string
): Promise<void> {
  const archiveName = (await filesPage.archiveLink.innerText()).trim();
  const zipName = `${filesRegistrationGuid}-osfstorage-${archiveName}-archive.zip`;

  await filesPage.openArchive();
  const download = await clickExpectingDownload(page, filesPage.downloadAsZipButton);
  expect(download.suggestedFilename()).toBe(zipName);
}

type SortCase = {
  /** The option the test checks. */
  sort: string;
  /** Picked first when `sort` is already the current option (A-Z on load) - re-picking it sends no request. */
  opposite: string;
  column: 'name' | 'modified';
  order: 'asc' | 'desc';
};

const NAME_A_TO_Z: SortCase = { sort: 'Name: A-Z', opposite: 'Name: Z-A', column: 'name', order: 'asc' };

const NAME_Z_TO_A: SortCase = { sort: 'Name: Z-A', opposite: 'Name: A-Z', column: 'name', order: 'desc' };

const MODIFIED_DESCENDING: SortCase = {
  sort: 'Last modified: oldest to newest',
  opposite: 'Last modified: newest to oldest',
  column: 'modified',
  order: 'asc',
};
const MODIFIED_ASCENDING: SortCase = {
  sort: 'Last modified: newest to oldest',
  opposite: 'Last modified: oldest to newest',
  column: 'modified',
  order: 'desc',
};

/** Returns null when the rows are in `sortCase`'s order, otherwise what's wrong. */
function findSortProblem(rows: Array<{ name: string; modified: string }>, sortCase: SortCase): string | null {
  if (rows.length < 2) return `need at least 2 files to check sorting, found ${rows.length}`;
  const values: Array<string | number> = [];
  for (const row of rows) {
    if (sortCase.column === 'name') {
      values.push(row.name.toLowerCase()); // Python's `sorted(key=str.lower)`
    } else {
      const time = Date.parse(row.modified);
      if (Number.isNaN(time)) return `"${row.name}" has no parseable modified date: "${row.modified}"`;
      values.push(time);
    }
  }
  for (let i = 1; i < values.length; i++) {
    const outOfOrder = sortCase.order === 'asc' ? values[i - 1] > values[i] : values[i - 1] < values[i];
    if (outOfOrder) {
      return `"${rows[i - 1].name}" is listed before "${rows[i].name}": ${rows
        .map((row) => `${row.name} (${row.modified})`)
        .join(', ')}`;
    }
  }
  return null;
}

async function checkSort(filesPage: RegistrationFilesListPage, sortCase: SortCase): Promise<void> {
  await filesPage.openArchive();
  if ((await filesPage.sortDropdown.innerText()).trim() === sortCase.sort) {
    await filesPage.selectSortFromList(sortCase.opposite);
  }
  await filesPage.selectSortFromList(sortCase.sort);
  await expect
    .poll(async () => findSortProblem(await filesPage.readRows(), sortCase), {
      message: `files should be sorted by "${sortCase.sort}"`,
    })
    .toBeNull();
}

// ---------- Tests ----------

test.describe('Registration User Permissions', { tag: '@core' }, () => {
  test.beforeEach(async ({ hideMetadataFeaturePopover }) => {
    void hideMetadataFeaturePopover;
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test.describe('Metadata write permissions', () => {
    test.beforeEach(async ({ mustBeLoggedInAsWriteUser }) => {
      void mustBeLoggedInAsWriteUser;
    });

    test('write user edit metadata title and description', async ({
      registrationMetadataPage,
      registrationGuid,
      fake,
    }) => {
      const newTitle = 'Selenium Registration for Metadata tests -Write User';
      const newDescription = fake.lorem.sentence(4);

      try {
        await registrationMetadataPage.clickOnEdit('Title');
        await registrationMetadataPage.titleInput.fill(newTitle);
        await registrationMetadataPage.saveMetadataTitleButton.click();
        await expect(registrationMetadataPage.metadataTitle).toHaveText(newTitle);

        await registrationMetadataPage.clickOnEdit('Description');
        await registrationMetadataPage.descriptionInput.fill(newDescription);
        await registrationMetadataPage.saveMetadataDescriptionButton.click();
        await expect(registrationMetadataPage.metadataDescription).toHaveText(newDescription);
        await expect(registrationMetadataPage.metadataTitle).toHaveText(newTitle);
      } finally {
        await osfApi.updateRegistrationTitle(registrationGuid, METADATA_TITLE).catch((error) => {
          console.error('\n=== CLEANUP FAILED (IGNORED) ===');
          console.error(`Error: ${error}`);
        });
      }
    });

    test('write user metadata edit contributors', async ({ page, registrationMetadataPage }) => {
      await reloadMetadataPage(registrationMetadataPage, page);
      await registrationMetadataPage.clickOnEdit('Contributors');
      const modal = registrationMetadataPage.editContributorsModal;
      // Wait for the rows, so the zero-counts below can't pass on an empty dialog.
      await expect(modal.tableRows.first()).toBeVisible();

      await expect(modal.addContributorButton).toHaveCount(0);
      await expect(modal.tableRows.getByRole('combobox')).toHaveCount(0);
      await modal.clickOnButton('Close');
    });

    test('write user edit resource information', async ({ registrationMetadataPage }) => {
      const origResourceType = await registrationMetadataPage.resourceType.innerText();
      const origResourceLanguage = await registrationMetadataPage.resourceLanguage.innerText();

      await registrationMetadataPage.clickOnEdit('Resource Information');
      await registrationMetadataPage.resourceTypeDropdown.click();
      await registrationMetadataPage.selectOption('Book');
      await registrationMetadataPage.resourceLanguageDropdown.click();
      // Python's `select_by_search` - the select's filter box is broken in the app (see `selectFromVirtualScrollList`).
      await registrationMetadataPage.selectFromVirtualScrollList('Achinese');
      await registrationMetadataPage.resourceInformationSaveButton.click();

      await expect(registrationMetadataPage.resourceType).not.toHaveText(origResourceType);
      await expect(registrationMetadataPage.resourceLanguage).not.toHaveText(origResourceLanguage);
    });

    test('write user edit support funding information', async ({
      registrationMetadataPage,
      registrationGuid,
      fake,
    }) => {
      const funderName = 'National Institutes of Health';
      const { awardTitle, awardUri, awardNumber } = generateAwardInformation(fake);

      await registrationMetadataPage.clickOnEdit('Funding/Support Information');
      const funderInfo = await osfApi.getFunderDataRegistration(registrationGuid);
      if (funderInfo !== null) {
        // Removing the only funder entry closes the dialog, so reopen it (as Python does).
        await registrationMetadataPage.removeFunderButtons.first().click();
        await expect(registrationMetadataPage.fundingDialog).toBeHidden();
        await registrationMetadataPage.clickOnEdit('Funding/Support Information');
      }

      await registrationMetadataPage.funderName().click();
      await registrationMetadataPage.selectBySearch(funderName);
      await registrationMetadataPage.awardTitle().fill(awardTitle);
      await registrationMetadataPage.awardInfoUri().fill(awardUri);
      await registrationMetadataPage.awardNumber().fill(awardNumber);
      await registrationMetadataPage.addFunderButton.click();
      await registrationMetadataPage.removeFunderButtons.nth(1).click();
      await registrationMetadataPage.saveFunderInfoButton.click();

      await expect(registrationMetadataPage.displayFunderName).toContainText(funderName);
      await expect(registrationMetadataPage.displayAwardTitle).toContainText(awardTitle);
      await expect(registrationMetadataPage.displayAwardNumber).toContainText(awardNumber);
      await expect(registrationMetadataPage.displayAwardInfoUri).toContainText(awardUri);
    });

    test('write user add affiliation', async ({ page, registrationMetadataPage }) => {
      const institutionId = 'cos';

      await expect(registrationMetadataPage.section('Affiliated Institutions')).toBeVisible();
      expect(await registrationMetadataPage.getAffiliationsList()).not.toContain(institutionId);

      await registrationMetadataPage.clickOnEdit('Affiliated Institutions');
      await registrationMetadataPage.editAffiliationsModal.clickOnCheckbox(institutionId);
      await waitForApiWrite(page, () =>
        registrationMetadataPage.editAffiliationsModal.saveAffiliationsButton.click()
      );
      await reloadMetadataPage(registrationMetadataPage, page);

      await expect
        .poll(() => registrationMetadataPage.getAffiliationsList())
        .toContain(institutionId);
    });

    test('write user remove affiliation', async ({ page, registrationMetadataPage }) => {
      const institutionId = 'cos';

      await expect
        .poll(() => registrationMetadataPage.getAffiliationsList())
        .toContain(institutionId);

      await registrationMetadataPage.clickOnEdit('Affiliated Institutions');
      await registrationMetadataPage.editAffiliationsModal.clickOnCheckbox(institutionId);
      await waitForApiWrite(page, () =>
        registrationMetadataPage.editAffiliationsModal.saveAffiliationsButton.click()
      );
      await reloadMetadataPage(registrationMetadataPage, page);

      await expect(
        registrationMetadataPage.section('Affiliated Institutions').locator('osf-affiliated-institutions-view')
      ).toBeVisible();
      expect(await registrationMetadataPage.getAffiliationsList()).not.toContain(institutionId);
    });

    test('write user update license', async ({ registrationMetadataPage }) => {
      const newLicense = 'CC-By Attribution 4.0 International';

      await registrationMetadataPage.clickOnEdit('License');
      await registrationMetadataPage.editLicenseModal.selectFromDropdownListbox(newLicense);
      await registrationMetadataPage.editLicenseModal.saveButton.click();

      await expect(registrationMetadataPage.licenseInfo).toHaveText(newLicense);
    });

    test('write user edit tags', async ({ registrationMetadataPage }) => {
      // Without edit rights the tags render as read-only `p-tag`s, not the removable `p-chip`s editors get.
      const tags = registrationMetadataPage.section('Tags');
      await expect(tags.getByText('selenium', { exact: true })).toBeVisible();

      await expect(registrationMetadataPage.tagInput).toHaveCount(0);
      await expect(tags.locator('.p-chip-remove-icon')).toHaveCount(0);
    });

    test('write user edit subjects', async ({ registrationMetadataPage }) => {
      const subjects = registrationMetadataPage.section('Subjects');
      await expect(subjects.locator('p-chip').first()).toBeVisible();

      await expect(subjects.getByRole('button', { name: 'Remove', exact: true })).toHaveCount(0);
    });
  });

  test.describe('Metadata read permissions', () => {
    test.beforeEach(async ({ mustBeLoggedInAsReadUser }) => {
      void mustBeLoggedInAsReadUser;
    });

    test('read only user permissions', async ({ registrationMetadataPage }) => {
      await expectMetadataIsReadOnly(registrationMetadataPage);
    });
  });

  test.describe('Metadata general user permissions', () => {
    test.beforeEach(async ({ mustBeLoggedIn }) => {
      void mustBeLoggedIn;
    });

    test('general user permissions', async ({ registrationMetadataPage }) => {
      await expectMetadataIsReadOnly(registrationMetadataPage);
    });
  });

  test.describe('Metadata logged out user permissions', () => {
    test('logged out user permissions', async ({ registrationMetadataPage }) => {
      await expectMetadataIsReadOnly(registrationMetadataPage);
    });
  });

  test.describe('Contributors page permissions', () => {
    test.describe('write user', () => {
      test.beforeEach(async ({ mustBeLoggedInAsWriteUser }) => {
        void mustBeLoggedInAsWriteUser;
      });

      test('write user contributor permission filters', async ({ registrationContributorsPage }) => {
        await checkPermissionFilters(registrationContributorsPage);
      });

      test('write user contributor bibliographic filters', async ({ page, registrationContributorsPage }) => {
        await checkBibliographicFilters(page, registrationContributorsPage);
      });

      test('write user contributor search', async ({ registrationContributorsPage }) => {
        await checkContributorSearch(registrationContributorsPage, WRITE_CONTRIBUTOR);
      });

      test('write user non editable functions', async ({ registrationContributorsPage }) => {
        await checkNonEditableFunctions(registrationContributorsPage);
      });
    });

    test.describe('read user', () => {
      test.beforeEach(async ({ mustBeLoggedInAsReadUser }) => {
        void mustBeLoggedInAsReadUser;
      });

      test('read user contributor permission filters', async ({ registrationContributorsPage }) => {
        await checkPermissionFilters(registrationContributorsPage);
      });

      test('read user contributor bibliographic filters', async ({ page, registrationContributorsPage }) => {
        await checkBibliographicFilters(page, registrationContributorsPage);
      });

      test('read user contributor search', async ({ registrationContributorsPage }) => {
        await checkContributorSearch(registrationContributorsPage, READ_CONTRIBUTOR);
      });

      test('read user non editable functions', async ({ registrationContributorsPage }) => {
        await checkNonEditableFunctions(registrationContributorsPage);
      });
    });

    test.describe('general user', () => {
      test.beforeEach(async ({ mustBeLoggedIn }) => {
        void mustBeLoggedIn;
      });

      test('general user contributor permission filters', async ({ registrationContributorsPage }) => {
        await checkPermissionFilters(registrationContributorsPage);
      });

      test('general user contributor bibliographic filters', async ({ page, registrationContributorsPage }) => {
        await checkBibliographicFilters(page, registrationContributorsPage);
      });

      test('general user contributor search', async ({ registrationContributorsPage }) => {
        await checkContributorSearch(registrationContributorsPage, READ_CONTRIBUTOR);
      });

      test('general user non editable functions', async ({ registrationContributorsPage }) => {
        await checkNonEditableFunctions(registrationContributorsPage);
      });
    });

    test.describe('logged out user', () => {
      test('logged out user contributor permission filters', async ({ registrationContributorsPage }) => {
        await checkPermissionFilters(registrationContributorsPage);
      });

      test('logged out user contributor bibliographic filters', async ({
        page,
        registrationContributorsPage,
      }) => {
        await checkBibliographicFilters(page, registrationContributorsPage);
      });

      test('logged out user contributor search', async ({ registrationContributorsPage }) => {
        await checkContributorSearch(registrationContributorsPage, READ_CONTRIBUTOR);
      });

      test('logged out user non editable functions', async ({ registrationContributorsPage }) => {
        await checkNonEditableFunctions(registrationContributorsPage);
      });
    });
  });

  test.describe('Files page permissions', () => {
    test.describe('write user', () => {
      test.beforeEach(async ({ mustBeLoggedInAsWriteUser }) => {
        void mustBeLoggedInAsWriteUser;
      });

      test('file detail page as write user', async ({ page, registrationFilesPage, filesRegistrationGuid }) => {
        await checkFileDetailPage(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('file download write user', async ({ page, registrationFilesPage }) => {
        await checkFileDownload(page, registrationFilesPage);
      });

      test('download as zip as write user', async ({ page, registrationFilesPage, filesRegistrationGuid }) => {
        await checkDownloadAsZip(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('write user sort name a to z', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_A_TO_Z);
      });

      test('write user sort name z to a', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_Z_TO_A);
      });

      test('write user sort modified date descending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_DESCENDING);
      });

      test('write user sort modified date ascending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_ASCENDING);
      });
    });

    test.describe('read user', () => {
      test.beforeEach(async ({ mustBeLoggedInAsReadUser }) => {
        void mustBeLoggedInAsReadUser;
      });

      test('file detail page as read user', async ({ page, registrationFilesPage, filesRegistrationGuid }) => {
        await checkFileDetailPage(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('file download read user', async ({ page, registrationFilesPage }) => {
        await checkFileDownload(page, registrationFilesPage);
      });

      test('download as zip as read user', async ({ page, registrationFilesPage, filesRegistrationGuid }) => {
        await checkDownloadAsZip(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('read user sort name a to z', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_A_TO_Z);
      });

      test('read user sort name z to a', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_Z_TO_A);
      });

      test('read user sort modified date descending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_DESCENDING);
      });

      test('read user sort modified date ascending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_ASCENDING);
      });
    });

    test.describe('general osf user', () => {
      test.beforeEach(async ({ mustBeLoggedIn }) => {
        void mustBeLoggedIn;
      });

      test('file detail page as general osf user', async ({
        page,
        registrationFilesPage,
        filesRegistrationGuid,
      }) => {
        await checkFileDetailPage(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('file download general osf user', async ({ page, registrationFilesPage }) => {
        await checkFileDownload(page, registrationFilesPage);
      });

      test('download as zip as general osf user', async ({
        page,
        registrationFilesPage,
        filesRegistrationGuid,
      }) => {
        await checkDownloadAsZip(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('general osf user sort name a to z', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_A_TO_Z);
      });

      test('general osf user sort name z to a', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_Z_TO_A);
      });

      test('general osf user sort modified date descending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_DESCENDING);
      });

      test('general osf user sort modified date ascending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_ASCENDING);
      });
    });

    test.describe('logged out user', () => {
      test('file detail page as logged out user', async ({
        page,
        registrationFilesPage,
        filesRegistrationGuid,
      }) => {
        await checkFileDetailPage(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('file download logged out user', async ({ page, registrationFilesPage }) => {
        await checkFileDownload(page, registrationFilesPage);
      });

      test('download as zip as logged out user', async ({
        page,
        registrationFilesPage,
        filesRegistrationGuid,
      }) => {
        await checkDownloadAsZip(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('logged out user sort name a to z', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_A_TO_Z);
      });

      test('logged out user sort name z to a', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_Z_TO_A);
      });

      test('logged out user sort modified date descending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_DESCENDING);
      });

      test('logged out user sort modified date ascending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_ASCENDING);
      });
    });

    test.describe('second admin user', () => {
      test.beforeEach(async ({ mustBeLoggedInAsAdminUser }) => {
        void mustBeLoggedInAsAdminUser;
      });

      test('file detail page as second admin user', async ({
        page,
        registrationFilesPage,
        filesRegistrationGuid,
      }) => {
        await checkFileDetailPage(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('file download second admin user', async ({ page, registrationFilesPage }) => {
        await checkFileDownload(page, registrationFilesPage);
      });

      test('download as zip as second admin user', async ({
        page,
        registrationFilesPage,
        filesRegistrationGuid,
      }) => {
        await checkDownloadAsZip(page, registrationFilesPage, filesRegistrationGuid);
      });

      test('second admin user sort name a to z', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_A_TO_Z);
      });

      test('second admin user sort name z to a', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, NAME_Z_TO_A);
      });

      test('second admin user sort modified date descending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_DESCENDING);
      });

      test('second admin user sort modified date ascending', async ({ registrationFilesPage }) => {
        await checkSort(registrationFilesPage, MODIFIED_ASCENDING);
      });
    });
  });
});
