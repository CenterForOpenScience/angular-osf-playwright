import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { logout } from '../src/pages/LoginPage';
import { normalizeApiDate, normalizeUiDate, present } from '../src/utils';
import { Navbar } from '../src/pages/components/Navbar';
import {
  RegistrationPage,
  RegistrationMetadataPage,
  RegistrationFilesListPage,
  RegistrationResourcesPage,
  RegistrationWikiPage,
  RegistrationComponentsPage,
  RegistrationLinksPage,
  RegistrationAnalyticsPage,
  RegistrationContributorsPage,
  registrationUrl,
} from '../src/pages/RegistrationPage';


const test = base.extend<{}>({});

const resourceTypes = ['Data', 'Analytic Code', 'Materials', 'Papers', 'Supplements'];

test.describe('Submitted Registration Side Navigation', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, session, hideMetadataFeaturePopover }) => {
    void hideMetadataFeaturePopover;
    const guid = await osfApi.getMostRecentRegistrationNodeId(session);
    if (!guid) throw new Error('No recent approved public registration found.');
    await page.goto(registrationUrl(guid));
    await new RegistrationPage(page).verify();
  });

  test('metadata link', async ({ page }) => {
    await new RegistrationPage(page).sideNavbar.metadataLink.click();
    await RegistrationMetadataPage.expectOn(page);
  });

  test('files link', async ({ page }) => {
    await new RegistrationPage(page).sideNavbar.filesLink.click();
    await RegistrationFilesListPage.expectOn(page);
  });

  test('resources link', async ({ page }) => {
    await new RegistrationPage(page).sideNavbar.resourcesLink.click();
    await RegistrationResourcesPage.expectOn(page);
  });

  test('wiki link', async ({ page }) => {
    await new RegistrationPage(page).sideNavbar.wikiLink.click();
    await RegistrationWikiPage.expectOn(page);
  });

  test('components link', async ({ page }) => {
    await new RegistrationPage(page).sideNavbar.componentsLink.click();
    await RegistrationComponentsPage.expectOn(page);
  });

  test('links link', async ({ page }) => {
    await new RegistrationPage(page).sideNavbar.linksLink.click();
    await RegistrationLinksPage.expectOn(page);
  });

  test('analytics link', async ({ page }) => {
    await new RegistrationPage(page).sideNavbar.analyticsLink.click();
    await RegistrationAnalyticsPage.expectOn(page);
  });

  test('overview link', async ({ page, session, hideMetadataFeaturePopover }) => {
    void hideMetadataFeaturePopover;
    const guid = await osfApi.getMostRecentRegistrationNodeId(session);
    if (!guid) throw new Error('No recent approved public registration found.');
    await page.goto(registrationUrl(guid, 'metadata/osf'));
    await new RegistrationMetadataPage(page).verify();
    await new RegistrationPage(page).sideNavbar.overviewLink.click();
    await RegistrationPage.expectOn(page);
  });
});

test.describe('Registration Outputs', { tag: '@core' }, () => {
  let guid: string;

  test.beforeEach(async ({ mustBeLoggedInAsRegistrationUser, hideMetadataFeaturePopover }) => {
    void mustBeLoggedInAsRegistrationUser;
    void hideMetadataFeaturePopover;
    test.skip(settings.PRODUCTION, 'Test should not run on production');
    const found = await osfApi.getRegistrationByTitle('Selenium Registration For Outputs Testing');
    if (!found) throw new Error('Fixture registration not found: Selenium Registration For Outputs Testing');
    guid = found;
  });

  for (const resourceType of resourceTypes) {
    test(`add new resource - ${resourceType}`, async ({ page }) => {
      await page.goto(registrationUrl(guid));
      const regPage = new RegistrationPage(page);
      await regPage.openPracticeResourceData.click();
      await expect(regPage.addResourceButton).toBeVisible();

      const existingResourceId = await osfApi.getRegistrationResourceId(guid);
      if (existingResourceId) {
        await osfApi.deleteRegistrationResource(guid);
        await page.reload();
        await expect(regPage.resourceBlock).toHaveCount(0);
      }

      await regPage.addResourceButton.click();
      await regPage.doiInputField.fill('https://doi.org/10.1126/science.aar3646');
      await regPage.selectResourceType(resourceType);
      await regPage.previewButton.click();
      await regPage.resourceTypeAddButton.click();

      await expect(page.getByRole('heading', { name: resourceType, exact: true })).toBeVisible({
        timeout: 10000,
      });
      await osfApi.deleteRegistrationResource(guid);
    });
  }

  for (const resourceType of resourceTypes) {
    test(`edit resource - ${resourceType}`, async ({ page, fake }) => {
      const resourceDescription = fake.lorem.sentence(1);
      await osfApi.createRegistrationResource(guid, resourceType);
      await page.goto(registrationUrl(guid));
      const regPage = new RegistrationPage(page);
      await regPage.openPracticeResourceData.click();
      await regPage.resourceTypeEditButton.click();

      await regPage.doiInputField.fill('https://doi.org/10.1126/science.aar3646');
      await regPage.resourceDescription.fill(resourceDescription);
      await regPage.saveButton.click();

      await expect(regPage.resourceCardDescription).toHaveText(resourceDescription);
      await osfApi.deleteRegistrationResource(guid);
    });
  }

  for (const resourceType of resourceTypes) {
    test(`delete resource - ${resourceType}`, async ({ page }) => {
      await osfApi.createRegistrationResource(guid, resourceType);
      await page.goto(registrationUrl(guid));
      const regPage = new RegistrationPage(page);
      await regPage.openPracticeResourceData.click();
      await regPage.resourceTypeDeleteButton.click();
      await regPage.resourceTypeDeleteConfirm.click();

      await page.reload();
      await expect(page.getByRole('heading', { name: resourceType, exact: true })).toHaveCount(0);
    });
  }
});

test.describe('Registration Overview', { tag: '@core' }, () => {
  let guid: string;

  test.beforeEach(async ({ mustBeLoggedInAsRegistrationUser, hideMetadataFeaturePopover }) => {
    void mustBeLoggedInAsRegistrationUser;
    void hideMetadataFeaturePopover;
    test.skip(settings.PRODUCTION, 'Test should not run on production');
    const found = await osfApi.getRegistrationByTitle('Selenium Registration to Test Overview Page');
    if (!found) throw new Error('Fixture registration not found: Selenium Registration to Test Overview Page');
    guid = found;
  });

  test('verify registration overview', async ({ page, session }) => {
    const registrationData = await osfApi.getRegistrationDetails(session, guid);
    const apiDescription = registrationData.attributes.description;
    const apiTagsList: string[] = registrationData.attributes.tags;
    const apiCreatedDate = registrationData.attributes.date_created;
    const apiRegisteredDate = registrationData.attributes.date_registered;
    const apiRegistrationType = registrationData.attributes.registration_supplement;
    const apiRegistrationLicense = await osfApi.getRegistrationLicenseName(session, guid);
    const apiInstitutionList = await osfApi.getRegistrationInstitutions(session, guid);
    const apiProvider = await osfApi.getRegistrationProvider(session, guid);
    const apiSubjects = await osfApi.getRegistrationSubjects(session, guid);
    const apiAuthors = await osfApi.getRegistrationContributors(session, guid);
    const apiAssociatedProjectGuid = registrationData.relationships.registered_from.data.id;
    const apiRegistrationDoi = `10.70102/FK2OSF.IO/${guid.toUpperCase()}`;

    await page.goto(registrationUrl(guid));
    const regPage = new RegistrationPage(page);
    await regPage.verify();

    const uiDescription = (await regPage.overviewDescription.innerText()).trim();
    const uiTagsList = await regPage.getTagsList();
    const uiCreatedDate = (await regPage.overviewDateCreated.innerText()).trim();
    const uiRegisteredDate = (await regPage.registeredDate.innerText()).trim();
    const uiRegistrationType = (await regPage.overviewRegistrationType.innerText()).trim();
    // The license name resolves via its own follow-up lookup after the rest of the
    // overview loads (verified live: reading it right away raced an empty string).
    await expect(regPage.overviewLicense).not.toBeEmpty();
    const uiLicenseInfo = (await regPage.overviewLicense.innerText()).trim();
    const uiSubjectsList = await regPage.getSubjectsList();
    const uiAuthorsList = await regPage.getAuthorsList();
    const uiAssociatedProject = (await regPage.associatedProject.innerText()).trim();
    const uiRegistrationDoi = (await regPage.registrationDoi.innerText()).trim();

    expect(uiDescription).toBe(apiDescription);
    if (settings.DOMAIN !== 'stage3') {
      expect(normalizeUiDate(uiCreatedDate)).toBe(normalizeApiDate(apiCreatedDate));
      expect(normalizeUiDate(uiRegisteredDate)).toBe(normalizeApiDate(apiRegisteredDate));
    }

    if (settings.DOMAIN !== 'stage1') {
      const uiRegistry = (await regPage.overviewRegistry.innerText()).trim();
      expect(uiRegistry).toBe(apiProvider);
      const uiAffiliatedInstitutionList = await regPage.getAffiliationsList();
      expect([...uiAffiliatedInstitutionList].sort()).toEqual([...apiInstitutionList].sort());
    }

    expect([...uiTagsList].sort()).toEqual([...apiTagsList].sort());
    expect(uiRegistrationType).toBe(apiRegistrationType);
    expect(uiLicenseInfo).toBe(apiRegistrationLicense);
    expect([...uiSubjectsList].sort()).toEqual([...apiSubjects].sort());
    expect(uiAssociatedProject).toContain(apiAssociatedProjectGuid);
    expect(uiRegistrationDoi).toBe(apiRegistrationDoi);

    let lastName = '';
    let lastProfileName = '';
    for (const { name, link } of uiAuthorsList) {
      if (!link) continue;
      await page.goto(link);
      lastProfileName = (await page.locator('h1').first().innerText()).trim();
      expect(apiAuthors).toContain(name);
      lastName = name;
    }
    expect(lastProfileName).toContain(lastName);
  });
});

test.describe('Registration Contributors', { tag: '@core' }, () => {
  let guid: string;

  test.beforeEach(async ({ mustBeLoggedInAsRegistrationUser, hideMetadataFeaturePopover }) => {
    void mustBeLoggedInAsRegistrationUser;
    void hideMetadataFeaturePopover;
    test.skip(settings.PRODUCTION, 'Test should not run on production');
    const found = await osfApi.getRegistrationByTitle('Selenium Registration to Test Contributors Page');
    if (!found) throw new Error('Fixture registration not found: Selenium Registration to Test Contributors Page');
    guid = found;
  });

  test('add contributors', async ({ page }) => {
    const newUser = settings.PRODUCTION ? 'OSF Tester1' : 'OSF Runscope Admin';

    await osfApi.deleteRegistrationContributor(guid, newUser);
    await page.goto(registrationUrl(guid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();

    let contributorsList = await contributorsPage.getContributorsList();
    expect(contributorsList).not.toContain(newUser);

    await contributorsPage.clickOnButton('Add Contributor');
    await contributorsPage.addContributorModal.searchInput.fill(newUser);
    await contributorsPage.addContributorModal.selectContributorCheckboxByName(newUser);
    await contributorsPage.addContributorModal.clickOnNext();
    await contributorsPage.addContributorModal.clickOnButton('Done');

    await page.reload();
    await contributorsPage.verify();
    contributorsList = await contributorsPage.getContributorsList();
    expect(contributorsList).toContain(newUser);

    await contributorsPage.searchFor(newUser);
    await expect(contributorsPage.contributorName).toHaveText(newUser);
  });

  test('edit contributor permission', async ({ page }) => {
    const contributorName = 'OSF Runscope Admin';
    const newPermission = 'Administrator';

    await page.goto(registrationUrl(guid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();

    const contributorsList = await contributorsPage.getContributorsList();
    expect(contributorsList).toContain(contributorName);

    await contributorsPage.searchFor(contributorName);
    const originalPermission = (await contributorsPage.userPermission.innerText()).trim();
    expect(originalPermission).not.toBe(newPermission);

    await contributorsPage.selectPermissionFromDropdownListbox(newPermission);
    await contributorsPage.clickOnButton('Save');
    const permissionAfterChange = (await contributorsPage.userPermission.innerText()).trim();
    expect(permissionAfterChange).toBe(newPermission);

    await contributorsPage.selectPermissionFilterFromDropdownList(newPermission);
    const adminFilteredList = await contributorsPage.getContributorsList();
    expect(adminFilteredList).toContain(contributorName);

    await contributorsPage.selectPermissionFilterFromDropdownList('Read');
    const readFilteredList = await contributorsPage.getContributorsList();
    expect(readFilteredList).not.toContain(contributorName);

    await contributorsPage.selectPermissionFilterFromDropdownList('Read + Write');
    const writeFilteredList = await contributorsPage.getContributorsList();
    expect(writeFilteredList).not.toContain(contributorName);
  });

  test('edit bibliographic status', async ({ page }) => {
    const contributorName = 'OSF Runscope Admin';

    await page.goto(registrationUrl(guid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();

    await contributorsPage.selectBibliographyFilterFromDropdownList('Bibliographic');
    const contributorsList = await contributorsPage.getContributorsList();
    expect(contributorsList).toContain(contributorName);

    await page.reload();
    await contributorsPage.verify();
    await contributorsPage.searchFor(contributorName);
    await contributorsPage.clickOnBibliographicCheckbox();
    await contributorsPage.clickOnButton('Save');
    await page.reload();
    await contributorsPage.verify();

    await contributorsPage.selectBibliographyFilterFromDropdownList('Bibliographic');
    const bibliographicUsers = await contributorsPage.getContributorsList();
    expect(bibliographicUsers).not.toContain(contributorName);

    await page.reload();
    await contributorsPage.verify();
    await contributorsPage.selectBibliographyFilterFromDropdownList('Non-Bibliographic');
    const nonBibliographicUsers = await contributorsPage.getContributorsList();
    expect(nonBibliographicUsers).toContain(contributorName);
  });

  test('reorder contributors', async ({ page }) => {
    await page.goto(registrationUrl(guid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();

    const contributorsList = (await contributorsPage.getContributorsList()).map((name) => name.trim());
    expect(contributorsList.length, 'reorder needs at least 3 contributors').toBeGreaterThan(2);
    const sourceOrder = contributorsList.length - 1;
    const contributorName = contributorsList[sourceOrder];
    const targetOrder = 1;
    const rows = contributorsPage.tableRows;
    const sourceHandle = rows.nth(sourceOrder).locator('div.p-datatable-reorderable-row-handle');
    const targetHandle = rows.nth(targetOrder).locator('div.p-datatable-reorderable-row-handle');
    await sourceHandle.dragTo(targetHandle);

    await contributorsPage.clickOnButton('Save');
    await expect(page.getByRole('heading', { name: 'Contributors', exact: true })).toBeVisible();

    await page.reload();
    await contributorsPage.verify();
    const newOrder = await contributorsPage.getOrderOfContributor(contributorName);
    expect(newOrder).toBe(targetOrder);
  });

  test('remove contributors', async ({ page }) => {
    const newUser = 'OSF Runscope Admin';

    await page.goto(registrationUrl(guid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();

    const contributorsList = await contributorsPage.getContributorsList();
    expect(contributorsList).toContain(newUser);

    await page.reload();
    await contributorsPage.verify();
    await contributorsPage.searchFor(newUser);
    await contributorsPage.removeButton.click();
    await contributorsPage.clickOnButton('Remove');

    await page.reload();
    await contributorsPage.verify();
    const contributorsListAfter = await contributorsPage.getContributorsList();
    expect(contributorsListAfter).not.toContain(newUser);
  });
});

test.describe('Registration View-Only Links', { tag: '@core' }, () => {
  let guid: string;

  test.beforeEach(async ({ mustBeLoggedInAsRegistrationUser, hideMetadataFeaturePopover }) => {
    void mustBeLoggedInAsRegistrationUser;
    void hideMetadataFeaturePopover;
    test.skip(settings.PRODUCTION, 'Test should not run on production');
    const found = await osfApi.getRegistrationByTitle('Selenium Registration to Test View Only Links');
    if (!found) throw new Error('Fixture registration not found: Selenium Registration to Test View Only Links');
    guid = found;
  });

  test('anonymous registration view only link', async ({ page }) => {
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.gotoAndWaitForVolList(guid);

    const volName = `Selenium_AVOL_${new Date().toISOString()}`;
    await contributorsPage.volSection.scrollIntoViewIfNeeded();
    await contributorsPage.clickOnButton('Create');
    await contributorsPage.createVolModal.linkNameInput.fill(volName);
    await contributorsPage.createVolModal.clickOnButton('Create');

    await expect(contributorsPage.linkName).toHaveText(volName);
    const volUrl = await contributorsPage.volLinkFor(volName).getAttribute('id');
    if (!volUrl) throw new Error('VOL URL not found.');

    await logout(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.goto(volUrl);
    const volOverviewPage = new RegistrationPage(page);
    await volOverviewPage.verify();

    await expect(volOverviewPage.alertInfoMessage).toHaveText(
      'You are viewing OSF through a view-only link, which may limit the data you have permission to see.'
    );
    await expect(volOverviewPage.volContributorsText).toHaveText('Anonymous Contributors');
  });

  test('view files registration view only link', async ({ page, hideFooterSlideIn }) => {
    void hideFooterSlideIn;
    const volKey = await osfApi.getRegistrationVolKey(guid);
    if (!volKey) throw new Error('No view-only link found for fixture registration.');

    await logout(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.goto(`${settings.OSF_HOME}/${guid}/files?view_only=${volKey}`);
    const filesPage = new RegistrationFilesListPage(page);
    await filesPage.verify();

    expect(await present(new Navbar(page).signInButton, settings.QUICK_TIMEOUT_MS)).toBe(true);
    await expect(page.locator('div.flex.w-full.align-items-center.justify-content-between > p')).toHaveText(
      'You are viewing OSF through a view-only link, which may limit the data you have permission to see.'
    );
  });

  test('view analytics registration view only link', async ({ page }) => {
    const volKey = await osfApi.getRegistrationVolKey(guid);
    if (!volKey) throw new Error('No view-only link found for fixture registration.');

    await logout(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.goto(`${settings.OSF_HOME}/${guid}/analytics?view_only=${volKey}`);
    const analyticsPage = new RegistrationAnalyticsPage(page);
    await analyticsPage.verify();

    expect(await present(new Navbar(page).signInButton, settings.QUICK_TIMEOUT_MS)).toBe(true);
    await expect(analyticsPage.alertInfoMessage).toHaveText(
      'You are viewing OSF through a view-only link, which may limit the data you have permission to see.'
    );
  });

  test('view wiki registration view only link', async () => {
    test.skip(true, 'Wiki page not available');
  });

  test('delete anonymous registration view only link', async ({ page }) => {
    await page.goto(registrationUrl(guid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();

    await contributorsPage.volSection.scrollIntoViewIfNeeded();
    await expect(contributorsPage.linkName).not.toBeEmpty();
    const volName = (await contributorsPage.linkName.innerText()).trim();
    await contributorsPage.volDeleteButtonFor(volName).click();
    await contributorsPage.deleteVolModal.clickOnButton('Delete');

    expect(await contributorsPage.verifyLinkPresent(volName)).toBe(true);
  });

  test('non anonymous registration view only link', async ({ page }) => {
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.gotoAndWaitForVolList(guid);

    const volName = `Selenium_VOL_${new Date().toISOString()}`;
    await contributorsPage.volSection.scrollIntoViewIfNeeded();
    await contributorsPage.clickOnButton('Create');
    await contributorsPage.createVolModal.linkNameInput.fill(volName);
    await contributorsPage.createVolModal.selectAnonymousCheckbox();
    await contributorsPage.createVolModal.clickOnButton('Create');

    await expect(contributorsPage.linkName).toHaveText(volName);
    const volUrl = await contributorsPage.volLinkFor(volName).getAttribute('id');
    if (!volUrl) throw new Error('VOL URL not found.');

    await logout(page);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.goto(volUrl);
    const volOverviewPage = new RegistrationPage(page);
    await volOverviewPage.verify();

    await expect(volOverviewPage.alertInfoMessage).toHaveText(
      'You are viewing OSF through a view-only link, which may limit the data you have permission to see.'
    );
    const contributorsList = await volOverviewPage.getAuthorsList();
    expect(contributorsList.length).toBeGreaterThan(0);
  });

  test('delete non anonymous registration view only link', async ({ page }) => {
    await page.goto(registrationUrl(guid, 'contributors'));
    const contributorsPage = new RegistrationContributorsPage(page);
    await contributorsPage.verify();

    await contributorsPage.volSection.scrollIntoViewIfNeeded();

    await expect(contributorsPage.linkName).not.toBeEmpty();
    const volName = (await contributorsPage.linkName.innerText()).trim();
    await contributorsPage.volDeleteButtonFor(volName).click();
    await contributorsPage.deleteVolModal.clickOnButton('Delete');

    expect(await contributorsPage.verifyLinkPresent(volName)).toBe(true);
  });
});

test.describe('Registration Wiki', { tag: '@core' }, () => {
  let guid: string;

  test.beforeEach(async ({ mustBeLoggedInAsRegistrationUser, hideMetadataFeaturePopover }) => {
    void mustBeLoggedInAsRegistrationUser;
    void hideMetadataFeaturePopover;
    test.skip(settings.PRODUCTION, 'Test should not run on production');
    const found = await osfApi.getRegistrationByTitle('Selenium Registration to Test Wiki Page');
    if (!found) throw new Error('Fixture registration not found: Selenium Registration to Test Wiki Page');
    guid = found;
  });

  test('view wiki versions', async ({ page }) => {
    const originalText = 'Selenium Testing - Wiki Home Page';
    await page.goto(registrationUrl(guid, 'wiki'));
    const wikiPage = new RegistrationWikiPage(page);
    await wikiPage.verify();

    await expect(wikiPage.wikiVersion).toContainText('(Current)');
    await expect(wikiPage.wikiPreviewText).toHaveText(originalText);

    await wikiPage.selectVersionFromDropdown('(1)');
    await expect(wikiPage.wikiEmptyText).toHaveText(
      'Add important information, links, or images here to describe your project.'
    );
  });

  test('compare wiki versions', async ({ page }) => {
    const wikiText = 'Selenium Testing - Wiki Home Page';
    await page.goto(registrationUrl(guid, 'wiki'));
    const wikiPage = new RegistrationWikiPage(page);
    await wikiPage.verify();

    await wikiPage.clickOnButton('View');
    await wikiPage.clickOnButton('Compare');
    await expect(page.getByRole('heading', { name: 'Compare', exact: true })).toBeVisible({
      timeout: 15000,
    });

    await expect(wikiPage.comparePreviewText).toHaveText('Live preview to:');
    await expect(wikiPage.wikiPreviewText).toHaveText(wikiText);
    await expect(wikiPage.compareText).toHaveText(wikiText);
  });
});
