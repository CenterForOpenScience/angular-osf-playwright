import { Page } from '@playwright/test';
import { test as base, expect } from '../src/fixtures';
import { ProjectDetailsPage } from '../src/pages/ProjectDetailsPage';
import * as settings from '../config/settings';
import { OsfSession } from '../src/api/session';
import * as osfApi from '../src/api/osfApi';
import { formatApiDateAsUi, normalizeSpaces } from '../src/utils';

const test = base.extend<{
    detailsPage: ProjectDetailsPage;
}>({
    detailsPage: async ({ page, session: OsfSession, defaultProjectWithFile, mustBeLoggedIn }, use) => {
        void mustBeLoggedIn; // ensure login fixture resolves before this runs; 

        const detailsPage = new ProjectDetailsPage(
            page,
            false,
            defaultProjectWithFile.id,
        );
        await detailsPage.gotoGuid();
        await use(detailsPage);
    },

});

test.describe('Project details page', { tag: '@core' }, () => {
    test.beforeEach(() => {
        test.skip(settings.PRODUCTION, 'Test should not run on production');
    });

    test('project overview details match API data', async ({
        page,
        session,
        detailsPage,
        defaultProjectWithFile,
    }) => {
        const nodeId = defaultProjectWithFile.id;

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
        // const apiSubjects = await osfApi.getProjectSubjects(apiRequest, nodeId);
        const apiAuthors = await osfApi.getProjectContributors(session, nodeId);


        const uiDescription = (await detailsPage.overviewDescription.innerText()).trim();
        const uiTagsList = await detailsPage.getTagsList();
        const uiCreatedDate = (await detailsPage.overviewDateCreated.innerText()).trim();
        const uiModifiedDate = (await detailsPage.overviewDateModified.innerText()).trim();
        const uiLicenseInfo = (await detailsPage.overviewLicense.innerText()).trim();
        const uiAffiliatedInstitutionList = await detailsPage.getAffiliationsList();
        // const uiSubjectsList = await projectDetailsPage.getSubjectsList();
        const uiAuthorsList = await detailsPage.getAuthorsList();

        // ---- Compare ----
        expect(uiDescription).toBe(apiDescription);


        expect([...uiTagsList].sort()).toEqual([...apiTagsList].sort());
        expect(uiLicenseInfo).toBe(apiProjectLicense);
        expect([...uiAffiliatedInstitutionList].sort()).toEqual([...apiInstitutionList].sort());
        // expect([...uiSubjectsList].sort()).toEqual([...apiSubjects].sort());
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

});
