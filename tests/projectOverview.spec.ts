import { test as base, expect } from '../src/fixtures';
import { ProjectDetailsPage } from '../src/pages/ProjectDetailsPage';
import { ProjectContributorsPage } from '../src/pages/ProjectContributorsPage';
import * as settings from '../config/settings';
import * as osfApi from '../src/api/osfApi';
import { formatApiDateAsUi, normalizeSpaces, clickExpectingDownload } from '../src/utils';

// Default (US) region: regionProject comes from defaultProjectWithFile
const usTest = base.extend<{
    regionProject: osfApi.OsfProject;
    detailsPage: ProjectDetailsPage;
}>({
    regionProject: async ({ defaultProjectWithFile }, use) => {
        await use(defaultProjectWithFile);
    },

    detailsPage: async ({ page, regionProject, mustBeLoggedIn }, use) => {
        void mustBeLoggedIn; // ensure login fixture resolves before this runs

        const detailsPage = new ProjectDetailsPage(page, false, regionProject.id);
        await detailsPage.gotoGuid();
        await use(detailsPage);
    },
});

// Other regions only override which project fixture feeds regionProject
const canadaTest = usTest.extend({
    regionProject: async ({ defaultProjectWithFileCanada }, use) => {
        await use(defaultProjectWithFileCanada);
    },
});

const germanyTest = usTest.extend({
    regionProject: async ({ defaultProjectWithFileGermany }, use) => {
        await use(defaultProjectWithFileGermany);
    },
});

const REGIONS = [
    { name: 'United States', test: usTest },
    { name: 'Canada', test: canadaTest },
    { name: 'Germany', test: germanyTest },
];

for (const { name: region, test } of REGIONS) {
    test.describe(`Project details page - ${region}`, { tag: '@core' }, () => {
        test.beforeEach(() => {
            test.skip(settings.PRODUCTION, 'Test should not run on production');
        });

        test('project overview details match API data', async ({
            page,
            session,
            detailsPage,
            regionProject,
        }) => {
            const nodeId = regionProject.id;

            // ---- API data ----
            const projectData = await osfApi.getNodeDetails(session, nodeId);
            if (!projectData) {
                throw new Error(`Node ${nodeId} not found via API`);
            }

            const apiDescription: string = projectData.attributes.description;
            const apiTagsList: string[] = projectData.attributes.tags;
            const apiCreatedDate: string = projectData.attributes.date_created;
            const apiModifiedDate: string = projectData.attributes.date_modified;

            const apiProjectLicense = await osfApi.getProjectLicenseName(session, nodeId);
            const apiInstitutionList = await osfApi.getProjectInstitutions(session, nodeId);
            const apiAuthors = await osfApi.getProjectContributors(session, nodeId);

            // ---- UI data ----
            const uiDescription = (await detailsPage.overviewDescription.innerText()).trim();
            const uiTagsList = await detailsPage.getTagsList();
            const uiCreatedDate = (await detailsPage.overviewDateCreated.innerText()).trim();
            const uiModifiedDate = (await detailsPage.overviewDateModified.innerText()).trim();
            const uiLicenseInfo = (await detailsPage.overviewLicense.innerText()).trim();
            const uiAffiliatedInstitutionList = await detailsPage.getAffiliationsList();
            const uiAuthorsList = await detailsPage.getAuthorsList();

            // ---- Compare ----
            expect(uiDescription).toBe(apiDescription);
            expect([...uiTagsList].sort()).toEqual([...apiTagsList].sort());
            expect(uiLicenseInfo).toBe(apiProjectLicense);
            expect([...uiAffiliatedInstitutionList].sort()).toEqual([...apiInstitutionList].sort());

            const browserTz = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
            expect(normalizeSpaces(uiCreatedDate)).toBe(formatApiDateAsUi(apiCreatedDate, browserTz));
            expect(normalizeSpaces(uiModifiedDate)).toBe(formatApiDateAsUi(apiModifiedDate, browserTz));

            // Author list is collected up front, so navigating away doesn't invalidate it
            for (const { name, link } of uiAuthorsList) {
                const cleanName = name.replaceAll(',', '');
                expect(apiAuthors).toContain(cleanName);

                await page.goto(link);
                const profileHeading = page.getByRole('heading', { level: 1 });
                await expect(profileHeading).toBeVisible({ timeout: 10_000 });
                await expect(profileHeading).toContainText(cleanName);
            }
        });

        test('project overview download', async ({ page, detailsPage, regionProject }) => {
            const download = await clickExpectingDownload(page, detailsPage.downloadButton);
            expect(download.suggestedFilename()).toBe(`${regionProject.id}-osfstorage-archive.zip`);
        });

        test('project overview metadata download', async ({ page, detailsPage, regionProject }) => {
            const download = await clickExpectingDownload(page, detailsPage.metadataDownload);
            expect(download.suggestedFilename()).toBe(`${regionProject.id}-datacite.json`);
        });

        test('view only links button navigates to contributors page and creates a VOL', async ({
            page,
            detailsPage,
            regionProject,
        }) => {
            const volName = 'Playwright_VOL';
            const nodeId = regionProject.id;
            const contributorsUrl = new RegExp(`/${nodeId}/contributors/?$`);
            const contributorsPage = new ProjectContributorsPage(page, false, nodeId);
            const volCell = page.locator('osf-view-only-table').getByRole('cell', { name: volName, exact: true });
            let volCreated = false;

            try {
                // Overview → contributors page
                await detailsPage.viewOnlyLinksButton.click();
                await expect(page).toHaveURL(contributorsUrl);

                await contributorsPage.createVolButton.click();
                await expect(contributorsPage.dialog).toBeVisible();
                await contributorsPage.volName.fill(volName);
                await contributorsPage.createButton.click();
                await expect(contributorsPage.dialog).toBeHidden();

                // New link appears in the view-only links table
                await expect(volCell).toBeVisible();
                volCreated = true;

                // Back on the overview, the VOL count shows 1
                await detailsPage.gotoGuid();
                await expect(detailsPage.viewOnlyLinksButton).toHaveText('1');
            } finally {
                if (volCreated) {
                    if (!contributorsUrl.test(page.url())) {
                        await detailsPage.gotoGuid();
                        await detailsPage.viewOnlyLinksButton.click();
                        await expect(page).toHaveURL(contributorsUrl);
                    }
                    await contributorsPage.deletetVOL(volName);
                }
            }
        });
    });
}