import { Page, Locator, expect } from '@playwright/test';

import * as settings from '../../config/settings';
import { present } from '../utils';
import { BasePage } from './BasePage';
import {
  SettingsSideNavigation,
  DeleteDevAppModal,
  DeletePATModal,
  ConfirmPATModal,
  ConfirmDeactivationRequestModal,
  UndoDeactivationRequestModal,
  Configure2FAModal,
  ConfirmEmailSentModal,
  ConfirmRemoveEmailModal,
  DeleteAffiliatedInstitutionModal,
  DisableAddonModal,
  ReconnectAddonModal,
  ConnectAddonModal,
  ConnectMendeleyModal,
  ConnectZoteroModal,
} from './components/UserModals';

/** Port of `pages/user.py`. */

export class UserProfilePage extends BasePage {
  constructor(page: Page, protected readonly guid: string) {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/${this.guid}`;
  }

  get identity(): Locator {
    return this.page.locator('osf-profile-information');
  }

  get profileName(): Locator {
    return this.page.locator('osf-profile-information h1');
  }

  get orcidLink(): Locator {
    return this.page.locator('osf-profile-information a[href*="orcid.org"]');
  }

  get projectsTab(): Locator {
    return this.page.getByRole('navigation').getByRole('button', { name: 'Projects' });
  }

  get registrationsTab(): Locator {
    return this.page.getByRole('navigation').getByRole('button', { name: 'Registrations' });
  }

  get preprintsTab(): Locator {
    return this.page.getByRole('navigation').getByRole('button', { name: 'Preprints' });
  }

  get resultCount(): Locator {
    return this.page.locator('h4.result-count');
  }

  get nodeType(): Locator {
    return this.page.locator('p.type.py-1.px-3.font-bold');
  }

  get noPublicProjectsText(): Locator {
    return this.page.locator('#publicProjects .help-block');
  }

  get noPublicComponentsText(): Locator {
    return this.page.locator('#publicComponents .help-block');
  }

  get editProfileLink(): Locator {
    return this.page.locator('#edit-profile-settings');
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }

  get publicProjects(): Locator {
    return this.page.locator('#publicProjects .list-group-item');
  }

  get publicComponents(): Locator {
    return this.page.locator('#publicComponents .list-group-item');
  }
}

/**
 * Port of `BaseUserSettingsPage`. Subclasses override `url`/`identity` as needed -
 * most of them live under `/settings/` with distinct query params or sub-paths.
 */
export abstract class UserSettingsPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/`;
  }

  get identity(): Locator {
    return this.page.locator('osf-settings-container');
  }

  get sideNavigation(): SettingsSideNavigation {
    return new SettingsSideNavigation(this.page);
  }
}

export class ProfileInformationPage extends UserSettingsPage {
  get identity(): Locator {
    return this.page.locator('osf-profile-settings');
  }

  get middleNameInput(): Locator {
    return this.page.getByLabel('Middle Name(s) (Optional)', { exact: true });
  }

  get familyNameInput(): Locator {
    return this.page.getByLabel('Family Name', { exact: true });
  }

  get givenNameInput(): Locator {
    return this.page.getByLabel('Given Name', { exact: true });
  }

  get citationBlocks(): Locator {
    return this.page.locator('div.column-gap-4');
  }

  get saveButton(): Locator {
    return this.page.locator('osf-name').getByRole('button', { name: 'Save', exact: true });
  }

  get updateSuccess(): Locator {
    return this.page.getByRole('alert').filter({ hasText: 'successfully updated' });
  }
}

export class ProfileSettingsPageEducationTab extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/profile?tab=4`;
  }

  get institutionInput(): Locator {
    return this.page.getByLabel('Institution', { exact: true });
  }

  // The app renders every profile tab's form in the DOM simultaneously (not just the
  // active tab), and the employment tab's first-record department field shares the
  // same `id="department-0"` as this one - `getByLabel` resolves `for="department-0"`
  // via the browser's first-match-in-document semantics, which lands on the hidden
  // employment field instead. Scope by the education form's custom element to avoid
  // the collision, matching the date-field locators below.
  get departamentInputField(): Locator {
    return this.page.locator('osf-education-form input[formcontrolname="department"]');
  }

  get degreeInputField(): Locator {
    return this.page.getByLabel('Degree', { exact: true });
  }

  get startDateInputField(): Locator {
    return this.page.locator('osf-education-form p-datepicker[formcontrolname="startDate"] input');
  }

  get endDateInputField(): Locator {
    return this.page.locator('osf-education-form p-datepicker[formcontrolname="endDate"] input');
  }

  get addOneMoreButton(): Locator {
    return this.page.getByRole('button', { name: 'Add One More', exact: true });
  }

  get removeEducationButton(): Locator {
    return this.page.getByRole('button', { name: 'Remove', exact: true }).first();
  }

  get saveEducationButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  get discardChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Discard Changes', exact: true });
  }

  get discardChangesConfirmationButton(): Locator {
    return this.page.locator('.p-confirmdialog-accept-button');
  }

  get educationSuccessfullyUpdatedPopUpMessage(): Locator {
    return this.page.getByRole('alert').filter({ hasText: 'Education successfully updated.' });
  }

  get educationCard(): Locator {
    return this.page.locator('osf-education-form');
  }

  get errorMessages(): Locator {
    return this.page.getByText('The field is required.', { exact: true });
  }

  /** Repeatedly clicks the Remove button (if present) until no education record is
   * left, mirroring the Python `while True` / `TimeoutException` break loop. Remove only
   * updates local form state, so once everything is removed the form must be saved to
   * persist the change. */
  async removeRecordIfExists(): Promise<void> {
    let removedAny = false;
    for (;;) {
      const visible = await present(this.removeEducationButton, 3000);
      if (!visible) break;
      try {
        await this.removeEducationButton.click({ timeout: 3000 });
      } catch {
        break;
      }
      removedAny = true;
    }
    if (removedAny) {
      await this.saveEducationButton.click();
    }
  }
}

export class SettingsNotificationsPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/notifications`;
  }

  get emailPreferencesHeader(): Locator {
    return this.page.getByRole('heading', { name: 'Configure Email Preferences', exact: true });
  }

  get emailGeneralCheckbox(): Locator {
    return this.page.locator('#v1');
  }

  get emailGeneralLabel(): Locator {
    return this.page.locator('label[for="v1"]');
  }

  get emailGeneralDescription(): Locator {
    return this.page.locator('div:has(> label[for="v1"]) > p');
  }

  get emailHelpCheckbox(): Locator {
    return this.page.locator('#v2');
  }

  get emailHelpLabel(): Locator {
    return this.page.locator('label[for="v2"]');
  }

  get emailHelpDescription(): Locator {
    return this.page.locator('div:has(> label[for="v2"]) > p');
  }

  get emailPreferencesSaveButton(): Locator {
    return this.page
      .locator('section:has(> h2:text-is("Configure Email Preferences"))')
      .getByRole('button', { name: 'Save', exact: true });
  }
}

export class ProfileSettingsPageSocialTab extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/profile?tab=2`;
  }

  get socialLink1Input(): Locator {
    return this.page.locator('#social-input0');
  }

  get socialLink2Input(): Locator {
    return this.page.locator('#social-input1');
  }

  get socialLink3Input(): Locator {
    return this.page.locator('#social-input2');
  }

  get socialLink4Input(): Locator {
    return this.page.locator('#social-input3');
  }

  get socialLink5Input(): Locator {
    return this.page.locator('#social-input4');
  }

  get socialLink6Input(): Locator {
    return this.page.locator('#social-input5');
  }

  get socialLink7Input(): Locator {
    return this.page.locator('#social-input6');
  }

  get socialLink8Input(): Locator {
    return this.page.locator('#social-input7');
  }

  get socialLink9Input(): Locator {
    return this.page.locator('#social-input8');
  }

  get socialLink10Input(): Locator {
    return this.page.locator('#social-input9');
  }

  get socialLinkInputs(): Locator[] {
    return [
      this.socialLink1Input,
      this.socialLink2Input,
      this.socialLink3Input,
      this.socialLink4Input,
      this.socialLink5Input,
      this.socialLink6Input,
      this.socialLink7Input,
      this.socialLink8Input,
      this.socialLink9Input,
      this.socialLink10Input,
    ];
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  get successfullyUpdatedMessage(): Locator {
    return this.page.getByRole('alert').filter({ hasText: 'Social successfully updated' }).first();
  }
}

export class ProfileSettingsPageEmploymentTab extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/profile?tab=3`;
  }

  get addPositionButton(): Locator {
    return this.page.getByRole('button', { name: 'Add Position', exact: true });
  }

  get jobTitleInput(): Locator {
    return this.page.getByLabel('Job Title', { exact: true });
  }

  get institutionEmployerInput(): Locator {
    return this.page.getByLabel('Institution / Employer', { exact: true });
  }

  get saveEmploymentButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  get employmentSuccessfullyUpdatedPopUpMessage(): Locator {
    return this.page.getByRole('alert').filter({ hasText: 'Employment successfully updated.' });
  }

  get startDateInputField(): Locator {
    return this.page.locator('osf-employment-form p-datepicker[formcontrolname="startDate"] input');
  }

  get endDateInputField(): Locator {
    return this.page.locator('osf-employment-form p-datepicker[formcontrolname="endDate"] input');
  }

  get removeEmploymentButton(): Locator {
    return this.page.getByRole('button', { name: 'Remove', exact: true }).first();
  }

  get discardChangesButton(): Locator {
    return this.page.getByRole('button', { name: 'Discard Changes', exact: true });
  }

  get discardChangesConfirmationButton(): Locator {
    return this.page.locator('.p-confirmdialog-accept-button');
  }

  get educationCard(): Locator {
    return this.page.locator('osf-education-form');
  }

  get errorMessages(): Locator {
    return this.page.getByText('The field is required.', { exact: true });
  }

  /** Repeatedly clicks the Remove button (if present) until no employment record is
   * left, mirroring the Python `while True` / `TimeoutException` break loop. */
  async removeRecordIfExists(): Promise<void> {
    for (;;) {
      const visible = await present(this.removeEmploymentButton, 5000);
      if (!visible) break;
      await this.removeEmploymentButton.click();
    }
  }
}

export class AccountSettingsPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/account/`;
  }

  get identity(): Locator {
    return this.page.locator('osf-connected-emails');
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }

  get emailAddressInput(): Locator {
    return this.page.locator(
      'input.p-inputtext.p-component[placeholder="email@example.com"]'
    );
  }

  get addEmailButton(): Locator {
    return this.page.getByRole('button', { name: 'Add Email', exact: true });
  }

  get storageLocationListbox(): Locator {
    return this.page.locator('span[role="combobox"][aria-label="United States"]');
  }

  get firstAffiliatedInstitution(): Locator {
    return this.page.locator(
      'input[pinputtext][aria-label="common.labels.affiliatedInstitution"]'
    );
  }

  get firstAffInstDeleteButton(): Locator {
    return this.page.locator('osf-affiliated-institutions p-inputicon.remove-icon');
  }

  get connectedEmailRemoveIconButton(): Locator {
    return this.page.locator('osf-connected-emails p-inputicon.remove-icon');
  }

  get noAffiliationsMessage(): Locator {
    return this.page.locator('osf-affiliated-institutions .p-card-content p:nth-of-type(2)');
  }

  get toastMessage(): Locator {
    return this.page.locator('div.p-toast-message-success .font-medium');
  }

  get updatePasswordButton(): Locator {
    return this.page
      .locator('div:has(> h2:text-is("Change Password"))')
      .getByRole('button', { name: 'Update', exact: true });
  }

  get updatePasswordButtonInactive(): Locator {
    return this.updatePasswordButton.and(this.page.locator('[disabled]'));
  }

  get oldPasswordErrorMessage(): Locator {
    return this.page.locator(
      'div[data-test-current-password] > div > div[data-test-help-block]'
    );
  }

  get newPasswordErrorMessage(): Locator {
    return this.page.getByText('Password must be at least 8 characters long.', { exact: true });
  }

  get confirmPasswordErrorMessage(): Locator {
    return this.page.getByText('Passwords do not match', { exact: true });
  }

  get configure2faButton(): Locator {
    return this.page.getByRole('button', { name: 'Configure', exact: true });
  }

  get configure2faTitle(): Locator {
    return this.page.getByRole('heading', { name: 'Two-factor authentication', exact: true });
  }

  get twoFactorQrCodeImg(): Locator {
    return this.page.locator('div.qrcode > canvas');
  }

  get cancel2faButton(): Locator {
    return this.page.locator('button.p-button-info > span.p-button-label');
  }

  get requestDeactivationButton(): Locator {
    return this.page.getByRole('button', { name: 'Request deactivation', exact: true });
  }

  get pendingDeactivationMessage(): Locator {
    return this.page.getByText('Your account is currently pending deactivation.', { exact: true });
  }

  get undoDeactivationRequestButton(): Locator {
    return this.page.getByRole('button', { name: 'Undo deactivation request', exact: true });
  }

  get unconfirmedEmails(): Locator {
    return this.page.locator('div[data-test-unconfirmed-email-item]');
  }

  get optOutCard(): Locator {
    return this.page.locator('div.p-card-content:has(h2:text-is("Opt out of SHARE indexing"))');
  }

  get firstRadioOptOut(): Locator {
    return this.page.locator("p-radio-button[name='optOut']");
  }

  get secondRadioOptIn(): Locator {
    return this.page.locator("p-radio-button[name='optIn']");
  }

  get updateButton(): Locator {
    return this.page
      .locator('div[data-pc-section="content"]:has(h2:text-is("Opt out of SHARE indexing"))')
      .getByRole('button', { name: 'Update', exact: true });
  }

  get successfullyUpdatedShareMessage(): Locator {
    return this.page
      .locator('.p-toast-message .font-medium')
      .filter({ hasText: 'Successfully updated SHARE indexing preference.' });
  }

  get closeModalWindowButton(): Locator {
    return this.page.locator('button.p-toast-close-button[aria-label="Close"]');
  }

  get configure2faModal(): Configure2FAModal {
    return new Configure2FAModal(this.page);
  }

  get confirmDeactivationModal(): ConfirmDeactivationRequestModal {
    return new ConfirmDeactivationRequestModal(this.page);
  }

  get undoDeactivationModal(): UndoDeactivationRequestModal {
    return new UndoDeactivationRequestModal(this.page);
  }

  get confirmEmailSentModal(): ConfirmEmailSentModal {
    return new ConfirmEmailSentModal(this.page);
  }

  get confirmRemoveEmailModal(): ConfirmRemoveEmailModal {
    return new ConfirmRemoveEmailModal(this.page);
  }

  get deleteAffInstModal(): DeleteAffiliatedInstitutionModal {
    return new DeleteAffiliatedInstitutionModal(this.page);
  }

  async getUnconfirmedEmailItem(emailAddress: string): Promise<Locator | null> {
    const items = this.unconfirmedEmails;
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const item = items.nth(i);
      const emailAddr = item.locator('._email-address_mkik0');
      if ((await emailAddr.innerText()).includes(emailAddress)) {
        return item;
      }
    }
    return null;
  }
}

export class ConfigureAddonsPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/addons/`;
  }

  get identity(): Locator {
    return this.page.locator('osf-settings-addons');
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }

  get allAddonsTab(): Locator {
    return this.page.getByRole('tab', { name: 'All Add-ons' });
  }

  get connectedAddonsTab(): Locator {
    return this.page.getByRole('tab', { name: 'Connected Add-ons' });
  }

  get searchInput(): Locator {
    return this.page.locator('input[placeholder="Search add-ons"]:visible');
  }

  get addonCardTitle(): Locator {
    return this.page.locator('[data-test-addon-card-title]:visible');
  }

  get connectedTabEmpty(): Locator {
    return this.page.getByText('No results found.', { exact: true });
  }

  get disableButton(): Locator {
    return this.page.getByRole('button', { name: 'Disable', exact: true });
  }

  get startAuthButton(): Locator {
    return this.page.getByRole('link', { name: 'Start OAuth' });
  }

  connectedTabSearchInput(): Locator {
    return this.page.getByPlaceholder('Search add-ons').nth(1);
  }

  async clickOnTab(tab: Locator): Promise<void> {
    await tab.click();
  }

  async selectFromAddonDropdown(dropdownOption: string): Promise<void> {
    const addonDropdown = this.page.locator('div.p-select-dropdown').nth(1);
    const selectedLabel = this.page.locator('span.p-select-label').nth(1);
    // The option click occasionally doesn't register (selected label stays on the
    // previous category) - verify it took effect and retry the whole click sequence
    // if not, rather than trusting a single click blindly.
    // The dropdown options' accessible name is an untranslated i18n key (e.g.
    // "settings.addons.categories.citationManager"), not the visible label, so
    // getByRole can't match on visible text here - match the rendered text instead.
    await expect(async () => {
      await addonDropdown.click();
      await this.page
        .locator('div.p-select-list-container li', { hasText: dropdownOption })
        .click();
      await expect(selectedLabel).toHaveText(new RegExp(dropdownOption), { timeout: 5000 });
    }).toPass({ timeout: 20000 });
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName, exact: true }).click();
  }

  async getAddonsList(): Promise<string[]> {
    const titles = this.addonCardTitle;
    const count = await titles.count();
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      const card = titles.nth(i);
      if (await card.isVisible()) {
        result.push((await card.innerText()).trim().toLowerCase());
      }
    }
    return result;
  }

  async getAddonProviderLogo(provider: string): Promise<string | null> {
    const titles = this.addonCardTitle;
    const count = await titles.count();
    for (let i = 0; i < count; i++) {
      const text = (await titles.nth(i).innerText()).trim().toLowerCase();
      if (text === provider) {
        return this.page.locator('[data-test-addon-card-logo]:visible').nth(i).getAttribute('src');
      }
    }
    return null;
  }

  get disableAddonModal(): DisableAddonModal {
    return new DisableAddonModal(this.page);
  }

  get reconnectAddonModal(): ReconnectAddonModal {
    return new ReconnectAddonModal(this.page);
  }

  get connectMendeleyModal(): ConnectMendeleyModal {
    return new ConnectMendeleyModal(this.page);
  }

  get connectZoteroModal(): ConnectZoteroModal {
    return new ConnectZoteroModal(this.page);
  }

  get connectAddonModal(): ConnectAddonModal {
    return new ConnectAddonModal(this.page);
  }
}

export class NotificationsPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/notifications/`;
  }

  get identity(): Locator {
    return this.page.locator('#notificationSettings');
  }
}

export class DeveloperAppsPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/developer-apps`;
  }

  get identity(): Locator {
    return this.page.locator('osf-developer-apps');
  }

  get createDevAppButton(): Locator {
    return this.page.getByRole('button', { name: 'Create Developer App', exact: true });
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }

  get devAppCards(): Locator {
    return this.page.locator('p-card');
  }

  get deleteDevAppModal(): DeleteDevAppModal {
    return new DeleteDevAppModal(this.page);
  }

  async getDevAppCardByAppName(appName: string): Promise<Locator | null> {
    // The card list can still be mid-render for a moment right after the loading
    // indicator disappears, so this must poll for the matching card rather than
    // take a one-shot snapshot of `devAppCards` (which can catch a stale, partial
    // render and miss a just-created app).
    const card = this.devAppCards.filter({
      has: this.page.locator('a.app-link').getByRole('heading', { name: appName, exact: true }),
    });
    return (await present(card, settings.TIMEOUT_MS)) ? card : null;
  }
}

export class CreateDeveloperAppPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/applications/create`;
  }

  get identity(): Locator {
    return this.page.locator('osf-developer-app-add-edit-form');
  }

  get appNameInput(): Locator {
    return this.identity.getByLabel('App Name', { exact: true });
  }

  get projectUrlInput(): Locator {
    return this.identity.getByLabel('Project homepage URL', { exact: true });
  }

  get appDescriptionTextarea(): Locator {
    return this.identity.getByLabel('App description (optional)', { exact: true });
  }

  get callbackUrlInput(): Locator {
    return this.identity.getByLabel('Authorization callback URL', { exact: true });
  }

  get createDevAppButton(): Locator {
    return this.identity.getByRole('button', { name: 'Create Developer App', exact: true });
  }
}

export class EditDeveloperAppPage extends UserSettingsPage {
  constructor(page: Page, protected readonly clientId: string = '') {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/settings/developer-apps/${this.clientId}/details`;
  }

  get identity(): Locator {
    return this.page.locator('osf-developer-application-details');
  }

  get clientIdInput(): Locator {
    return this.page.locator('input[aria-labelledby="clientId"]');
  }

  get clientSecretInput(): Locator {
    return this.page
      .locator('section:has(> h2:text-is("Client Secret"))')
      .locator('input[pinputtext][readonly]');
  }

  get showClientSecretButton(): Locator {
    return this.page.locator('button.p-button.p-button-secondary');
  }

  get appNameInput(): Locator {
    return this.identity.getByLabel('App Name', { exact: true });
  }

  get projectUrlInput(): Locator {
    return this.identity.getByLabel('Project homepage URL', { exact: true });
  }

  get appDescriptionTextarea(): Locator {
    return this.identity.getByLabel('App description (optional)', { exact: true });
  }

  get callbackUrlInput(): Locator {
    return this.identity.getByLabel('Authorization callback URL', { exact: true });
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }
}

export const patScopeIds = [
  'osf.users.profile_write',
  'osf.full_write',
  'osf.full_read',
  'osf.nodes.metadata_write',
  'osf.nodes.metadata_read',
  'osf.nodes.access_read',
  'osf.nodes.access_write',
  'osf.nodes.data_read',
  'osf.nodes.data_write',
  'osf.users.email_read',
  'osf.users.profile_read',
  'osf.nodes.full_read',
  'osf.nodes.full_write',
] as const;

export class CreatePersonalAccessTokenPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/tokens/create`;
  }

  get identity(): Locator {
    return this.page.locator('osf-token-add-edit-form');
  }

  get tokenNameInput(): Locator {
    return this.identity.getByLabel('Token Name', { exact: true });
  }

  /** Scope checkboxes, keyed the same way as the `id` attribute in the DOM (matches
   * the raw `By.ID` lookups the original test used directly). */
  /** Scope ids contain dots (e.g. `osf.users.profile_write`), which a `#id` CSS
   * selector would misparse as id+class - use an attribute selector instead. */
  scopeCheckbox(scope: (typeof patScopeIds)[number]): Locator {
    return this.page.locator(`[id="${scope}"]`);
  }

  get createTokenButton(): Locator {
    return this.page.locator(
      'button.p-ripple.p-button.p-component[type="submit"][data-pc-name="button"]'
    );
  }

  get confirmPatModal(): ConfirmPATModal {
    return new ConfirmPATModal(this.page);
  }
}

export class EditPersonalAccessTokenPage extends UserSettingsPage {
  constructor(page: Page, protected readonly tokenId: string = '') {
    super(page);
  }

  get url(): string {
    return `${settings.OSF_HOME}/settings/tokens/${this.tokenId}/details`;
  }

  get identity(): Locator {
    return this.page.getByRole('heading', { name: 'Edit token', exact: true });
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }

  get backToListOfTokensLink(): Locator {
    return this.page.getByRole('link', { name: 'Back to list of personal tokens', exact: true });
  }

  get tokenNameInput(): Locator {
    return this.page.locator('input.p-inputtext.p-component.p-filled');
  }

  get tokenNameInputClear(): Locator {
    return this.page.locator('input[pinputtext]');
  }

  /** Scope ids contain dots (e.g. `osf.users.profile_write`), which a `#id` CSS
   * selector would misparse as id+class - use an attribute selector instead. */
  scopeCheckbox(scope: (typeof patScopeIds)[number]): Locator {
    return this.page.locator(`[id="${scope}"]`);
  }

  get deleteButton(): Locator {
    return this.page.locator('button.p-ripple.p-button.p-component.p-button-danger');
  }

  get saveButton(): Locator {
    return this.page.locator(
      'button.p-ripple.p-button.p-component[type="submit"][data-pc-name="button"]'
    );
  }

  get deletePatModal(): DeletePATModal {
    return new DeletePATModal(this.page);
  }
}

export class PersonalAccessTokenPage extends UserSettingsPage {
  get url(): string {
    return `${settings.OSF_HOME}/settings/tokens/`;
  }

  get identity(): Locator {
    return this.page.locator('osf-tokens');
  }

  get loadingIndicator(): Locator {
    return this.page.locator('p-progress-spinner');
  }

  get createTokenButton(): Locator {
    return this.page.locator('button.p-button.p-button-primary.w-full');
  }

  get patCards(): Locator {
    return this.page.locator('p-card');
  }

  get deletePatModal(): DeletePATModal {
    return new DeletePATModal(this.page);
  }

  async getPatCardByName(patName: string): Promise<Locator | null> {
    // Poll for the matching card rather than taking a one-shot snapshot - the
    // list can still be mid-render for a moment right after the loading
    // indicator disappears (see getDevAppCardByAppName for the same issue).
    const card = this.patCards.filter({
      has: this.page.locator('a.token-link').getByText(patName, { exact: true }),
    });
    return (await present(card, settings.TIMEOUT_MS)) ? card : null;
  }
}
