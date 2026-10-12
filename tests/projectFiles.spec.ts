import { test as base, expect } from '../src/fixtures';
import { Page, Locator } from '@playwright/test';
import { FilesPage } from '../src/pages/FilesPage';
import * as osfApi from '../src/api/osfApi';
import * as settings from '../config/settings';
import { present, clickExpectingPopup} from '../src/utils';
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
    const downloadPromise = page.waitForEvent('download');
    const downloadButton = page.locator('li#download'); // overlay renders via appendto="body", outside row
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

const ROWS = 'osf-files-tree-row div.files-table-row';
 
/** Date format shown in the "last modified" column, e.g. "Aug 13, 2026 11:56 AM". */
const DATE_FORMAT = /^[A-Z][a-z]{2} \d{1,2}, \d{4} \d{1,2}:\d{2} [AP]M$/;
 
type Column = 'name' | 'modified';
type Order = 'asc' | 'desc';
type SortOption = { label: string; column: Column; order: Order };
 
const NAME_A_Z: SortOption = { label: 'Name: A-Z', column: 'name', order: 'asc' };
const NAME_Z_A: SortOption = { label: 'Name: Z-A', column: 'name', order: 'desc' };
const OLDEST_FIRST: SortOption = { label: 'Last modified: oldest to newest', column: 'modified', order: 'asc' };
const NEWEST_FIRST: SortOption = { label: 'Last modified: newest to oldest', column: 'modified', order: 'desc' };
 
// `opposite` is selected first, so the test proves the dropdown really changes the order
// (the page is already sorted A-Z by default, which would otherwise pass without doing anything).
const SORT_CASES: { title: string; sort: SortOption; opposite: SortOption }[] = [
  { title: 'sort name A to Z', sort: NAME_A_Z, opposite: NAME_Z_A },
  { title: 'sort name Z to A', sort: NAME_Z_A, opposite: NAME_A_Z },
  // NOTE: titles kept from the Selenium test, even though they are swapped vs. what they select.
  { title: 'sort modified date descending', sort: OLDEST_FIRST, opposite: NEWEST_FIRST },
  { title: 'sort modified date ascending', sort: NEWEST_FIRST, opposite: OLDEST_FIRST },
];
 
// ---------- helpers ----------
 
type Row = { name: string; dateText: string };
 
/** Reads every row on the page: its name and its "last modified" text (empty for folders). */
async function readRows(page: Page): Promise<Row[]> {
  // Reads all rows in one go, so each name and date come from the same row
  // and from the same moment (not half before and half after a re-render).
  return page.locator(ROWS).evaluateAll((rows) =>
    rows.map((row) => {
      const nameCell = row.querySelector('.entry-title') ?? row.querySelector(':scope > .table-cell');
      const cells = row.querySelectorAll(':scope > .files-table-cell');
      return {
        name: (nameCell?.textContent ?? '').trim(),
        dateText: (cells[2]?.textContent ?? '').trim(), // 3rd files-table-cell, as in the Selenium XPath
      };
    }),
  );
}
 
/** Case-insensitive name comparison, same as Python's sorted(key=str.lower). */
function compareNames(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}
 
/**
 * Checks any list of rows against a sort option, comparing each row with the next one.
 * Equal values may be in either order. Rows without a date (folders) are ignored when
 * sorting by date. Returns null when sorted, otherwise a description of the first problem.
 */
function findSortProblem(rows: Row[], sort: SortOption): string | null {
  const items =
    sort.column === 'name'
      ? rows.map((r) => ({ label: r.name, value: r.name }))
      : rows.filter((r) => r.dateText !== '').map((r) => ({ label: `${r.name} (${r.dateText})`, value: r.dateText }));
 
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const cur = items[i];
    let cmp: number;
    if (sort.column === 'name') {
      cmp = compareNames(prev.value, cur.value);
    } else {
      for (const item of [prev, cur]) {
        if (!DATE_FORMAT.test(item.value)) return `not a date: "${item.label}" - check the date column locator`;
      }
      cmp = Date.parse(prev.value) - Date.parse(cur.value);
    }
    if (sort.order === 'asc' ? cmp > 0 : cmp < 0) {
      return `"${prev.label}" is shown before "${cur.label}"`;
    }
  }
  return null;
}
 
/** Picks a sort option and retries until all `rowCount` rows are shown in that order. */
async function sortAndVerify(page: Page, filesPage: { selectSortFromList(o: string): Promise<void> }, sort: SortOption, rowCount: number) {
  await filesPage.selectSortFromList(sort.label);
 
  // The rows on the page must be in this option's order
  await expect
    .poll(
      async () => {
        const rows = await readRows(page);
        // Guard against reading a half-rendered list, which would look "sorted"
        if (rows.length !== rowCount) return `expected ${rowCount} rows, found ${rows.length}`;
        return findSortProblem(rows, sort) ?? 'sorted';
      },
      { message: `list should be sorted by "${sort.label}"` },
    )
    .toBe('sorted');
 
  // Shows what the test actually saw, so you can compare it with the page while debugging
  const rows = await readRows(page);
  //console.log(`[${sort.label}]\n` + rows.map((r) => `  ${r.name}  |  ${r.dateText || '-'}`).join('\n'));
}
 

// Example parameterized test replacing python's provider fixture
const UNSUPPORTED_PROVIDERS = ['bitbucket', 'dataverse', 'figshare', 'gitlab', 'onedrive'];
const providers = ['osfstorage', 's3', 'box', 'bitbucket', 'dataverse', 'dropbox', 'figshare', 'github', 'gitlab', 'googledrive', 'onedrive', 'owncloud'];
//const providers = ['osfstorage', 'box'];

test.describe('Project Files Page', { tag: '@core' }, () => {
  test.beforeEach(() => {
      test.skip(settings.PRODUCTION, 'Test should not run on production');
    });

    for (const provider of providers) {
        test(`download a single file from ${provider}`, async ({ page, filesPage }) => {
            test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
            // Substitute with your actual project ID or fixture login
            const currentBrowser = page.context().browser()?.browserType().name();
            const currentBrowserName: string = currentBrowser === 'chromium' ? 'chrome' : (currentBrowser ?? 'unknown');
            const fileName = 'download_' + currentBrowserName + '_' + provider + '.txt';

            if (provider !== 'osfstorage') {
                await filesPage.selectFromAddonList(provider);
            }

            // Trigger and verify download

            await verifyFileDownload(page, filesPage, fileName, provider)

        });
    }

    for (const provider of providers) {
        test(`download a folder from ${provider}`, async ({ page, filesPage }) => {
            test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
            // Substitute with your actual project ID or fixture login
            const currentBrowser = page.context().browser()?.browserType().name();
            const currentBrowserName: string = currentBrowser === 'chromium' ? 'chrome' : (currentBrowser ?? 'unknown');
            const folderName = 'download_' + currentBrowserName + '_' + provider ;

            if (provider !== 'osfstorage') {
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
            const downloadPromise = page.waitForEvent('download');
            const downloadButton = page.locator('li#download'); // overlay renders via appendto="body", outside row
            await downloadButton.click();
            const download = await downloadPromise;

            // Save it explicitly to a known path (or just verify via the Download object's own API)
            const downloadFolderName = folderName+'.zip'
            const downloadPath = path.join(os.homedir(), 'Downloads', downloadFolderName);
            await download.saveAs(downloadPath);

            await filesPage.reload();

            if (provider !== 'osfstorage') {
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

for (const provider of providers) {
    test(`download as a zip from ${provider}`, async ({ page, filesPage }) => {
        test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
        const currentBrowser = page.context().browser()?.browserType().name();
        const currentBrowserName: string = currentBrowser === 'chromium' ? 'chrome' : (currentBrowser ?? 'unknown');
        const folderName = 'download_' + currentBrowserName + '_' + provider;

        if (provider !== 'osfstorage') {
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

        // Click the Folder link to navagate inside the folder
        const downloadPromise = page.waitForEvent('download');
        await filesPage.clickOnFolderLink(folderName, row);
        await filesPage.clickOnButton('Download As Zip');
        const download = await downloadPromise;

        // Save it explicitly to a known path (or just verify via the Download object's own API)
        const downloadFolderName = folderName + '.zip'
        const downloadPath = path.join(os.homedir(), 'Downloads', downloadFolderName);
        await download.saveAs(downloadPath);

        await filesPage.reload();

        if (provider !== 'osfstorage') {
            await filesPage.selectFromAddonList(provider);
        }

        const currentDate = new Date();
        expect(fs.existsSync(downloadPath)).toBeTruthy();

        const stats = fs.statSync(downloadPath);
        const fileModDate = new Date(stats.mtime);
        expect(fileModDate.toDateString()).toBe(currentDate.toDateString());


    });
}

for (const provider of providers) {
    test(`top level download as zip from ${provider}`, async ({ page, filesPage, defaultAddonsProject }) => {
        test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
        // Substitute with your actual project ID or fixture login
        //const node_id = defaultAddonsProject.id;
        const currentBrowser = page.context().browser()?.browserType().name();
        const currentBrowserName: string = currentBrowser === 'chromium' ? 'chrome' : (currentBrowser ?? 'unknown');
        const folderName =  provider +  '-archive.zip'

        if (provider !== 'osfstorage') {
            await filesPage.selectFromAddonList(provider);
        }
        
        const downloadPromise = page.waitForEvent('download'); // arm BEFORE the triggering click
        await filesPage.clickOnButton('Download As Zip');
        const download = await downloadPromise;

        // Save it explicitly to a known path (or just verify via the Download object's own API)
        //const downloadFolderName = folderName + '.zip'
        const downloadPath = path.join(os.homedir(), 'Downloads', folderName);
        await download.saveAs(downloadPath);

        await filesPage.reload();

        if (provider !== 'osfstorage') {
            await filesPage.selectFromAddonList(provider);
        }

        const currentDate = new Date();
        expect(fs.existsSync(downloadPath)).toBeTruthy();

        const stats = fs.statSync(downloadPath);
        const fileModDate = new Date(stats.mtime);
        expect(fileModDate.toDateString()).toBe(currentDate.toDateString());

    });
}

test.describe('Files Page Sort', () => {
  for (const provider of providers) {
    for (const { title, sort, opposite } of SORT_CASES) {
      test(`${title} - ${provider}`, async ({ page, filesPage, defaultProject, session }) => {
        test.skip(UNSUPPORTED_PROVIDERS.includes(provider), 'Functionality not supported');
 
        if (provider !== 'osfstorage') {
          await filesPage.selectFromAddonList(provider);
        }
 
         // Replaces wait_until_page_ready: wait for the list, then count what is there
        await expect(page.locator(ROWS).first()).toBeVisible();
        const rows = await readRows(page);
        expect(rows.every((r) => r.name !== ''), 'a row has no name - check the name locator').toBe(true);
        const comparable = sort.column === 'name' ? rows : rows.filter((r) => r.dateText !== '');
        expect(comparable.length, `need at least 2 ${sort.column === 'name' ? 'items' : 'dated files'} in ${provider}`).toBeGreaterThanOrEqual(2);
 
        await sortAndVerify(page, filesPage, opposite, rows.length);
        await sortAndVerify(page, filesPage, sort, rows.length);
      });
    }
  }
  
});