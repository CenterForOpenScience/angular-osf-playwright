import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { OsfSession } from '../src/api/session';
import { Navbar } from '../src/pages/components/Navbar';
import {
  MyPreprintsPage,
  PreprintPage,
  PreprintProviderSelectPage,
  PreprintSubmitPage,
} from '../src/pages/PreprintPage';


const UPLOAD_FILE_NAME = 'selenium_preprint_test.txt';


const LONG_FLOW_TIMEOUT_MS = 180_000;

const test = base.extend<{
  myPreprintsPage: MyPreprintsPage;
  createPreprints: string[];
}>({

  myPreprintsPage: async ({ page }, use) => {
    await new Navbar(page).clickMyPreprintsLink();
    const myPreprintsPage = await MyPreprintsPage.expectOn(page);
    await myPreprintsPage.waitUntilLoaded();
    await use(myPreprintsPage);
  },


  createPreprints: async ({ session, fake }, use) => {
    const titles: string[] = [];
    for (const prefix of ['1 OSF Preprint', '2 OSF Preprint', 'ZZZ OSF Preprint']) {
      const suffix = fake.string.alpha({ length: { min: 5, max: 10 }, casing: 'lower' });
      const title = `${prefix} ${suffix}`;
      await osfApi.createPreprint(session, {
        providerId: 'selpostmod',
        title,
        licenseName: 'CC0 1.0 Universal',
        subjectName: 'Engineering',
      });
      titles.push(title);
    }
    await use(titles);
  },
});


async function deleteSupplementalProjects(session: OsfSession, since: string): Promise<void> {
  try {
    const preprints = await osfApi.getPreprintsListForUser(session);
    const created = preprints.find((preprint) => preprint.attributes.date_created > since);
    if (!created) return;
    const supplementalGuid = await osfApi.getPreprintSupplementalMaterialGuid(session, created.id);
    if (supplementalGuid) await session.delete(`/v2/nodes/${supplementalGuid}/`);
  } catch (error) {
    console.error('\n=== CLEANUP FAILED (IGNORED) ===');
    console.error(`Error: ${error}`);
  }
}

test.describe('My Preprints Page', () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
    test.setTimeout(LONG_FLOW_TIMEOUT_MS);
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('filter preprints by title', async ({ createPreprints, myPreprintsPage }) => {
    const [targetTitle, secondTitle, thirdTitle] = createPreprints;

    await myPreprintsPage.filterBy(targetTitle);

    await expect(myPreprintsPage.titleCells.first()).toHaveText(targetTitle);
    await expect(myPreprintsPage.rowWithTitle(secondTitle)).toHaveCount(0);
    await expect(myPreprintsPage.rowWithTitle(thirdTitle)).toHaveCount(0);
    await expect(myPreprintsPage.rowWithTitle(targetTitle)).toHaveCount(1);
  });

  test('filter preprints by tag', async ({ createPreprints, myPreprintsPage }) => {
    const [targetTitle, secondTitle, thirdTitle] = createPreprints;

    await myPreprintsPage.filterBy('AQA preprint tag');

    // Newest first - the last preprint created leads the list.
    await expect(myPreprintsPage.titleCells.first()).toHaveText(thirdTitle);
    await expect(myPreprintsPage.rowWithTitle(targetTitle)).toHaveCount(1);
    await expect(myPreprintsPage.rowWithTitle(secondTitle)).toHaveCount(1);
    await expect(myPreprintsPage.rowWithTitle(thirdTitle)).toHaveCount(1);
    expect(await myPreprintsPage.rows.count()).toBeGreaterThanOrEqual(3);
  });

  test('filter preprints by description', async ({ createPreprints, myPreprintsPage }) => {
    const targetTitle = createPreprints[2];

    await myPreprintsPage.filterBy('Preprint created via the OSF api');

    await expect(myPreprintsPage.titleCells.first()).toHaveText(targetTitle);
    await expect(myPreprintsPage.rowWithTitle(targetTitle)).toHaveCount(1);
    expect(await myPreprintsPage.rows.count()).toBeGreaterThanOrEqual(3);
  });

  test('sort preprints by title', async ({ createPreprints, myPreprintsPage }) => {
    void createPreprints;
    const titleCells = myPreprintsPage.titleCells.filter({ hasText: 'OSF Preprint' });
    await myPreprintsPage.filterBy('OSF Preprint');

    await myPreprintsPage.sortBy('Title');
    await expect(myPreprintsPage.columnHeader('Title')).toHaveAttribute('aria-sort', 'ascending');
    let titles = (await titleCells.allInnerTexts()).map((title) => title.trim());
    expect(titles.length, 'need at least two titles to verify sorting').toBeGreaterThan(1);
    expect(titles, `Titles are not sorted ASC: ${titles}`).toEqual([...titles].sort());

    await myPreprintsPage.sortBy('Title');
    await expect(myPreprintsPage.columnHeader('Title')).toHaveAttribute('aria-sort', 'descending');
    titles = (await titleCells.allInnerTexts()).map((title) => title.trim());
    expect(titles.length, 'need at least two titles to verify sorting').toBeGreaterThan(1);
    expect(titles, `Titles are not sorted DESC: ${titles}`).toEqual([...titles].sort().reverse());
  });

  test('sort preprints by modified', async ({ createPreprints, myPreprintsPage }) => {
    void createPreprints;
    await myPreprintsPage.filterBy('OSF Preprint');

    await myPreprintsPage.sortBy('Modified');
    await expect(myPreprintsPage.columnHeader('Modified')).toHaveAttribute('aria-sort', 'ascending');
    myPreprintsPage.assertSorting(await myPreprintsPage.getModifiedDatesFromTable(), 'ascending');

    await myPreprintsPage.sortBy('Modified');
    await expect(myPreprintsPage.columnHeader('Modified')).toHaveAttribute('aria-sort', 'descending');
    myPreprintsPage.assertSorting(await myPreprintsPage.getModifiedDatesFromTable(), 'descending');
  });

  test('create preprint on my preprints', async ({ page, session, fake, myPreprintsPage }) => {
    const preprintTitle = `AQA Test Preprint ${fake.string.alpha({
      length: { min: 5, max: 10 },
      casing: 'lower',
    })}`;

    const providerName =
      settings.STAGE2 || settings.STAGE4 || settings.TEST2 || settings.TEST4
        ? 'PsyArXiv'
        : 'AfricArXiv';
    // Used afterwards to find the preprint this test created (`date_created` is UTC).
    const startedAt = new Date().toISOString().slice(0, 19);

    try {
      await myPreprintsPage.addPreprintButton.click();
      const selectProviderPage = await PreprintProviderSelectPage.expectOn(page);
      await selectProviderPage.selectProvider(providerName);
      await selectProviderPage.nextButton.click();
      const submitPage = await PreprintSubmitPage.expectOn(page);

      // Title and Abstract
      await submitPage.titleInput.fill(preprintTitle);
      await submitPage.abstractInput.fill('Center for Open Selenium');
      await submitPage.goToNextStep('File');

      // File
      await submitPage.uploadFileFromComputer(UPLOAD_FILE_NAME);
      await submitPage.goToNextStep('Metadata');

      // Metadata - the license list order differs between environments, so select by name.
      await submitPage.selectLicense('CC0 1.0 Universal');
      await submitPage.selectTopLevelSubject('Engineering');
      await expect(submitPage.selectedSubject('Engineering')).toHaveText('Engineering');
      await submitPage.tagsInput.fill('selenium');
      await submitPage.tagsInput.press('Enter');
      await submitPage.goToNextStep('Author Assertions');

      // Author Assertions - each answer reveals its own text box.
      await submitPage.conflictOfInterestYes.check();
      await expect(submitPage.conflictOfInterestInput).toBeEditable();
      await submitPage.conflictOfInterestInput.fill('QA Testing');
      await submitPage.publicDataAvailable.check();
      await expect(submitPage.publicDataInput).toBeVisible();
      await submitPage.publicDataInput.fill('https://osf.io/');
      await submitPage.preregistrationUnavailable.check();
      await expect(submitPage.preregistrationInput).toBeEditable();
      await submitPage.preregistrationInput.fill('QA Testing');
      await expect(submitPage.nextButton).toBeEnabled();
      await submitPage.goToNextStep('Supplements (optional)');

      // Supplements are skipped; Review
      await submitPage.goToNextStep('Consent To Publish');
      await submitPage.button('Submit').click();

      const detailPage = await PreprintPage.expectOn(page);
      await expect(detailPage.title).toHaveText(preprintTitle);
    } finally {
      await deleteSupplementalProjects(session, startedAt);
    }
  });
});
