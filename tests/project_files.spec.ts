import { test as base, expect } from '../src/fixtures';
import { Page, Locator } from '@playwright/test';
import { FilesPage } from '../src/pages/FilesPage';
import * as osfApi from '../src/api/osfApi';
import * as settings from '../config/settings';
import { present, clickExpectingPopup } from '../src/utils';
import fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const test = base.extend<{
  filesPage: FilesPage;
  defaultAddonsProject: osfApi.OsfProject;
}>({
  filesPage: async ({ page,  defaultAddonsProject, mustBeLoggedIn }, use) => {
    void mustBeLoggedIn; // ensure login fixture resolves before this runs; 

    const filesPage = new FilesPage(
      page,
      false,
      defaultAddonsProject.id,
      settings.OSF_HOME,
      'osfstorage' // or whatever default/appropriate addon provider
    );
    await filesPage.gotoGuid();
    await use(filesPage);
  },

});

async function findFileBySearch(filesPage: FilesPage, targetFileName: string) {
    // Search for target file
    await filesPage.searchInput.clear();
    await filesPage.searchInput.fill(targetFileName);
    const row = await filesPage.selectFromSearchResults(targetFileName);
    return row;
}

async function findFolderBySearch(filesPage: FilesPage, targetFolderName: string) {
    // Search for target file
    await filesPage.searchInput.clear();
    await filesPage.searchInput.fill(targetFolderName);
    const row = await filesPage.selectFromSearchResults(targetFolderName);
    return row;
}

async function verifyFileDownload(
    page: Page,
    filesPage: FilesPage,
    fileName: string,
    provider: string
) {
    /**
     * Helper function to verify the file download functionality on the Project Files page.
     */

    // If running on local machine, first check if the download file already exists
    // in the Downloads folder. If so then delete the old copy before attempting to
    // download a new one.
    const filePath = path.join(os.homedir(), 'Downloads', fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    const rowPromise = findFileBySearch(filesPage, fileName);
    const row = await rowPromise;
    if (!row) {
        throw new Error(`Could not find row for file: ${fileName}`);
    }

    // Click the File Action menu button at the far right side of the row to show the
    // menu options. Then click the Download option from this menu.
    const menuButton = row.locator(
        'button.p-ripple.p-button.p-button-contrast.p-button-icon-only.p-button-raised.p-button-sm.p-button-text.p-component'
    );
    await menuButton.click();


    // The menu overlay renders outside the row (PrimeNG overlay), so scope to page, not row
    const downloadButton = page.locator('li#download'); // overlay renders via appendto="body", outside row
    const downloadPromise = page.waitForEvent('download');

    await downloadButton.click();
    const download = await downloadPromise;

    // Save it explicitly to a known path (or just verify via the Download object's own API)
    const downloadPath = path.join(os.homedir(), 'Downloads', fileName);
    await download.saveAs(downloadPath);

    await filesPage.reload();

    if (provider !== 'osfstorage') {
        //await filesPage.selectAddon.click();
        await filesPage.selectFromAddonList(provider);
    }

    const currentDate = new Date();
    expect(fs.existsSync(filePath)).toBeTruthy();

    const stats = fs.statSync(filePath);
    const fileModDate = new Date(stats.mtime);
    expect(fileModDate.toDateString()).toBe(currentDate.toDateString());
}

// Example parameterized test replacing python's provider fixture
const providers = ['osfstorage', 's3', 'box', 'bitbucket', 'dataverse', 'dropbox', 'figshare', 'github', 'gitlab', 'googledrive', 'onedrive', 'owncloud'];
//const providers = ['s3'];

test.describe('Project Files Page', { tag: '@core' }, () => {
  test.beforeEach(() => {
      test.skip(settings.PRODUCTION, 'Test should not run on production');
    });

    for (const provider of providers) {
        test(`Download a single file from ${provider}`, async ({ page, filesPage }) => {
            // Substitute with your actual project ID or fixture login
            const currentBrowser = page.context().browser()?.browserType().name();
            const currentBrowserName: string = currentBrowser === 'chromium' ? 'chrome' : (currentBrowser ?? 'unknown');
            const fileName = 'download_' + currentBrowserName + '_' + provider + '.txt';

            if (provider !== 'osfstorage') {
                //await filesPage.selectAddon.click();
                await filesPage.selectFromAddonList(provider);
            }

            // Trigger and verify download

            await verifyFileDownload(page, filesPage, fileName, provider)

        });
    }
})