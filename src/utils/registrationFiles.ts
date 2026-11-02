import { Page, expect } from '@playwright/test';

import { FileDetailPage } from '../pages/FileDetailPage';
import { RegistrationFilesListPage, registrationUrl } from '../pages/RegistrationPage';
import { clickExpectingDownload, clickExpectingPopup } from './index';


export async function checkFileDetailPage(
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

export async function checkFileDownload(page: Page, filesPage: RegistrationFilesListPage): Promise<void> {
  const fileName = 'download_file_for_registration.txt';

  await filesPage.openArchive();
  await filesPage.searchFor(fileName);
  await filesPage.fileMenuButton(fileName).click();
  const download = await clickExpectingDownload(page, filesPage.menuItem('Download'));
  expect(download.suggestedFilename()).toBe(fileName);
}

export async function checkDownloadAsZip(
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

export type SortCase = {
  /** The option the test checks. */
  sort: string;
  /** Picked first when `sort` is already the current option (A-Z on load) - re-picking it sends no request. */
  opposite: string;
  column: 'name' | 'modified';
  order: 'asc' | 'desc';
};

export const NAME_A_TO_Z: SortCase = { sort: 'Name: A-Z', opposite: 'Name: Z-A', column: 'name', order: 'asc' };

export const NAME_Z_TO_A: SortCase = { sort: 'Name: Z-A', opposite: 'Name: A-Z', column: 'name', order: 'desc' };

export const MODIFIED_DESCENDING: SortCase = {
  sort: 'Last modified: oldest to newest',
  opposite: 'Last modified: newest to oldest',
  column: 'modified',
  order: 'asc',
};
export const MODIFIED_ASCENDING: SortCase = {
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

export async function checkSort(filesPage: RegistrationFilesListPage, sortCase: SortCase): Promise<void> {
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

