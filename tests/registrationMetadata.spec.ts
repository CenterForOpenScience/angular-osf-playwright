import { Page } from '@playwright/test';
import { Faker } from '@faker-js/faker';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { RegistrationMetadataPage, registrationUrl } from '../src/pages/RegistrationPage';


const TITLE = 'Selenium Registration for Metadata tests';

type MetadataFixtures = {
  registrationGuid: string;
  registrationMetadataPage: RegistrationMetadataPage;
};

const test = base.extend<MetadataFixtures>({
  registrationGuid: async ({}, use) => {
    const guid = await osfApi.getRegistrationByTitle(TITLE);
    if (!guid) throw new Error(`Registration with title '${TITLE}' not found on the server.`);
    await use(guid);
  },

  registrationMetadataPage: async ({ page, registrationGuid }, use) => {
    await osfApi.updateRegistrationMetadataWithCustomData(registrationGuid);
    await page.goto(registrationUrl(registrationGuid, 'metadata/osf'));
    const metadataPage = new RegistrationMetadataPage(page);
    await metadataPage.verify();
    await use(metadataPage);
  },
});


function generateAwardInformation(fake: Faker): {
  awardTitle: string;
  awardUri: string;
  awardNumber: string;
} {
  const id = fake.string.alphanumeric(8);
  return {
    awardTitle: `Selenium award ${id}`,
    awardUri: `https://example.org/awards/${id}`,
    awardNumber: `AWD-${id}`,
  };
}

async function waitForSave(page: Page, action: () => Promise<void>): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() !== 'GET' && response.url().includes('/v2/')
    ),
    action(),
  ]);
}

async function reloadMetadataPage(metadataPage: RegistrationMetadataPage, page: Page): Promise<void> {
  await page.reload();
  await metadataPage.verify();
}

test.describe('Registration Metadata', { tag: '@core' }, () => {
  test.beforeEach(async ({ mustBeLoggedInAsRegistrationUser, hideMetadataFeaturePopover }) => {
    void mustBeLoggedInAsRegistrationUser;
    void hideMetadataFeaturePopover;
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('edit metadata title and description', async ({
    registrationMetadataPage,
    registrationGuid,
    fake,
  }) => {
    const newTitle = TITLE;
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
      await osfApi.updateRegistrationTitle(registrationGuid, TITLE).catch((error) => {
        console.error('\n=== CLEANUP FAILED (IGNORED) ===');
        console.error(`Error: ${error}`);
      });
    }
  });

  test('add contributors', async ({ page, registrationMetadataPage, registrationGuid }) => {
    const newUser = settings.PRODUCTION ? 'OSF Tester1' : 'OSF Runscope Admin';

    await osfApi.deleteRegistrationContributor(registrationGuid, newUser);
    await reloadMetadataPage(registrationMetadataPage, page);
    await registrationMetadataPage.clickOnEdit('Contributors');
    await registrationMetadataPage.editContributorsModal.clickOnButton('Add Contributor');
    await registrationMetadataPage.addContributorModal.searchFor(newUser);
    await registrationMetadataPage.addContributorModal.selectContributorCheckboxByName(newUser);
    await registrationMetadataPage.addContributorModal.clickOnNext();
    await registrationMetadataPage.addContributorModal.clickOnButton('Done');

    await expect(registrationMetadataPage.getContributorNameModalWindow(newUser)).toHaveText(newUser);

    await registrationMetadataPage.editContributorsModal.clickOnButton('Close');
    await expect(registrationMetadataPage.getContributorName(newUser)).toHaveText(newUser);
  });

  test('edit contributor permission', async ({ registrationMetadataPage }) => {
    const contributorName = 'OSF Runscope Admin';
    const newPermission = 'Administrator';

    const contributorsList = await registrationMetadataPage.getContributorsList();
    expect(contributorsList).toContain(contributorName);

    await registrationMetadataPage.clickOnEdit('Contributors');
    const modal = registrationMetadataPage.editContributorsModal;
    await modal.searchFor(contributorName);
    const originalPermission = (await modal.userPermission(contributorName).innerText()).trim();
    expect(originalPermission).not.toBe(newPermission);

    await modal.selectFromDropdownListbox(contributorName, newPermission);
    await modal.clickOnButton('Save');
    await expect(modal.userPermission(contributorName)).toHaveText(newPermission);
  });

  test('edit bibliographic status for contributor', async ({ registrationMetadataPage }) => {
    const contributorName = 'OSF Runscope Admin';

    const contributorsList = await registrationMetadataPage.getContributorsList();
    expect(contributorsList).toContain(contributorName);

    await registrationMetadataPage.clickOnEdit('Contributors');
    const modal = registrationMetadataPage.editContributorsModal;
    await modal.searchFor(contributorName);
    await modal.clickOnBibliographicCheckbox(contributorName);
    await modal.clickOnButton('Save');
    await modal.clickOnButton('Close');

    await expect(registrationMetadataPage.getContributorName(contributorName)).toHaveCount(0);
    expect(await registrationMetadataPage.getContributorsList()).not.toContain(contributorName);
  });


  test('remove contributors', async ({ page, session, registrationMetadataPage, registrationGuid }) => {
    const newUser = settings.PRODUCTION ? 'OSF Tester1' : 'OSF Runscope Admin';

    await reloadMetadataPage(registrationMetadataPage, page);
    await registrationMetadataPage.clickOnEdit('Contributors');
    const modal = registrationMetadataPage.editContributorsModal;
    await modal.searchFor(newUser);
    await modal.removeButton(newUser).click();
    await modal.removeConfirmButton.click();
    await expect(modal.rowFor(newUser)).toHaveCount(0);
    await modal.clickOnButton('Close');

    expect(await registrationMetadataPage.getContributorsList()).not.toContain(newUser);
    expect(await osfApi.getRegistrationContributors(session, registrationGuid)).not.toContain(newUser);
  });

  test('edit resource information', async ({ registrationMetadataPage }) => {
    const origResourceType = await registrationMetadataPage.resourceType.innerText();
    const origResourceLanguage = await registrationMetadataPage.resourceLanguage.innerText();

    await registrationMetadataPage.clickOnEdit('Resource Information');
    await registrationMetadataPage.resourceTypeDropdown.click();
    await registrationMetadataPage.selectOption('Book');
    await registrationMetadataPage.resourceLanguageDropdown.click();
    await registrationMetadataPage.selectFromVirtualScrollList('Bengali');
    await registrationMetadataPage.resourceInformationSaveButton.click();

    await expect(registrationMetadataPage.resourceType).not.toHaveText(origResourceType);
    await expect(registrationMetadataPage.resourceLanguage).not.toHaveText(origResourceLanguage);
  });

  test('edit support funding information', async ({
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

  test('add affiliation', async ({ page, registrationMetadataPage }) => {
    const institutionId = 'cos';

    expect(await registrationMetadataPage.getAffiliationsList()).not.toContain(institutionId);

    await registrationMetadataPage.clickOnEdit('Affiliated Institutions');
    await registrationMetadataPage.editAffiliationsModal.clickOnCheckbox(institutionId);
    await waitForSave(page, () => registrationMetadataPage.editAffiliationsModal.saveAffiliationsButton.click());
    await reloadMetadataPage(registrationMetadataPage, page);

    await expect
      .poll(() => registrationMetadataPage.getAffiliationsList())
      .toContain(institutionId);
  });

  test('remove affiliation', async ({ page, registrationMetadataPage }) => {
    const institutionId = 'cos';

    await expect
      .poll(() => registrationMetadataPage.getAffiliationsList())
      .toContain(institutionId);

    await registrationMetadataPage.clickOnEdit('Affiliated Institutions');
    await registrationMetadataPage.editAffiliationsModal.clickOnCheckbox(institutionId);
    await waitForSave(page, () => registrationMetadataPage.editAffiliationsModal.saveAffiliationsButton.click());
    await reloadMetadataPage(registrationMetadataPage, page);

    await expect(registrationMetadataPage.section('Affiliated Institutions').locator('osf-affiliated-institutions-view')).toBeVisible();
    expect(await registrationMetadataPage.getAffiliationsList()).not.toContain(institutionId);
  });

  test('add top level subject', async ({ page, registrationGuid, registrationMetadataPage }) => {
    const newTopLevelSubject = 'Business';

    await osfApi.updateRegistrationSubjects(registrationGuid, ['Engineering']);
    await reloadMetadataPage(registrationMetadataPage, page);
    await expect(registrationMetadataPage.section('Subjects').getByRole('tree')).toBeVisible();
    expect(await registrationMetadataPage.getSubjectList()).not.toContain(newTopLevelSubject);

    await waitForSave(page, () => registrationMetadataPage.selectTopLevelSubject(newTopLevelSubject));
    await reloadMetadataPage(registrationMetadataPage, page);

    await expect(registrationMetadataPage.subjectChip(newTopLevelSubject)).toBeVisible();
  });

  test('remove top level subject', async ({ page, registrationMetadataPage }) => {
    const topLevelSubject = 'Business';

    await expect(registrationMetadataPage.subjectChip(topLevelSubject)).toBeVisible();

    await waitForSave(page, () => registrationMetadataPage.removeSubject(topLevelSubject));
    await reloadMetadataPage(registrationMetadataPage, page);

    await expect(registrationMetadataPage.section('Subjects').getByRole('tree')).toBeVisible();
    expect(await registrationMetadataPage.getSubjectList()).not.toContain(topLevelSubject);
  });

  test('update license', async ({ registrationMetadataPage }) => {
    const newLicense = 'CC-By Attribution 4.0 International';

    await registrationMetadataPage.clickOnEdit('License');
    await registrationMetadataPage.editLicenseModal.selectFromDropdownListbox(newLicense);
    await registrationMetadataPage.editLicenseModal.saveButton.click();

    await expect(registrationMetadataPage.licenseInfo).toHaveText(newLicense);
  });

  test('add tag', async ({ page, registrationMetadataPage }) => {
    const newTag = 'automation test';

    await expect(registrationMetadataPage.tagInput).toBeVisible();
    expect(await registrationMetadataPage.getTagsList()).not.toContain(newTag);

    await registrationMetadataPage.tagInput.fill(newTag);
    await waitForSave(page, () => registrationMetadataPage.tagInput.press('Enter'));

    await expect(registrationMetadataPage.tagChip(newTag)).toBeVisible();
  });

  test('remove tag', async ({ page, registrationMetadataPage }) => {
    const newTag = 'automation test';

    await expect(registrationMetadataPage.tagChip(newTag)).toBeVisible();

    await waitForSave(page, () => registrationMetadataPage.clickOnRemoveTag(newTag));

    await expect(registrationMetadataPage.tagChip(newTag)).toHaveCount(0);
  });
});
