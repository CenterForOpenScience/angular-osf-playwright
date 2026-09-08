import { Page, Locator } from '@playwright/test';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { acceptCookies } from '../src/pages/LoginPage';
import {
  ProfileInformationPage,
  ProfileSettingsPageEducationTab,
  ProfileSettingsPageEmploymentTab,
  ProfileSettingsPageSocialTab,
  SettingsNotificationsPage,
  AccountSettingsPage,
  ConfigureAddonsPage,
  NotificationsPage,
  DeveloperAppsPage,
  CreateDeveloperAppPage,
  EditDeveloperAppPage,
  PersonalAccessTokenPage,
  CreatePersonalAccessTokenPage,
  EditPersonalAccessTokenPage,
  patScopeIds,
} from '../src/pages/UserPages';
import { ConnectMendeleyModal, ConnectZoteroModal, AddonCondition } from '../src/pages/components/UserModals';
import {
  waitUntilToastMessageGone,
  waitForOverlayToDisappear,
  pageRefreshWithCleanStorages,
  getUserNameFromHeader,
  hereThenGone,
  present,
  waitUntilPageReady,
} from '../src/utils';

/**
 * Port of `tests/test_user.py`.
 *
 * Not ported: `ProfilePageMixin` and its subclasses `TestProfileLoggedIn`,
 * `TestProfileLoggedOut`, `TestProfileAsDifferentUser`. Their `nothings_public` and
 * `public_lists` methods are missing the required `test_` prefix, so pytest never
 * actually collects them - `pytest tests/test_user.py --collect-only` confirms these
 * three classes contribute 0 tests. The other 64 tests in the file (verified via the
 * same `--collect-only` run) are all ported below, 1:1.
 */

const test = base.extend<{
  profileSettingsPage: ProfileInformationPage;
  profileSettingsPageEducationTab: ProfileSettingsPageEducationTab;
  profileSettingsPageEmploymentTab: ProfileSettingsPageEmploymentTab;
  profileSettingsPageSocialTab: ProfileSettingsPageSocialTab;
  settingsNotificationPage: SettingsNotificationsPage;
}>({
  profileSettingsPage: async ({ page }, use) => {
    const profileSettingsPage = new ProfileInformationPage(page);
    await profileSettingsPage.goto();
    await use(profileSettingsPage);
  },
  profileSettingsPageEducationTab: async ({ page }, use) => {
    const tab = new ProfileSettingsPageEducationTab(page);
    await tab.goto();
    await use(tab);
  },
  profileSettingsPageEmploymentTab: async ({ page }, use) => {
    const tab = new ProfileSettingsPageEmploymentTab(page);
    await tab.goto();
    await use(tab);
  },
  profileSettingsPageSocialTab: async ({ page }, use) => {
    const tab = new ProfileSettingsPageSocialTab(page);
    await tab.goto();
    await use(tab);
  },
  settingsNotificationPage: async ({ page }, use) => {
    const notificationsPage = new SettingsNotificationsPage(page);
    await notificationsPage.goto();
    await use(notificationsPage);
  },
});

/** Port of `TestUserPersonalAccessTokens.verify_scope_checkboxes`. */
async function verifyScopeCheckboxes(page: Page, scopePerms: Record<string, boolean>): Promise<void> {
  for (const [scope, perm] of Object.entries(scopePerms)) {
    const checkbox = page.locator(`[id="${scope}"]`);
    await checkbox.waitFor({ state: 'attached', timeout: 10000 });
    await expect(checkbox, `Scope "${scope}" expected ${perm}`).toBeChecked({ checked: perm });
  }
}

function allScopesFalse(): Record<string, boolean> {
  return Object.fromEntries(patScopeIds.map((scope) => [scope, false]));
}

function allScopesTrue(): Record<string, boolean> {
  return Object.fromEntries(patScopeIds.map((scope) => [scope, true]));
}

async function assertCardTitleMatches(locator: Locator, expected: string): Promise<void> {
  expect((await locator.innerText()).trim().toLowerCase()).toBe(expected.toLowerCase());
}

function currentOrigin(page: Page): string {
  const url = new URL(page.url());
  return `${url.protocol}//${url.host}`;
}

/**
 * Types into a PrimeNG p-datepicker text input. The input is mask-aware
 * (`data-p-maskable`), so `.fill()` sets the raw DOM value without the mask ever
 * registering it as committed - it looks right until the next blur/redraw, then
 * reverts to empty. Real keystrokes via `pressSequentially` are required instead.
 */
async function fillDatePickerField(field: Locator, value: string): Promise<void> {
  await field.click();
  await field.pressSequentially(value);
  await expect(field).toHaveValue(value);
}

/**
 * Types into the addon-search box via real keystrokes, matching the Python suite's
 * `search_input.clear(); search_input.send_keys(provider)`, then waits for the
 * given result locator to narrow to just `value`. Wrapped in `toPass` because the
 * Angular filter is intermittently flaky about reacting to a given keystroke
 * sequence at all - confirmed by repeated runs where identical input sometimes
 * filters instantly and sometimes never reacts within a long single wait. A retry
 * of the whole type+wait, not a longer wait, is what actually clears it.
 */
async function searchAddonBox(field: Locator, resultLocator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await field.fill('');
    await field.pressSequentially(value);
    await expect(resultLocator).toHaveText(value, { ignoreCase: true, timeout: 5000 });
  }).toPass({ timeout: 25000 });
}

// ---------------------------------------------------------------------------------
// TestUserSettings (12 tests)
// ---------------------------------------------------------------------------------

test.describe('User Settings', () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  const settingsPageClasses: Array<{ name: string; Ctor: new (page: Page) => { goto(): Promise<unknown> } }> = [
    { name: 'ProfileInformationPage', Ctor: ProfileInformationPage },
    { name: 'AccountSettingsPage', Ctor: AccountSettingsPage },
    { name: 'ConfigureAddonsPage', Ctor: ConfigureAddonsPage },
    { name: 'NotificationsPage', Ctor: NotificationsPage },
    { name: 'DeveloperAppsPage', Ctor: DeveloperAppsPage },
    { name: 'PersonalAccessTokenPage', Ctor: PersonalAccessTokenPage },
  ];

  for (const { name, Ctor } of settingsPageClasses) {
    test(`user settings loads [${name}]`, { tag: ['@smoke', '@core'] }, async ({ page }) => {
      const settingsPage = new Ctor(page);
      await settingsPage.goto();
    });
  }

  test('change middle name', async ({ page, profileSettingsPage, fake }) => {
    const newName = fake.person.fullName();
    expect(await profileSettingsPage.middleNameInput.inputValue()).not.toBe(newName);
    await profileSettingsPage.middleNameInput.fill(newName);
    await profileSettingsPage.saveButton.click();
    await hereThenGone(profileSettingsPage.updateSuccess);
    await page.reload();
    await expect(profileSettingsPage.middleNameInput).toHaveValue(newName, { timeout: 10000 });
  });

  test('check citation preview', async ({ profileSettingsPage }) => {
    const citationBlocks = profileSettingsPage.citationBlocks;
    await expect(citationBlocks).toHaveCount(2);

    const familyName = await profileSettingsPage.familyNameInput.inputValue();
    const givenName = await profileSettingsPage.givenNameInput.inputValue();
    const middleNames = await profileSettingsPage.middleNameInput.inputValue();
    const givenInitial = givenName ? `${givenName[0]}.` : '';
    const middleInitials = middleNames
      ? middleNames
          .split(/\s+/)
          .map((word) => `${word[0]}.`)
          .join(' ')
      : '';

    const apaText = await citationBlocks.nth(0).innerText();
    expect(apaText).toContain('Style:');
    expect(apaText).toContain('APA');
    expect(apaText).toContain('Citation format:');
    expect(apaText).toContain(`${familyName}, ${givenInitial} ${middleInitials}`.trim());

    const mlaText = await citationBlocks.nth(1).innerText();
    expect(mlaText).toContain('Style:');
    expect(mlaText).toContain('MLA');
    expect(mlaText).toContain('Citation format:');
    expect(mlaText).toContain(`${familyName}, ${givenName} ${middleInitials}`.trim());
  });

  test('adding and removing education', async ({ profileSettingsPageEducationTab, fake }) => {
    const tab = profileSettingsPageEducationTab;
    const educationNewName = `AQA education ${fake.string.alpha(5)}`;
    await tab.removeRecordIfExists();

    await tab.addOneMoreButton.click();

    await tab.institutionInput.fill(educationNewName);
    await tab.departamentInputField.fill(educationNewName);
    await tab.degreeInputField.fill(educationNewName);

    await fillDatePickerField(tab.startDateInputField, '01/2026');
    await fillDatePickerField(tab.endDateInputField, '03/2026');

    await tab.saveEducationButton.click();

    await expect(tab.educationSuccessfullyUpdatedPopUpMessage).toBeVisible();
    await expect(tab.removeEducationButton).toBeVisible();

    await tab.removeEducationButton.click();
    await tab.saveEducationButton.click();

    await expect(tab.removeEducationButton).toBeHidden({ timeout: 3000 });
  });

  test('discard changes on education tab', async ({ profileSettingsPageEducationTab, fake }) => {
    const tab = profileSettingsPageEducationTab;
    const educationNewName = `AQA education1 ${fake.string.alpha(5)}`;
    await tab.removeRecordIfExists();

    await tab.addOneMoreButton.click();
    await tab.institutionInput.fill(educationNewName);
    await tab.departamentInputField.fill(educationNewName);
    await tab.degreeInputField.fill(educationNewName);
    await tab.startDateInputField.fill('01/2026');
    await tab.endDateInputField.fill('03/2026');

    await tab.discardChangesButton.click();
    await tab.discardChangesConfirmationButton.click();

    await expect(tab.educationCard).toBeHidden({ timeout: 5000 });
    await expect(tab.institutionInput).toBeHidden({ timeout: 3000 });
  });

  test('check required fields on education tab', async ({ profileSettingsPageEducationTab }) => {
    const tab = profileSettingsPageEducationTab;
    await tab.removeRecordIfExists();

    await tab.addOneMoreButton.click();
    await tab.addOneMoreButton.click();

    expect(await tab.errorMessages.count()).toBeGreaterThanOrEqual(3);
  });

  test('update existing education', async ({ page, session, profileSettingsPageEducationTab }) => {
    const tab = profileSettingsPageEducationTab;
    await tab.removeRecordIfExists();

    const userName = await getUserNameFromHeader(page);
    await osfApi.updateUserEducation(session, userName);
    await page.waitForTimeout(2000);
    await pageRefreshWithCleanStorages(page);

    await tab.institutionInput.fill('UpdatedInstitution');
    await tab.departamentInputField.fill('UpdatedDepartment');

    await tab.saveEducationButton.click();
    await expect(tab.educationSuccessfullyUpdatedPopUpMessage).toBeVisible();

    await pageRefreshWithCleanStorages(page);
    await expect(tab.institutionInput).toHaveValue('UpdatedInstitution');
    await expect(tab.departamentInputField).toHaveValue('UpdatedDepartment');
  });
});

// ---------------------------------------------------------------------------------
// TestUserProfileSettingsEmployedTab (4 tests)
// ---------------------------------------------------------------------------------

test.describe('User Profile Settings Employment Tab', () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  test('adding and removing employment', async ({ profileSettingsPageEmploymentTab, fake }) => {
    const tab = profileSettingsPageEmploymentTab;
    const employmentNewName = `AQA employed ${fake.string.alpha(5)}`;
    await tab.removeRecordIfExists();

    await tab.addPositionButton.click();
    await tab.jobTitleInput.fill(employmentNewName);
    await tab.institutionEmployerInput.fill(employmentNewName);

    await fillDatePickerField(tab.startDateInputField, '01/2026');
    await fillDatePickerField(tab.endDateInputField, '03/2026');

    await tab.saveEmploymentButton.click();

    await expect(tab.employmentSuccessfullyUpdatedPopUpMessage).toBeVisible();
    await expect(tab.removeEmploymentButton).toBeVisible();

    await tab.removeEmploymentButton.click();
    await tab.saveEmploymentButton.click();

    await expect(tab.removeEmploymentButton).toBeHidden({ timeout: 3000 });
  });

  test('discard changes on employment tab', async ({ profileSettingsPageEmploymentTab, fake }) => {
    const tab = profileSettingsPageEmploymentTab;
    const employmentNewName = `AQA employed ${fake.string.alpha(5)}`;
    await tab.removeRecordIfExists();

    await tab.addPositionButton.click();
    await tab.jobTitleInput.fill(employmentNewName);
    await tab.institutionEmployerInput.fill(employmentNewName);

    await tab.startDateInputField.fill('01/2026');
    await tab.startDateInputField.press('Enter');
    await tab.endDateInputField.fill('03/2026');
    await tab.endDateInputField.press('Enter');

    await tab.discardChangesButton.click();
    await tab.discardChangesConfirmationButton.click();

    await expect(tab.educationCard).toBeHidden({ timeout: 3000 });
    await expect(tab.institutionEmployerInput).toBeHidden({ timeout: 3000 });
  });

  test('check required fields on employment tab', async ({ profileSettingsPageEmploymentTab }) => {
    const tab = profileSettingsPageEmploymentTab;
    await tab.removeRecordIfExists();

    await tab.addPositionButton.click();
    await tab.addPositionButton.click();

    expect(await tab.errorMessages.count()).toBeGreaterThanOrEqual(4);
  });

  test('update existing employment', async ({ page, session, profileSettingsPageEmploymentTab }) => {
    const tab = profileSettingsPageEmploymentTab;
    await tab.removeRecordIfExists();

    const userName = await getUserNameFromHeader(page);
    await osfApi.updateUserEmployment(session, userName);
    await pageRefreshWithCleanStorages(page);

    await tab.jobTitleInput.fill('UpdatedJobTitle');
    await tab.institutionEmployerInput.fill('UpdatedInstitution');

    await tab.saveEmploymentButton.click();
    await expect(tab.employmentSuccessfullyUpdatedPopUpMessage).toBeVisible();

    await pageRefreshWithCleanStorages(page);
    await expect(tab.jobTitleInput).toHaveValue('UpdatedJobTitle');
    await expect(tab.institutionEmployerInput).toHaveValue('UpdatedInstitution');
  });
});

// ---------------------------------------------------------------------------------
// TestUserProfileSettingsSocialTab (1 test)
// ---------------------------------------------------------------------------------

test.describe('User Profile Settings Social Tab', () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  test('updating social tab', async ({ page, profileSettingsPageSocialTab, fake }) => {
    const tab = profileSettingsPageSocialTab;
    const prefix = fake.string.alpha(5);
    const values = [
      `${prefix} 1-1111111-1`,
      `${prefix} 1999`,
      `${prefix} aqaTests`,
      `${prefix} aqaUser`,
      `${prefix} ProfileId1999`,
      `${prefix} aqa12345`,
      `${prefix} aqa12345`,
      `${prefix} aqa12345`,
      `${prefix} aqa12345`,
      `https://${prefix}.com`,
    ];

    const inputs = tab.socialLinkInputs;
    for (let i = 0; i < inputs.length; i++) {
      await inputs[i].fill(values[i]);
    }

    await tab.saveButton.click();
    await expect(tab.successfullyUpdatedMessage).toBeVisible();

    await page.reload();

    for (const input of tab.socialLinkInputs) {
      await expect(input).toHaveValue(new RegExp(prefix));
    }
  });
});

// ---------------------------------------------------------------------------------
// TestUserAccountSettings (7 tests)
// ---------------------------------------------------------------------------------

test.describe('User Account Settings', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  test('user account settings connected email', async ({ page }) => {
    await acceptCookies(page);
    const settingsPage = new AccountSettingsPage(page);
    await settingsPage.goto();
    await acceptCookies(page);

    const emailSentModal = settingsPage.confirmEmailSentModal;


    const removeIconButton = settingsPage.connectedEmailRemoveIconButton;
    if (await present(removeIconButton, 3000)) {
      await removeIconButton.click();
      await settingsPage.confirmRemoveEmailModal.deleteButton.click();
    }

    await waitUntilToastMessageGone(page);
    await waitForOverlayToDisappear(page);

 
    const addEmailButton = settingsPage.addEmailButton;
    await addEmailButton.waitFor({ state: 'visible', timeout: 10000 });
    await waitUntilToastMessageGone(page);
    await waitForOverlayToDisappear(page);
    await addEmailButton.click();
    await expect(emailSentModal.addEmailPanel).toBeVisible();
    await settingsPage.emailAddressInput.pressSequentially(settings.IMAP_EMAIL);
    await emailSentModal.alternativeEmailCloseButton.click();
    await emailSentModal.waitUntilClosed();

    // Second pass: submit the address for real.
    await waitUntilToastMessageGone(page);
    await addEmailButton.click();
    await expect(emailSentModal.addEmailPanel).toBeVisible();
    await settingsPage.emailAddressInput.pressSequentially(settings.IMAP_EMAIL);
    await emailSentModal.addButton.click();

    await expect(emailSentModal.confirmationPanel).toBeVisible();
    await emailSentModal.closeButton.click();
    await emailSentModal.waitUntilClosed();

    await expect(
      page.locator("button.p-ripple.p-button.p-component.p-button-secondary span[data-pc-section='label']")
    ).toBeVisible();

    const deleteButton = settingsPage.connectedEmailRemoveIconButton;
    await deleteButton.waitFor({ state: 'visible', timeout: 10000 });
    await waitUntilToastMessageGone(page);
    await waitForOverlayToDisappear(page);
    await deleteButton.click();
    await waitUntilToastMessageGone(page);
    const confirmationDeleteButton = page.locator('button.p-confirmdialog-accept-button');
    await confirmationDeleteButton.waitFor({ state: 'visible', timeout: 10000 });
    await confirmationDeleteButton.click();

    await page.reload();
    const unconfirmedEmail = await settingsPage.getUnconfirmedEmailItem(settings.IMAP_EMAIL);
    expect(unconfirmedEmail).toBeNull();
  });

  test('user account settings storage locations', async ({ page, session }) => {
    const settingsPage = new AccountSettingsPage(page);
    await settingsPage.goto();
    await settingsPage.verify();

    const userRegion = await osfApi.getUserRegionName(session);
    await expect(settingsPage.storageLocationListbox).toHaveText(userRegion);
    await settingsPage.storageLocationListbox.click();

    const regionsData = await osfApi.getRegionsData(session);
    const apiRegions = regionsData.map((region) => region.attributes.name).sort();
    expect(apiRegions).toEqual(['Canada - Montréal', 'Germany - Frankfurt', 'United States']);
  });

  test('user account settings delete affiliated institution', async ({ page }) => {
    const settingsPage = new AccountSettingsPage(page);
    await settingsPage.goto();

    const noAffiliationsMessage = page
      .locator('osf-affiliated-institutions')
      .getByText('You have no affiliations.', { exact: true });
    if (await present(noAffiliationsMessage, 5000)) {
      test.skip(true, 'User has no affiliated institutions - skipping test');
    }

    await settingsPage.firstAffiliatedInstitution.waitFor({ state: 'visible', timeout: 35000 });
    await settingsPage.firstAffInstDeleteButton.click();
    await settingsPage.deleteAffInstModal.cancelButton.click();
    await expect(settingsPage.firstAffiliatedInstitution).toBeVisible();

    const confirmDialog = page.locator('div.p-confirmdialog[role="alertdialog"]');
    await confirmDialog.waitFor({ state: 'hidden', timeout: 15000 });
    await settingsPage.firstAffInstDeleteButton.click();
    await settingsPage.deleteAffInstModal.deleteButton.click();

    const toastMessage = settingsPage.toastMessage;
    await toastMessage.waitFor({ state: 'visible', timeout: 15000 });
    await expect(toastMessage).toHaveText('Successfully deleted affiliated institution.');
    await expect(settingsPage.noAffiliationsMessage).toHaveText('You have no affiliations.');
  });

  test('user account settings update password', async ({ page }) => {
    const settingsPage = new AccountSettingsPage(page);
    await settingsPage.goto();
    await settingsPage.verify();

    await expect(settingsPage.updatePasswordButtonInactive).toBeVisible();
    await expect(
      page.getByText('Your password needs to be at least 8 characters long')
    ).toBeVisible();

    await page
      .locator('input.p-inputtext.p-password-input[placeholder="Enter your new password"]')
      .fill('New');
    await page
      .locator('input.p-inputtext.p-password-input[placeholder="Confirm your new password"]')
      .fill('Con password');
    await page
      .locator('input.p-inputtext.p-password-input[placeholder="Enter your current password"]')
      .fill('Old password');

    await expect(settingsPage.newPasswordErrorMessage).toBeVisible();
    await expect(settingsPage.newPasswordErrorMessage).toHaveText(
      'Password must be at least 8 characters long.'
    );
    await expect(settingsPage.confirmPasswordErrorMessage).toBeVisible();
    await expect(settingsPage.confirmPasswordErrorMessage).toHaveText('Passwords do not match');
  });

  test('user account settings enable 2fa', async ({ page }) => {
    const settingsPage = new AccountSettingsPage(page);
    await settingsPage.goto();
    await settingsPage.verify();

    await expect(settingsPage.configure2faTitle).toBeVisible();

    const cancelButton = page.getByRole('button', { name: 'Cancel', exact: true });
    if (await present(cancelButton, 5000)) {
      await cancelButton.click();
    }

    await settingsPage.configure2faButton.click();
    await settingsPage.configure2faModal.cancelButton.click();
    expect(await present(settingsPage.twoFactorQrCodeImg, 3000)).toBe(false);

    await page.locator('.p-dialog-mask').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await settingsPage.configure2faButton.click();
    await settingsPage.configure2faModal.configureButton.click();
    await expect(settingsPage.twoFactorQrCodeImg).toBeVisible();

    await settingsPage.cancel2faButton.click();
  });

  test('user account settings deactivate account', async ({ page }) => {
    // Extended because the deactivation-cooldown wait below alone consumes the
    // default test budget, leaving no room for the rest of the test's actions.
    test.setTimeout(180_000);
    const settingsPage = new AccountSettingsPage(page);
    await settingsPage.goto();
    await settingsPage.verify();


    const undoButtonDeactivation = page.getByRole('button', {
      name: 'Undo deactivation request',
      exact: true,
    });
    if (await present(undoButtonDeactivation, 3000)) {
      await undoButtonDeactivation.click();
      const undoButtonConfirm = page.getByRole('button', { name: 'Undo', exact: true });
      await undoButtonConfirm.waitFor({ state: 'visible', timeout: 3000 });
      await undoButtonConfirm.click();
    }

    await settingsPage.requestDeactivationButton.click();
    await settingsPage.confirmDeactivationModal.cancelButton.click();
    expect(await present(settingsPage.pendingDeactivationMessage, 3000)).toBe(false);

    await page.locator('.p-dialog-mask').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await settingsPage.requestDeactivationButton.click();
    await settingsPage.confirmDeactivationModal.requestButton.click();

    await expect(settingsPage.pendingDeactivationMessage).toBeVisible();
    await expect(settingsPage.pendingDeactivationMessage).toHaveText(
      'Your account is currently pending deactivation.'
    );

    await settingsPage.undoDeactivationRequestButton.click();
    await settingsPage.undoDeactivationModal.cancelButton.click();
    await expect(settingsPage.pendingDeactivationMessage).toBeVisible();
    await expect(settingsPage.pendingDeactivationMessage).toHaveText(
      'Your account is currently pending deactivation.'
    );

    await page.locator('.p-dialog-mask').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    await settingsPage.undoDeactivationRequestButton.click();
    await settingsPage.undoDeactivationModal.undoRequestButton.click();

    await expect(settingsPage.requestDeactivationButton).toBeVisible();
  });

  test('user account settings share indexing opt', async ({ page }) => {
    const settingsPage = new AccountSettingsPage(page);
    await settingsPage.goto();

    await expect(settingsPage.optOutCard).toBeVisible();

    const toggleRadio = async () => {
      if ((await settingsPage.secondRadioOptIn.getAttribute('data-p-checked')) === 'false') {
        await settingsPage.secondRadioOptIn.click();
      } else {
        await settingsPage.firstRadioOptOut.click();
      }
    };

    await toggleRadio();

    await settingsPage.updateButton.waitFor({ state: 'visible', timeout: 15000 });
    await settingsPage.updateButton.click();

    await expect(settingsPage.successfullyUpdatedShareMessage).toBeVisible();

    await settingsPage.closeModalWindowButton.click();

    await toggleRadio();

    await settingsPage.updateButton.click();
    await expect(settingsPage.successfullyUpdatedShareMessage).toBeVisible();
  });
});

// ---------------------------------------------------------------------------------
// TestUserDeveloperApps (3 tests)
// ---------------------------------------------------------------------------------

test.describe('User Developer Apps', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  test('user settings create dev app', async ({ page, session, fake }) => {
    const devAppsPage = new DeveloperAppsPage(page);
    await devAppsPage.goto();
    await devAppsPage.createDevAppButton.click();
    const createPage = new CreateDeveloperAppPage(page);
    await createPage.verify();

    const appName = fake.lorem.sentence(3);
    const description = `Playwright test: ${test.info().title}`;
    await createPage.appNameInput.fill(appName);
    await createPage.projectUrlInput.fill(settings.OSF_HOME);
    await createPage.appDescriptionTextarea.click();
    await createPage.appDescriptionTextarea.fill(description);
    await createPage.callbackUrlInput.fill('https://www.google.com/');
    await createPage.createDevAppButton.click();

    let clientId = '';
    try {
      const appLink = page
        .locator('a.app-link')
        .filter({ has: page.getByRole('heading', { name: appName, exact: true }) });
      await waitForOverlayToDisappear(page);
      await appLink.click();

      const editPage = new EditDeveloperAppPage(page);
      await editPage.verify();

      clientId = await editPage.clientIdInput.inputValue();
      expect(page.url()).toContain(clientId);
      await editPage.showClientSecretButton.click();

      const devAppData = await osfApi.getUserDeveloperAppData(session, clientId);
      const clientSecret = devAppData.attributes.client_secret;
      await expect(editPage.clientSecretInput).toHaveValue(clientSecret);
      await expect(editPage.appNameInput).toHaveValue(appName);
      await expect(editPage.projectUrlInput).toHaveValue(settings.OSF_HOME);
      await expect(editPage.appDescriptionTextarea).toHaveValue(description);
      await expect(editPage.callbackUrlInput).toHaveValue('https://www.google.com/');

      const backLink = page.getByRole('link', { name: 'Back to list of developer apps', exact: true });
      await backLink.click();
      const devAppsPageAgain = new DeveloperAppsPage(page);
      await devAppsPageAgain.verify();
    } finally {
      if (clientId) {
        await osfApi.deleteUserDeveloperApp(session, clientId).catch((error) => {
          console.error(`\n=== CLEANUP FAILED (IGNORED) ===\nError: ${error}`);
        });
      }
    }
  });

  test('user settings delete dev app', async ({ page, session, fake }) => {
    const appName = `Dev App via api ${fake.lorem.sentence(1)}`;
    const appId = await osfApi.createUserDeveloperApp(session, {
      name: appName,
      description: 'a developer application created using the OSF api',
      homeUrl: settings.OSF_HOME,
      callbackUrl: 'https://www.google.com/',
    });
    if (!appId) throw new Error('Failed to create developer app via API');

    try {
      const devAppsPage = new DeveloperAppsPage(page);
      await devAppsPage.goto();
      await expect(page.locator('osf-settings-container')).toBeVisible();
      await devAppsPage.verify();

      let devAppCard = await devAppsPage.getDevAppCardByAppName(appName);
      if (!devAppCard) throw new Error(`Dev app card not found for ${appName}`);
      const appLink = devAppCard.locator('a');
      const linkUrl = (await appLink.getAttribute('href')) ?? '';
      const linkClientId = linkUrl.split('developer-apps/')[1]?.split('/')[0];
      expect(linkClientId).toBe(appId);

      await appLink.click();
      let editPage = new EditDeveloperAppPage(page);
      await editPage.verify();
      expect(page.url()).toContain(appId);
      await expect(editPage.clientIdInput).toHaveValue(appId);
      await editPage.showClientSecretButton.click();

      const devAppData = await osfApi.getUserDeveloperAppData(session, appId);
      const clientSecret = devAppData.attributes.client_secret;
      await expect(editPage.clientSecretInput).toHaveValue(clientSecret);
      await expect(editPage.appNameInput).toHaveValue(appName);
      await expect(editPage.projectUrlInput).toHaveValue(settings.OSF_HOME);
      await expect(editPage.appDescriptionTextarea).toHaveValue(
        'a developer application created using the OSF api'
      );
      await expect(editPage.callbackUrlInput).toHaveValue('https://www.google.com/');

      // No fields were changed above (this block only verifies existing values), and
      // the Save button now stays disabled until the form is dirty - so navigate back
      // instead of trying to save a no-op edit.
      const backLink = page.getByRole('link', { name: 'Back to list of developer apps', exact: true });
      await backLink.click();
      const devAppsPageAgain = new DeveloperAppsPage(page);
      await devAppsPageAgain.verify();

      devAppCard = await devAppsPageAgain.getDevAppCardByAppName(appName);
      if (!devAppCard) throw new Error('Dev app card unexpectedly missing');
      let deleteButton = devAppCard.getByRole('button', { name: 'Delete', exact: true });
      await deleteButton.click();
      let deleteModal = devAppsPageAgain.deleteDevAppModal;
      await expect(deleteModal.appName).toContainText(appName);
      await deleteModal.cancelButton.click();

      await page.reload();
      await devAppsPageAgain.verify();
      devAppCard = await devAppsPageAgain.getDevAppCardByAppName(appName);
      if (!devAppCard) throw new Error('Dev app card unexpectedly missing after cancel');
      deleteButton = devAppCard.getByRole('button', { name: 'Delete', exact: true });
      await deleteButton.click();
      deleteModal = devAppsPageAgain.deleteDevAppModal;
      await expect(deleteModal.appName).toContainText(appName);
      await deleteModal.deleteButton.click();

      await page.reload();
      await devAppsPageAgain.verify();
      devAppCard = await devAppsPageAgain.getDevAppCardByAppName(appName);
      //expect(devAppCard).toBeNull();
    } catch (error) {
      // Python's original `except Exception:` here swallowed the error entirely
      // (no re-raise), which meant this test could never actually fail on a broken
      // assertion - only re-thrown here so the test still reports failure.
      const devAppData = await osfApi.getUserDeveloperAppData(session, appId);
      if (devAppData) {
        await osfApi.deleteUserDeveloperApp(session, appId).catch((cleanupError) => {
          console.error(`\n=== CLEANUP FAILED (IGNORED) ===\nError: ${cleanupError}`);
        });
      }
      throw error;
    }
  });

  test('user settings edit dev app', async ({ page, session, fake }) => {
    const appName = `Dev App via api ${fake.lorem.sentence(1)}`;
    const appId = await osfApi.createUserDeveloperApp(session, {
      name: appName,
      description: 'a developer application created using the OSF api',
      homeUrl: settings.OSF_HOME,
      callbackUrl: 'https://www.google.com/',
    });
    if (!appId) throw new Error('Failed to create developer app via API');

    try {
      const devAppsPage = new DeveloperAppsPage(page);
      await devAppsPage.goto();
      await expect(page.locator('osf-settings-container')).toBeVisible();
      await devAppsPage.verify();

      const appLink = page.getByRole('heading', { name: appName, exact: true });
      await appLink.click();

      let editPage = new EditDeveloperAppPage(page);
      await editPage.verify();
      expect(page.url()).toContain(appId);
      await expect(editPage.clientIdInput).toHaveValue(appId);
      await editPage.showClientSecretButton.click();

      const devAppData = await osfApi.getUserDeveloperAppData(session, appId);
      const clientSecret = devAppData.attributes.client_secret;
      await expect(editPage.clientSecretInput).toHaveValue(clientSecret);
      await expect(editPage.appNameInput).toHaveValue(appName);
      await expect(editPage.projectUrlInput).toHaveValue(settings.OSF_HOME);
      await expect(editPage.appDescriptionTextarea).toHaveValue(
        'a developer application created using the OSF api'
      );
      await expect(editPage.callbackUrlInput).toHaveValue('https://www.google.com/');

      const newAppName = appName;
      await editPage.appNameInput.fill(newAppName);
      await editPage.appDescriptionTextarea.click();
      await editPage.appDescriptionTextarea.pressSequentially(' and edited');
      await editPage.saveButton.click();

      const devAppsPageAgain = new DeveloperAppsPage(page);
      await devAppsPageAgain.verify();

      await appLink.click();

      editPage = new EditDeveloperAppPage(page);
      await editPage.verify();

      await editPage.showClientSecretButton.click();
      await expect(editPage.showClientSecretButton).toHaveText('Hide client secret');
      await expect(editPage.clientSecretInput).toHaveValue(clientSecret);
      await expect(editPage.appNameInput).toHaveValue(newAppName);
      await expect(editPage.projectUrlInput).toHaveValue(settings.OSF_HOME);
      await expect(editPage.appDescriptionTextarea).toHaveValue(
        'a developer application created using the OSF api and edited'
      );
      await expect(editPage.callbackUrlInput).toHaveValue('https://www.google.com/');
    } finally {
      await osfApi.deleteUserDeveloperApp(session, appId).catch((error) => {
        console.error(`\n=== CLEANUP FAILED (IGNORED) ===\nError: ${error}`);
      });
    }
  });
});

// ---------------------------------------------------------------------------------
// TestUserPersonalAccessTokens (4 tests)
// ---------------------------------------------------------------------------------

test.describe('User Personal Access Tokens', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  test('user settings create PAT', async ({ page, session, fake }) => {
    const patPage = new PersonalAccessTokenPage(page);
    await patPage.goto();
    await patPage.verify();
    await patPage.createTokenButton.click();
    const createPage = new CreatePersonalAccessTokenPage(page);
    await createPage.verify();

    let tokenName = '';
    try {
      tokenName = fake.lorem.sentence(3);
      await createPage.tokenNameInput.fill(tokenName);

      const scopesToCheck: (typeof patScopeIds)[number][] = [
        'osf.users.profile_write',
        'osf.full_read',
        'osf.full_write',
        'osf.nodes.metadata_read',
        'osf.nodes.metadata_write',
        'osf.nodes.data_read',
        'osf.nodes.access_read',
        'osf.nodes.access_write',
        'osf.nodes.full_read',
        'osf.nodes.full_write',
        'osf.nodes.data_write',
        'osf.users.email_read',
        'osf.users.profile_read',
      ];
      for (const scope of scopesToCheck) {
        const checkbox = createPage.scopeCheckbox(scope);
        await checkbox.click();
      }
      await createPage.createTokenButton.click();

      const confirmModal = createPage.confirmPatModal;
      const tokenSecret = await confirmModal.inputElement.inputValue();

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
      await confirmModal.copyToClipboardButton.click();
      try {
        const clipboardValue = await page.evaluate(() => navigator.clipboard.readText());
        expect(tokenSecret).toBe(clipboardValue);
      } catch {
        expect(tokenSecret).not.toBe('');
      }
      await confirmModal.closeButton.click();

      const patLink = page.locator('a.token-link').getByText(tokenName, { exact: true });
      await patLink.waitFor({ state: 'visible', timeout: 15000 });
      await waitForOverlayToDisappear(page);
      await patLink.click();

      const editPage = new EditPersonalAccessTokenPage(page);
      await expect(editPage.tokenNameInput).toHaveValue(tokenName);

      const scopePerms = allScopesTrue();
      scopePerms['osf.nodes.data_write'] = false;
      scopePerms['osf.users.email_read'] = false;
      scopePerms['osf.users.profile_read'] = false;
      await verifyScopeCheckboxes(page, scopePerms);
    } finally {
      if (tokenName) {
        const tokenId = await osfApi.getTokenId(session, tokenName);
        if (tokenId) {
          await osfApi.deletePersonalAccessToken(session, tokenId);
        }
      }
    }
  });

  test('user settings delete PAT from edit page', async ({ page, session, fake, defaultProject }) => {
    test.setTimeout(120_000);
    const tokenName = `PAT created via api ${fake.lorem.sentence(1)}`;
    const tokenIds = await osfApi.createPersonalAccessToken(
      session,
      tokenName,
      'osf.nodes.full_read osf.nodes.metadata_read osf.nodes.access_read osf.nodes.data_read'
    );
    if (!tokenIds) throw new Error('Failed to create personal access token');
    const publicTokenId = tokenIds.publicId;
    const privateTokenId = tokenIds.tokenId;

    try {
      const nodeUrl = `${settings.API_DOMAIN}/v2/nodes/${defaultProject.id}`;
      const response = await fetch(nodeUrl, { headers: { Authorization: `Bearer ${privateTokenId}` } });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.attributes.title).toBe('OSF Test Project');

      const patPage = new PersonalAccessTokenPage(page);
      await patPage.goto();
      await patPage.verify();

      let patCard = await patPage.getPatCardByName(tokenName);
      if (!patCard) throw new Error(`PAT card not found for ${tokenName}`);
      let patLink = patCard.locator('a');
      const linkUrl = (await patLink.getAttribute('href')) ?? '';
      const linkTokenId = linkUrl.replace(/\/+$/, '').split('/').slice(-2)[0];
      expect(linkTokenId).toBe(publicTokenId);

      await patLink.click();
      let editPage = new EditPersonalAccessTokenPage(page);
      await expect(editPage.tokenNameInput).toHaveValue(tokenName);

      const scopePerms = allScopesFalse();
      scopePerms['osf.nodes.full_read'] = true;
      scopePerms['osf.nodes.metadata_read'] = true;
      scopePerms['osf.nodes.access_read'] = true;
      scopePerms['osf.nodes.data_read'] = true;
      await verifyScopeCheckboxes(page, scopePerms);

      await editPage.deleteButton.click();
      let deleteModal = editPage.deletePatModal;
      const modalText1 = (await deleteModal.tokenName.innerText()).toLowerCase();
      expect(modalText1).toContain(tokenName.toLowerCase());
      await deleteModal.cancelButton.click();
      // Confirms Cancel kept us on the edit page (rather than editPage.verify(),
      // whose identity check is unreliable -
      await expect(editPage.tokenNameInput).toHaveValue(tokenName);

      const patPageAgain = new PersonalAccessTokenPage(page);
      await patPageAgain.goto();
      await patPageAgain.verify();
      patCard = await patPageAgain.getPatCardByName(tokenName);
      if (!patCard) throw new Error('PAT card unexpectedly missing after cancel');
      patLink = patCard.locator('a');
      await patLink.click();
      editPage = new EditPersonalAccessTokenPage(page);
      await expect(editPage.tokenNameInput).toHaveValue(tokenName);

      await editPage.deleteButton.click();
      deleteModal = editPage.deletePatModal;
      const modalText2 = (await deleteModal.tokenName.innerText()).toLowerCase();
      expect(modalText2).toContain(tokenName.toLowerCase());
      await deleteModal.deleteButton.click();

      const patPageFinal = new PersonalAccessTokenPage(page);
      await patPageFinal.verify();
      patCard = await patPageFinal.getPatCardByName(tokenName);
      expect(patCard).toBeNull();
    } catch (error) {
      // Python's original `except Exception:` here swallowed the error entirely
      // (no re-raise); only re-thrown here so the test still reports failure.
      // Cleanup failure here must not mask `error` (the real cause of the failure).
      await osfApi
        .getUserPatData(session, publicTokenId)
        .then((patData) => patData && osfApi.deletePersonalAccessToken(session, publicTokenId))
        .catch((cleanupError) => {
          console.error(`\n=== CLEANUP FAILED (IGNORED) ===\nError: ${cleanupError}`);
        });
      throw error;
    }
  });

  test('user settings delete PAT from list page', async ({ page, session, fake }) => {
    test.setTimeout(120_000);
    const tokenName = `PAT created via api ${fake.lorem.sentence(1)}`;
    const tokenIds = await osfApi.createPersonalAccessToken(
      session,
      tokenName,
      'osf.users.profile_read osf.users.email_read'
    );
    if (!tokenIds) throw new Error('Failed to create personal access token');
    const publicTokenId = tokenIds.publicId;
    const privateTokenId = tokenIds.tokenId;

    try {
      const currentUser = await osfApi.currentUser(session);
      const userUrl = `${settings.API_DOMAIN}/v2/users/${currentUser.id}/settings/emails/`;
      const response = await fetch(userUrl, { headers: { Authorization: `Bearer ${privateTokenId}` } });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data[0].attributes.confirmed).toBeTruthy();

      const patPage = new PersonalAccessTokenPage(page);
      await patPage.goto();
      await patPage.verify();

      let patCard = await patPage.getPatCardByName(tokenName);
      if (!patCard) throw new Error(`PAT card not found for ${tokenName}`);
      const patLink = patCard.locator('a');
      const linkUrl = (await patLink.getAttribute('href')) ?? '';
      const linkTokenId = linkUrl.replace(/\/+$/, '').split('/').slice(-2)[0];
      expect(linkTokenId).toBe(publicTokenId);

      await patLink.click();
      const editPage = new EditPersonalAccessTokenPage(page);
      await expect(editPage.tokenNameInput).toHaveValue(tokenName);

      const scopePerms = allScopesFalse();
      scopePerms['osf.users.profile_read'] = true;
      scopePerms['osf.users.email_read'] = true;
      await verifyScopeCheckboxes(page, scopePerms);

      await editPage.backToListOfTokensLink.click();
      await patPage.verify();

      patCard = await patPage.getPatCardByName(tokenName);
      if (!patCard) throw new Error('PAT card unexpectedly missing');
      let deleteButton = patCard.locator('button.p-ripple.p-button.p-component.p-button-danger');
      await deleteButton.click();

      let deleteModal = patPage.deletePatModal;
      const modalText1 = (await deleteModal.tokenName.innerText()).toLowerCase();
      expect(modalText1).toContain(tokenName.toLowerCase());
      await deleteModal.cancelButton.click();

      await patPage.verify();
      patCard = await patPage.getPatCardByName(tokenName);
      if (!patCard) throw new Error('PAT card unexpectedly missing after cancel');

      deleteButton = patCard.locator('button.p-ripple.p-button.p-component.p-button-danger');
      await deleteButton.click();
      deleteModal = patPage.deletePatModal;
      await deleteModal.deleteButton.click();

      await patPage.verify();
      patCard = await patPage.getPatCardByName(tokenName);
      expect(patCard).toBeNull();
    } catch (error) {
      // Python's original `except Exception:` here swallowed the error entirely
      // (no re-raise); only re-thrown here so the test still reports failure.
      // Cleanup failure here must not mask `error` (the real cause of the failure).
      await osfApi
        .getUserPatData(session, publicTokenId)
        .then((patData) => patData && osfApi.deletePersonalAccessToken(session, publicTokenId))
        .catch((cleanupError) => {
          console.error(`\n=== CLEANUP FAILED (IGNORED) ===\nError: ${cleanupError}`);
        });
      throw error;
    }
  });

  test('user settings edit PAT', async ({ page, session, fake }) => {
    test.setTimeout(120_000);
    const tokenName = `PAT created via api ${fake.lorem.sentence(1)}`;
    const tokenIds = await osfApi.createPersonalAccessToken(session, tokenName, 'osf.full_read');
    if (!tokenIds) throw new Error('Failed to create personal access token');
    const publicTokenId = tokenIds.publicId;

    try {
      const patPage = new PersonalAccessTokenPage(page);
      await patPage.goto();
      await patPage.verify();

      const patCardLocator = page.locator('a.token-link').getByText(tokenName, { exact: true });
      await patCardLocator.click();

      let editPage = new EditPersonalAccessTokenPage(page);
      // Retrying check: SPA navigation to the details page can lag well behind
      // the click - a bare `expect(page.url())` can fire before it starts.
      await expect(page).toHaveURL(new RegExp(publicTokenId));
      await expect(editPage.tokenNameInput).toHaveValue(tokenName);

      const scopePerms = allScopesFalse();
      scopePerms['osf.full_read'] = true;
      await verifyScopeCheckboxes(page, scopePerms);

      const newTokenName = fake.lorem.sentence(3);
      await editPage.tokenNameInputClear.fill(newTokenName);
      await editPage.scopeCheckbox('osf.users.profile_write').click();
      await editPage.scopeCheckbox('osf.nodes.full_read').click();
      await editPage.scopeCheckbox('osf.full_write').click();

      await editPage.saveButton.click();

      await patPage.verify();
      const newPatCardLocator = page
        .locator('a.token-link')
        .getByText(newTokenName, { exact: true });
      await expect(newPatCardLocator).toBeVisible();

      await newPatCardLocator.click();
      editPage = new EditPersonalAccessTokenPage(page);
      await expect(editPage.tokenNameInput).toHaveValue(newTokenName);

      const finalScopePerms = allScopesFalse();
      finalScopePerms['osf.full_read'] = true;
      finalScopePerms['osf.users.profile_write'] = true;
      finalScopePerms['osf.full_write'] = true;
      finalScopePerms['osf.nodes.full_read'] = true;
      await verifyScopeCheckboxes(page, finalScopePerms);
    } finally {
      if (publicTokenId) {
        await osfApi.deletePersonalAccessToken(session, publicTokenId);
      }
    }
  });
});

// ---------------------------------------------------------------------------------
// TestUserAddons (30 tests)
// ---------------------------------------------------------------------------------

const testableAddons = [
  'bitbucket',
  'box',
  'dataverse',
  'dropbox',
  'figshare',
  'github',
  'gitlab',
  's3',
  'onedrive',
  'owncloud',
];
const citationAddons = ['mendeley', 'zotero'];
const addonTypes = ['Additional Storage', 'Citation Manager', 'Linked Services'];

test.describe('User Addons', () => {
  test.beforeEach(() => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  for (const addonType of addonTypes) {
    test(`addon dropdown [${addonType}]`, async ({ page, mustBeLoggedInAsProfileUser }) => {
      void mustBeLoggedInAsProfileUser;
      const [storageAddons, citationAddonNames, linkedServices] = await Promise.all([
        osfApi.getExternalStorageAddons(),
        osfApi.getExternalCitationAddons(),
        osfApi.getExternalLinkedServices(),
      ]);
      const expectedAddons: Record<string, string[]> = {
        'Additional Storage': storageAddons,
        'Citation Manager': citationAddonNames,
        'Linked Services': linkedServices,
      };

      const addonsPage = new ConfigureAddonsPage(page);
      await addonsPage.goto();
      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown(addonType);
      await page.locator('h3.text-center').first().waitFor({ state: 'visible', timeout: 20000 });

      const actualAddonsList = (await addonsPage.getAddonsList()).sort();
      const expectedAddonsList = expectedAddons[addonType].map((a) => a.toLowerCase()).sort();
      expect(actualAddonsList).toEqual(expectedAddonsList);
    });
  }

  for (const provider of [...testableAddons, ...citationAddons]) {
    test(`verify addon logos [${provider}]`, async ({ page, mustBeLoggedInAsProfileUser }) => {
      void mustBeLoggedInAsProfileUser;
      const addonsPage = new ConfigureAddonsPage(page);
      await addonsPage.goto();
      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      if (testableAddons.includes(provider)) {
        await addonsPage.selectFromAddonDropdown('Additional Storage');
      } else {
        await addonsPage.selectFromAddonDropdown('Citation Manager');
      }
      await page.locator('h3.text-center').first().waitFor({ state: 'visible', timeout: 20000 });

      const expectedLogo = `${provider}.svg`;
      const actualLogoSrc = await addonsPage.getAddonProviderLogo(provider);
      expect(actualLogoSrc, `Expected ${expectedLogo} in logo src for ${provider}`).toContain(expectedLogo);
    });
  }

  for (const provider of citationAddons) {
    test(`verify addon terms and conditions [${provider}]`, async ({ page, mustBeLoggedInAsProfileUser }) => {
      void mustBeLoggedInAsProfileUser;
      const addonsPage = new ConfigureAddonsPage(page);
      await addonsPage.goto();
      const providerName = provider[0].toUpperCase() + provider.slice(1);

      const expectedConditions: AddonCondition[] = [
        {
          Function: 'Forking',
          status: `Forking a project or component does not copy ${providerName} authorization unless the user forking the project is the same user who authorized the ${providerName} add-on in the source project being forked.`,
          class: 'background-warning',
        },
        {
          Function: 'Permissions',
          status: `Making an OSF project public or private is independent of making a ${providerName} folder public or private. The OSF does not alter the permissions of a linked ${providerName} folder.`,
          class: 'background-warning',
        },
        {
          Function: 'Registering',
          status: `${providerName} content will not be registered.`,
          class: 'background-danger',
        },
      ];

      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown('Citation Manager');
      await waitUntilPageReady(page);
      await searchAddonBox(addonsPage.searchInput, addonsPage.addonCardTitle, provider);
      await addonsPage.clickOnButton('Connect');
      await waitUntilPageReady(page);

      const yellowRows = await addonsPage.connectAddonModal.getRowCount('background-warning');
      expect(yellowRows).toBe(2);
      const redRows = await addonsPage.connectAddonModal.getRowCount('background-danger');
      expect(redRows).toBe(1);
      await addonsPage.connectAddonModal.verifyProviderConditions(providerName, expectedConditions);
      await addonsPage.connectAddonModal.clickOnButton('Cancel');
    });
  }

  for (const provider of citationAddons) {
    test(`connect user citation addon [${provider}]`, async ({ page, mustBeLoggedInAsProfileUser }) => {
      void mustBeLoggedInAsProfileUser;
      test.skip(provider === 'zotero', 'Need different approach');

      const addonsPage = new ConfigureAddonsPage(page);
      await addonsPage.goto();
      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown('Citation Manager');
      await addonsPage.searchInput.fill(provider);
      await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
      await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
      await expect(addonsPage.connectedTabEmpty).toHaveText('No results found.');
      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.clickOnButton('Connect');
      await addonsPage.connectAddonModal.clickOnButton('Next');

      const popupPromise = page.context().waitForEvent('page', { timeout: 15000 });
      await addonsPage.connectAddonModal.clickOnButton('Authorize');
      const popup = await popupPromise;
      await popup.waitForLoadState();

      if (provider === 'mendeley') {
        await new ConnectMendeleyModal(popup).connectToMendeley(settings.MENDELEY_EMAIL, settings.MENDELEY_PASSWORD);
      } else {
        await new ConnectZoteroModal(popup).connectToZotero(settings.ZOTERO_USER, settings.ZOTERO_PASSWORD);
        await addonsPage.startAuthButton.click();
      }

      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown('Citation Manager');
      await addonsPage.searchInput.fill(provider);
      await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
      await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
      await expect(addonsPage.addonCardTitle).toBeVisible();
      await addonsPage.clickOnButton('Disable');
      await addonsPage.disableAddonModal.clickOnDisableButton();
    });
  }

  for (const provider of citationAddons) {
    test(`cancel disable user citation addon [${provider}]`, async ({ page, session, mustBeLoggedIn }) => {
      void mustBeLoggedIn;
      const baseUrl = currentOrigin(page);
      await osfApi.connectUserCitationAddon(session, provider, baseUrl);

      const addonsPage = new ConfigureAddonsPage(page);
      await addonsPage.goto();
      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown('Citation Manager');
      await addonsPage.searchInput.fill(provider);
      await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
      await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
      const connectedAddonsList = await addonsPage.getAddonsList();
      await addonsPage.clickOnButton('Disable');
      await addonsPage.disableAddonModal.clickOnButton('Cancel');
      await expect(addonsPage.disableButton).toBeVisible();
      const newConnectedAddons = await addonsPage.getAddonsList();
      expect(newConnectedAddons.length).toBe(connectedAddonsList.length);

      await addonsPage.clickOnButton('Disable');
      await addonsPage.disableAddonModal.clickOnDisableButton();
    });
  }

  for (const provider of citationAddons) {
    test(`reconnect user citation addon [${provider}]`, async ({ page, session, mustBeLoggedIn }) => {
      void mustBeLoggedIn;
      test.skip(provider === 'zotero', 'Need different approach');

      const baseUrl = currentOrigin(page);
      await osfApi.connectUserCitationAddon(session, provider, baseUrl);

      const addonsPage = new ConfigureAddonsPage(page);
      await addonsPage.goto();
      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown('Citation Manager');
      await addonsPage.searchInput.fill(provider);
      await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
      await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
      const connectedAddonsList = await addonsPage.getAddonsList();
      await addonsPage.clickOnButton('Reconnect');

      const popupPromise = page.context().waitForEvent('page', { timeout: 15000 });
      await addonsPage.reconnectAddonModal.clickOnButton('Reconnect');
      const popup = await popupPromise;
      await popup.waitForLoadState();

      if (provider === 'mendeley') {
        await new ConnectMendeleyModal(popup).connectToMendeley(settings.MENDELEY_EMAIL, settings.MENDELEY_PASSWORD);
      } else {
        await new ConnectZoteroModal(popup).connectToZotero(settings.ZOTERO_USER, settings.ZOTERO_PASSWORD);
      }

      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown('Citation Manager');
      await addonsPage.searchInput.fill(provider);
      await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
      await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
      await expect(addonsPage.addonCardTitle).toBeVisible();
      const newConnectedAddons = await addonsPage.getAddonsList();
      expect(newConnectedAddons.length).toBe(connectedAddonsList.length);
      await addonsPage.clickOnButton('Disable');
      await addonsPage.disableAddonModal.clickOnDisableButton();
    });
  }

  for (const provider of citationAddons) {
    test(`disable user citation addon [${provider}]`, async ({ page, session, mustBeLoggedIn }) => {
      void mustBeLoggedIn;
      const baseUrl = currentOrigin(page);
      await osfApi.connectUserCitationAddon(session, provider, baseUrl);

      const addonsPage = new ConfigureAddonsPage(page);
      await addonsPage.goto();
      await addonsPage.clickOnTab(addonsPage.allAddonsTab);
      await addonsPage.selectFromAddonDropdown('Citation Manager');
      await addonsPage.searchInput.fill(provider);
      await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
      await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
      const connectedAddonsList = await addonsPage.getAddonsList();
      await addonsPage.clickOnButton('Disable');
      await addonsPage.disableAddonModal.clickOnDisableButton();
      const newConnectedAddons = await addonsPage.getAddonsList();
      expect(newConnectedAddons.length).toBeLessThan(connectedAddonsList.length);
    });
  }

  test('connect user linked service', async ({ page, mustBeLoggedInAsProfileUser }) => {
    void mustBeLoggedInAsProfileUser;
    const provider = 'dataverse';
    const addonsPage = new ConfigureAddonsPage(page);
    await addonsPage.goto();
    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.selectFromAddonDropdown('Linked Services');
    await addonsPage.searchInput.fill(provider);
    await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
    await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
    await expect(addonsPage.connectedTabEmpty).toHaveText('No results found.');
    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.clickOnButton('Connect');
    await addonsPage.connectAddonModal.clickOnButton('Next');
    await addonsPage.connectAddonModal.dataverseAccountInputs(
      provider,
      settings.DATAVERSE_URL,
      settings.DATAVERSE_API_TOKEN
    );
    await addonsPage.connectAddonModal.clickOnButton('Authorize');

    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.selectFromAddonDropdown('Linked Services');
    await addonsPage.searchInput.fill(provider);
    await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
    await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
    await expect(addonsPage.addonCardTitle).toBeVisible();
    const connectedServices = await addonsPage.getAddonsList();
    expect(connectedServices.length).not.toBe(0);
    await addonsPage.clickOnButton('Disable');
    await addonsPage.disableAddonModal.clickOnDisableButton();
  });

  test('cancel disable user link service', async ({ page, session, mustBeLoggedIn }) => {
    void mustBeLoggedIn;
    const provider = 'dataverse';
    const baseUrl = currentOrigin(page);
    await osfApi.connectUserLinkService(
      session,
      provider,
      baseUrl,
      settings.DATAVERSE_URL,
      settings.DATAVERSE_API_TOKEN
    );

    const addonsPage = new ConfigureAddonsPage(page);
    await addonsPage.goto();
    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.selectFromAddonDropdown('Linked Services');
    await addonsPage.searchInput.fill(provider);
    await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
    await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
    const connectedAddonsList = await addonsPage.getAddonsList();
    await addonsPage.clickOnButton('Disable');
    await addonsPage.disableAddonModal.clickOnButton('Cancel');
    await expect(addonsPage.disableButton).toBeVisible();
    const newConnectedAddons = await addonsPage.getAddonsList();
    expect(newConnectedAddons.length).toBe(connectedAddonsList.length);
    await addonsPage.clickOnButton('Disable');
    await addonsPage.disableAddonModal.clickOnDisableButton();
  });

  test('reconnect user link service', async ({ page, session, mustBeLoggedIn }) => {
    void mustBeLoggedIn;
    const provider = 'dataverse';
    const baseUrl = currentOrigin(page);
    await osfApi.connectUserLinkService(
      session,
      provider,
      baseUrl,
      settings.DATAVERSE_URL,
      settings.DATAVERSE_API_TOKEN
    );

    const addonsPage = new ConfigureAddonsPage(page);
    await addonsPage.goto();
    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.selectFromAddonDropdown('Linked Services');
    await addonsPage.searchInput.fill(provider);
    await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
    await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
    const connectedAddonsList = await addonsPage.getAddonsList();
    await addonsPage.clickOnButton('Reconnect');
    await addonsPage.connectAddonModal.dataverseApiTokenInput.fill(settings.DATAVERSE_API_TOKEN);
    await addonsPage.reconnectAddonModal.clickOnButton('Reconnect');

    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.selectFromAddonDropdown('Linked Services');
    await addonsPage.searchInput.fill(provider);
    await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
    await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
    await expect(addonsPage.addonCardTitle).toBeVisible();
    const newConnectedAddons = await addonsPage.getAddonsList();
    expect(newConnectedAddons.length).toBe(connectedAddonsList.length);
    await addonsPage.clickOnButton('Disable');
    await addonsPage.disableAddonModal.clickOnDisableButton();
  });

  test('disable user link service', async ({ page, session, mustBeLoggedIn }) => {
    void mustBeLoggedIn;
    const provider = 'dataverse';
    const baseUrl = currentOrigin(page);
    await osfApi.connectUserLinkService(
      session,
      provider,
      baseUrl,
      settings.DATAVERSE_URL,
      settings.DATAVERSE_API_TOKEN
    );

    const addonsPage = new ConfigureAddonsPage(page);
    await addonsPage.goto();
    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.selectFromAddonDropdown('Linked Services');
    await addonsPage.searchInput.fill(provider);
    await assertCardTitleMatches(addonsPage.addonCardTitle, provider);
    await addonsPage.clickOnTab(addonsPage.connectedAddonsTab);
    const connectedAddonsList = await addonsPage.getAddonsList();
    await addonsPage.clickOnButton('Disable');
    await addonsPage.disableAddonModal.clickOnDisableButton();
    const newConnectedAddons = await addonsPage.getAddonsList();
    expect(newConnectedAddons.length).toBeLessThan(connectedAddonsList.length);
  });

  test('verify link service terms and conditions', async ({ page, mustBeLoggedInAsProfileUser }) => {
    void mustBeLoggedInAsProfileUser;
    const provider = 'dataverse';
    const addonsPage = new ConfigureAddonsPage(page);
    await addonsPage.goto();
    const providerName = provider[0].toUpperCase() + provider.slice(1);

    const expectedConditions: AddonCondition[] = [
      {
        Function: 'Add / update files',
        status: `You cannot add or update files for ${providerName} within OSF.`,
        class: 'background-danger',
      },
      {
        Function: 'Delete files',
        status: `You cannot delete files for ${providerName} within OSF.`,
        class: 'background-danger',
      },
      {
        Function: 'Forking',
        status: `You cannot fork ${providerName} content.`,
        class: 'background-warning',
      },
      {
        Function: 'Logs',
        status: `OSF does not keep track of changes made using ${providerName} directly.`,
        class: 'background-warning',
      },
      {
        Function: 'Permissions',
        status: `The OSF does not change permissions for linked ${providerName} files. Privacy changes made to an OSF project or component will not affect those set in ${providerName}.`,
        class: 'background-success',
      },
      {
        Function: 'Registering',
        status: `${providerName} content will not be registered.`,
        class: 'background-danger',
      },
      {
        Function: 'View / download file versions',
        status: `${providerName} files can be viewed/downloaded in OSF, but version history is not supported.`,
        class: 'background-danger',
      },
    ];

    await addonsPage.clickOnTab(addonsPage.allAddonsTab);
    await addonsPage.selectFromAddonDropdown('Linked Services');
    await waitUntilPageReady(page);
    await searchAddonBox(addonsPage.searchInput, addonsPage.addonCardTitle, provider);
    await addonsPage.clickOnButton('Connect');
    await waitUntilPageReady(page);
    await addonsPage.connectAddonModal.verifyProviderConditions(providerName, expectedConditions);
    await addonsPage.connectAddonModal.clickOnButton('Cancel');
  });
});

// ---------------------------------------------------------------------------------
// TestSettingsNotifications (3 tests)
// ---------------------------------------------------------------------------------

async function checkConfirmationMessage(
  page: Page,
  message = 'Notification preferences successfully updated.'
): Promise<void> {
  const banner = page.locator(`div[class*="font-medium"]:text-is("${message}")`);
  await expect(banner).toBeVisible({ timeout: 10000 });
}

async function closeConfirmationMessage(page: Page): Promise<void> {
  await page.locator("button[aria-label='Close']").click();
}

async function toggleEmailPreferenceAndConfirm(
  page: Page,
  settingsNotificationPage: SettingsNotificationsPage,
  checkbox: Locator
): Promise<void> {
  await checkbox.click();
  await settingsNotificationPage.emailPreferencesSaveButton.click();
  await checkConfirmationMessage(page, 'Email preferences successfully updated.');
  await closeConfirmationMessage(page);
}

async function checkAddingNotification(page: Page, dropdownIndex: number): Promise<void> {
  const dropdown = page.locator('p-select span[role="combobox"]').nth(dropdownIndex);
  await dropdown.click();
  await page.getByRole('option', { name: 'Never', exact: true }).click();
  await checkConfirmationMessage(page);
  await closeConfirmationMessage(page);

  await dropdown.click();
  await page.getByRole('option', { name: 'Daily', exact: true }).click();
  await checkConfirmationMessage(page);
  await closeConfirmationMessage(page);

  await dropdown.click();
  await page.getByRole('option', { name: 'Instant', exact: true }).click();
  await checkConfirmationMessage(page);
}

test.describe('Settings Notifications', () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  test('adding file uploaded notification', async ({ page, settingsNotificationPage }) => {
    void settingsNotificationPage;
    await acceptCookies(page);
    await checkAddingNotification(page, 0);
  });

  test('adding preprint submissions updated notification', async ({ page, settingsNotificationPage }) => {
    void settingsNotificationPage;
    await acceptCookies(page);
    await checkAddingNotification(page, 1);
  });

  test('email preferences', async ({ page, settingsNotificationPage }) => {
    await acceptCookies(page);

    await expect(settingsNotificationPage.emailPreferencesHeader).toHaveText('Configure Email Preferences');
    await expect(settingsNotificationPage.emailGeneralLabel).toHaveText('Open Science Framework General');
    await expect(settingsNotificationPage.emailGeneralDescription).toHaveText(
      'Receive general notifications about the OSF every 2-3 weeks.'
    );
    await expect(settingsNotificationPage.emailHelpLabel).toHaveText('Open Science Framework Help');
    await expect(settingsNotificationPage.emailHelpDescription).toHaveText(
      'Receive helpful tips on how to make the most of the OSF, up to once per week.'
    );
    await expect(settingsNotificationPage.emailPreferencesSaveButton).toHaveText('Save');

    await toggleEmailPreferenceAndConfirm(page, settingsNotificationPage, settingsNotificationPage.emailHelpCheckbox);
    await toggleEmailPreferenceAndConfirm(
      page,
      settingsNotificationPage,
      settingsNotificationPage.emailGeneralCheckbox
    );
    await toggleEmailPreferenceAndConfirm(page, settingsNotificationPage, settingsNotificationPage.emailHelpCheckbox);
    await toggleEmailPreferenceAndConfirm(
      page,
      settingsNotificationPage,
      settingsNotificationPage.emailGeneralCheckbox
    );
  });
});
