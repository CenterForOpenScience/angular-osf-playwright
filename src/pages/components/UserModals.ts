import { Page, Locator } from '@playwright/test';

/**
 * Port of `components/user.py`. In the Python framework these are `BaseElement`
 * subclasses instantiated via `ComponentLocator` on a parent page object, but nearly
 * every locator/method inside them queries the whole document (not scoped to a root
 * element), so here they're modelled the same way LoginPage's helper classes are:
 * plain classes wrapping a `Page`, constructed directly by the owning page object.
 */

export class SettingsSideNavigation {
  constructor(protected readonly page: Page) {}

  get profileInformationLink(): Locator {
    return this.page.getByRole('link', { name: 'Profile information', exact: true });
  }

  get accountSettingsLink(): Locator {
    return this.page.getByRole('link', { name: 'Account settings', exact: true });
  }

  get configureAddonsLink(): Locator {
    return this.page.getByRole('link', { name: 'Configure add-on accounts', exact: true });
  }

  get notificationsLink(): Locator {
    return this.page.getByRole('link', { name: 'Notifications', exact: true });
  }

  get developerAppsLink(): Locator {
    return this.page.getByRole('link', { name: 'Developer apps', exact: true });
  }

  get personalAccessTokensLink(): Locator {
    return this.page.getByRole('link', { name: 'Personal access tokens', exact: true });
  }
}

export class DeleteDevAppModal {
  constructor(protected readonly page: Page) {}

  get appName(): Locator {
    return this.page.locator('.p-dialog-title');
  }

  get cancelButton(): Locator {
    return this.page.locator('button.p-confirmdialog-reject-button');
  }

  get deleteButton(): Locator {
    return this.page.locator('button.p-confirmdialog-accept-button');
  }
}

export class DeletePATModal {
  constructor(protected readonly page: Page) {}

  get tokenName(): Locator {
    return this.page.locator('.p-dialog-title');
  }

  get cancelButton(): Locator {
    return this.page.locator(
      'button.p-ripple.p-button.p-component.p-button-info.p-confirmdialog-reject-button'
    );
  }

  get deleteButton(): Locator {
    return this.page.locator(
      'button.p-ripple.p-button.p-component.p-button-danger.p-confirmdialog-accept-button'
    );
  }
}

export class ConfirmPATModal {
  constructor(protected readonly page: Page) {}

  get tokenName(): Locator {
    return this.page.locator('osf-token-created-dialog > div > div > p > strong');
  }

  get inputElement(): Locator {
    return this.page.locator(
      'input.p-inputtext.p-component.w-full.overflow-ellipsis.p-filled'
    );
  }

  get copyToClipboardButton(): Locator {
    return this.page.locator(
      'button.p-ripple.p-button.p-component.p-button-icon-only.p-button-contrast.p-button-text[aria-label="Copy to clipboard button"]'
    );
  }

  get closeButton(): Locator {
    return this.page.locator('osf-token-created-dialog > div > div > p-button > button');
  }
}

export class ConfirmDeactivationRequestModal {
  constructor(protected readonly page: Page) {}

  get cancelButton(): Locator {
    return this.page.locator('button.p-button-info.w-full > span.p-button-label');
  }

  get requestButton(): Locator {
    return this.page.locator('button.p-button-danger.w-full > span.p-button-label');
  }
}

export class UndoDeactivationRequestModal {
  constructor(protected readonly page: Page) {}

  get cancelButton(): Locator {
    return this.page.locator('button.p-button-info > span.p-button-label');
  }

  get undoRequestButton(): Locator {
    return this.page.getByRole('button', { name: 'Undo', exact: true });
  }
}

export class Configure2FAModal {
  constructor(protected readonly page: Page) {}

  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  get configureButton(): Locator {
    return this.page.locator('p-button > button.p-confirmdialog-accept-button');
  }
}

export class ConfirmEmailSentModal {
  constructor(protected readonly page: Page) {}

  get cancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel', exact: true });
  }

  get alternativeEmailCloseButton(): Locator {
    return this.page.locator('.p-dialog-close-button');
  }

  get addButton(): Locator {
    return this.page.getByRole('button', { name: 'Add', exact: true });
  }

  get closeButton(): Locator {
    return this.page.getByRole('button', { name: 'Close', exact: true });
  }

  get closeModalButton(): Locator {
    return this.page.locator('[aria-label="Close"]');
  }
}

export class ConfirmRemoveEmailModal {
  constructor(protected readonly page: Page) {}


  get deletedEmail(): Locator {
    return this.page.locator('[data-test-delete-modal-body] > p > strong');
  }

  get deleteButton(): Locator {
    return this.page.getByRole('button', { name: 'Delete', exact: true });
  }
}

export class DeleteAffiliatedInstitutionModal {
  constructor(protected readonly page: Page) {}

  get cancelButton(): Locator {
    return this.page.locator('button.p-confirmdialog-reject-button');
  }

  get deleteButton(): Locator {
    return this.page.locator('button.p-confirmdialog-accept-button');
  }
}

async function getVisibleAddonCardTitles(page: Page): Promise<string[]> {
  const titles = page.locator('[data-test-addon-card-title]');
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

export class DisableAddonModal {
  constructor(protected readonly page: Page) {}

  getAddonsList(): Promise<string[]> {
    return getVisibleAddonCardTitles(this.page);
  }

  async clickOnDisableButton(): Promise<void> {
    const disableButtons = this.page.getByRole('button', { name: 'Disable', exact: true });
    const connectedAddonsList = await this.getAddonsList();
    const buttonIndex = connectedAddonsList.length;
    await disableButtons.nth(buttonIndex).click();
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName, exact: true }).click();
  }
}

export class ReconnectAddonModal {
  constructor(protected readonly page: Page) {}

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName, exact: true }).click();
  }
}

export interface AddonCondition {
  Function: string;
  status: string;
  class: string;
}

export class ConnectAddonModal {
  constructor(protected readonly page: Page) {}

  get dataverseApiTokenInput(): Locator {
    return this.page.getByPlaceholder('API Token');
  }

  async dataverseAccountInputs(accountName: string, url: string, apiToken: string): Promise<void> {
    const dataverseInputs = this.page.locator('[pinputtext]');
    await dataverseInputs.nth(0).fill(url);
    await dataverseInputs.nth(1).fill(apiToken);
    await dataverseInputs.nth(2).fill(accountName);
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName, exact: true }).click();
  }

  async getRowCount(elementClass: string): Promise<number> {
    // The Connect modal's table renders asynchronously after opening - counting
    // immediately can race it and see 0 rows, so wait for the first row first.
    await this.page.locator('table tbody tr').first().waitFor({ state: 'visible' });
    return this.page.locator(`tr.${elementClass}`).count();
  }

  /** Verify each expected {Function, status, class} condition appears in the addon's
   * terms-and-conditions table for the given provider. */
  async verifyProviderConditions(
    provider: string,
    expectedConditions: AddonCondition[]
  ): Promise<void> {
    const rows = this.page.locator('table tbody tr');
    await rows.first().waitFor({ state: 'visible' });
    const rowCount = await rows.count();
    const providerRows: Locator[] = [];
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const text = (await row.innerText()).toLowerCase();
      if (text.includes(provider.toLowerCase())) providerRows.push(row);
    }
    if (!providerRows.length) {
      throw new Error(`No rows found for provider: ${provider}`);
    }

    for (const expected of expectedConditions) {
      let matchedRow: Locator | null = null;
      for (const row of providerRows) {
        const rowText = (await row.innerText()).trim();
        if (rowText.toLowerCase().includes(expected.Function.toLowerCase())) {
          matchedRow = row;
          break;
        }
      }
      if (!matchedRow) {
        throw new Error(
          `Function '${expected.Function}' not found for provider '${provider}'`
        );
      }
      const actualClasses = (await matchedRow.getAttribute('class')) ?? '';
      if (!actualClasses.includes(expected.class)) {
        throw new Error(
          `Provider '${provider}' function '${expected.Function}' expected status '${expected.status}' ` +
            `expected class '${expected.class}' but got '${actualClasses}'`
        );
      }
    }
  }
}

export class ConnectMendeleyModal {
  constructor(protected readonly page: Page) {}

  get emailInput(): Locator {
    return this.page.locator('input#bdd-email');
  }

  get continueButton(): Locator {
    return this.page.locator('button#bdd-elsPrimaryBtn');
  }

  get passwordInput(): Locator {
    return this.page.locator('input#bdd-password');
  }

  get signInButton(): Locator {
    return this.page.locator('button#bdd-elsPrimaryBtn');
  }

  async connectToMendeley(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.continueButton.click();
    await this.passwordInput.fill(password);
    await this.signInButton.click();
  }
}

export class ConnectZoteroModal {
  constructor(protected readonly page: Page) {}

  get usernameInput(): Locator {
    return this.page.locator('input#username');
  }

  get passwordInput(): Locator {
    return this.page.locator('input#password');
  }

  get verifyHuman(): Locator {
    return this.page.locator('div#success');
  }

  get loginButton(): Locator {
    return this.page.locator('button#login');
  }

  async connectToZotero(username: string, password: string): Promise<void> {
    await this.verifyHuman.waitFor({ state: 'visible', timeout: 30000 });
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.waitFor({ state: 'visible', timeout: 30000 });
    await this.loginButton.click();
  }
}
