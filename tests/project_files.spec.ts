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

type SortCase = {
        title: string;
        sortOption: string;
        /** File name prefixes, uploaded in this order (order matters for the date tests). */
        prefixes: string[];
        column: 'name' | 'modified';
        order: 'asc' | 'desc';
    };

    const SORT_CASES: SortCase[] = [
        {
            title: 'sort name A to Z',
            sortOption: 'Name: A-Z',
            prefixes: ['1', 'ZZ', '2'],
            column: 'name',
            order: 'asc',
        },
        {
            title: 'sort name Z to A',
            sortOption: 'Name: Z-A',
            prefixes: ['1', '2', 'ZZ'],
            column: 'name',
            order: 'desc',
        },
        {
            // NOTE: kept exactly as the Selenium test: the name says "descending",
            // but it selects oldest -> newest and asserts ascending order.
            title: 'sort modified date descending',
            sortOption: 'Last modified: oldest to newest',
            prefixes: ['Oldest', 'Newest'],
            column: 'modified',
            order: 'asc',
        },
        {
            // NOTE: same naming mismatch as above, in reverse.
            title: 'sort modified date ascending',
            sortOption: 'Last modified: newest to oldest',
            prefixes: ['Oldest', 'Newest'],
            column: 'modified',
            order: 'desc',
        },
    ];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    

function parseOsfDate(text: string): number {
  const m = text.trim().match(/^([A-Za-z]{3}) (\d{1,2}), (\d{2}) (\d{1,2}):(\d{2}) ([AP]M)$/i);
  if (!m) throw new Error(`Unexpected date format: "${text}"`);
  const [, mon, day, yy, hh, mm, ampm] = m;
  let hour = Number(hh) % 12;
  if (ampm.toUpperCase() === 'PM') hour += 12;
  return new Date(2000 + Number(yy), MONTHS.indexOf(mon.toLowerCase()), Number(day), hour, Number(mm)).getTime();
}

function isSorted(keys: (string | number)[], order: SortCase['order']): boolean {
  return keys.every((key, i) => i === 0 || (order === 'asc' ? keys[i - 1] <= key : keys[i - 1] >= key));
}

/** Reads the column as sortable keys (lowercased names, like key=str.lower, or timestamps). */
async function readSortKeys(page: Page, column: SortCase['column']): Promise<(string | number)[]> {
  if (column === 'name') {
    const texts = await page.locator('span.entry-title').allInnerTexts();
    return texts.map((t) => t.trim().toLowerCase());
  }
  const texts = await page.locator('xpath=//div[@class="files-table-cell"][3]').allInnerTexts();
  return texts.map(parseOsfDate);
}

// Example parameterized test replacing python's provider fixture
const UNSUPPORTED_PROVIDERS = ['bitbucket', 'dataverse', 'figshare', 'gitlab', 'onedrive', 'googledrive'];
const providers = ['osfstorage', 's3', 'box', 'bitbucket', 'dataverse', 'dropbox', 'figshare', 'github', 'gitlab', 'googledrive', 'onedrive', 'owncloud'];
//const providers = ['osfstorage'];

test.describe('Project Files Page', { tag: '@core' }, () => {
  test.beforeEach(() => {
      test.skip(settings.PRODUCTION, 'Test should not run on production');
    });

    for (const provider of providers) {
        test(`Download a single file from ${provider}`, async ({ page, filesPage }) => {
            test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
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

    for (const provider of providers) {
        test(`Download a folder from ${provider}`, async ({ page, filesPage }) => {
            test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
            // Substitute with your actual project ID or fixture login
            const currentBrowser = page.context().browser()?.browserType().name();
            const currentBrowserName: string = currentBrowser === 'chromium' ? 'chrome' : (currentBrowser ?? 'unknown');
            const folderName = 'download_' + currentBrowserName + '_' + provider ;

            if (provider !== 'osfstorage') {
                //await filesPage.selectAddon.click();
                await filesPage.selectFromAddonList(provider);
            }

            // Open the folder (search + click lives in the page object)
            const filePath = path.join(os.homedir(), 'Downloads', folderName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            const rowPromise = findFolderBySearch(filesPage, folderName);
            const row = await rowPromise;
            if (!row) {
                throw new Error(`Could not find row for file: ${folderName}`);
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
            const downloadFolderName = folderName+'.zip'
            const downloadPath = path.join(os.homedir(), 'Downloads', downloadFolderName);
            await download.saveAs(downloadPath);

            await filesPage.reload();

            if (provider !== 'osfstorage') {
                //await filesPage.selectAddon.click();
                await filesPage.selectFromAddonList(provider);
            }

            const currentDate = new Date();
            expect(fs.existsSync(downloadPath)).toBeTruthy();

            const stats = fs.statSync(downloadPath);
            const fileModDate = new Date(stats.mtime);
            expect(fileModDate.toDateString()).toBe(currentDate.toDateString());


        });
    }

})

test.describe('Files page sort', () => {
  for (const provider of providers) {
    for (const sortCase of SORT_CASES) {
      test(`${sortCase.title} - ${provider}`, async ({ page, filesPage, session, browserName }) => {
        test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
 
        // Upload each test file, in order
        const fileNames = sortCase.prefixes.map((p) => `${p} AQA_${provider}.txt`);
 
        if (provider !== 'osfstorage') {
          //await filesPage.selectAddon.click();
          await filesPage.selectFromAddonList(provider);
        }
 
        await filesPage.selectSortFromList(sortCase.sortOption);
 
        // Replaces time.sleep + one-shot assert: retry until the list re-renders sorted
        await expect
          .poll(async () => {
            const keys = await readSortKeys(page, sortCase.column);
            return isSorted(keys, sortCase.order) ? 'sorted' : `not sorted: ${keys.join(' | ')}`;
          })
          .toBe('sorted');
      });
    }
  }
});