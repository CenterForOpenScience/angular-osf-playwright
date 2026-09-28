import { Page, Locator, expect } from '@playwright/test';


function dialog(page: Page): Locator {
  return page.locator('[role="dialog"][aria-modal="true"]');
}

export class AddContributorModal {
  constructor(protected readonly page: Page) {}

  get searchInput(): Locator {
    return dialog(this.page).getByPlaceholder('Search by name or user information');
  }


  async searchFor(userName: string): Promise<void> {
    const searchResponse = this.page
      .waitForResponse((response) => response.url().includes('/trove/index-card-search'))
      .catch(() => {
        throw new Error(
          `SHARE user search did not respond for '${userName}' - staging SHARE search ` +
            'is likely down (known backend issue, see CLAUDE.md), not a locator problem.'
        );
      });
    await this.searchInput.fill(userName);
    await searchResponse;
  }


  async selectContributorCheckboxByName(contributorName: string): Promise<void> {
    const row = dialog(this.page)
      .locator('div.border-divider')
      .filter({ has: this.page.getByRole('link', { name: contributorName, exact: true }) });
    await row.locator('input[type="checkbox"]').check({ force: true });
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await dialog(this.page).getByRole('button', { name: buttonName, exact: true }).click();
  }

  clickOnNext(): Promise<void> {
    return this.clickOnButton('Next');
  }
}

export class CreateVolModal {
  constructor(protected readonly page: Page) {}

  get linkNameInput(): Locator {
    return dialog(this.page).getByPlaceholder('Type link name');
  }

  async selectAnonymousCheckbox(): Promise<void> {
    await dialog(this.page).locator('#anonymous').click();
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await dialog(this.page).getByRole('button', { name: buttonName, exact: true }).click();
  }
}


export class DeleteVolModal {
  constructor(protected readonly page: Page) {}

  get deleteButton(): Locator {
    return this.page.locator('button.p-confirmdialog-accept-button');
  }

  get cancelButton(): Locator {
    return this.page.locator('button.p-confirmdialog-reject-button');
  }

  async clickOnButton(buttonName: string): Promise<void> {
    if (buttonName === 'Delete') {
      await this.deleteButton.click();
    } else {
      await this.cancelButton.click();
    }
  }
}


export class EditContributorsModal {
  constructor(protected readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('dialog', { name: 'Edit contributors', exact: true });
  }

  get searchInput(): Locator {
    return this.root.getByPlaceholder('Search Registration Contributors');
  }

  get tableRows(): Locator {
    return this.root.locator('tbody.p-datatable-tbody tr');
  }


  async searchFor(contributorName: string): Promise<Locator> {
    await this.searchInput.fill(contributorName);
    const row = this.rowFor(contributorName);
    await expect(row).toHaveCount(1);
    return row;
  }

  rowFor(contributorName: string): Locator {
    return this.tableRows.filter({
      has: this.page.getByRole('link', { name: contributorName, exact: true }),
    });
  }

  userPermission(contributorName: string): Locator {
    return this.rowFor(contributorName).getByRole('combobox');
  }

  removeButton(contributorName: string): Locator {
    return this.rowFor(contributorName).getByRole('button', { name: 'Delete', exact: true });
  }

  async selectFromDropdownListbox(contributorName: string, permission: string): Promise<void> {
    await this.userPermission(contributorName).click();
    await this.page
      .getByRole('option')
      .filter({ hasText: new RegExp(`^\\s*${permission.replace(/\+/g, '\\+')}\\s*$`) })
      .click();
  }


  get removeConfirmButton(): Locator {
    return this.page
      .getByRole('alertdialog', { name: 'Remove contributor' })
      .getByRole('button', { name: 'Remove', exact: true });
  }

  async clickOnBibliographicCheckbox(contributorName: string): Promise<void> {
    await this.rowFor(contributorName).getByLabel('Bibliographic Contributor').click();
  }


  async clickOnButton(buttonName: string): Promise<void> {
    await this.root
      .locator('.p-dialog-content')
      .getByRole('button', { name: buttonName, exact: true })
      .click();
  }
}

export class EditAffiliationsModal {
  constructor(protected readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('dialog', { name: 'Edit Affiliated Institutions', exact: true });
  }


  async clickOnCheckbox(institutionId: string): Promise<void> {
    await this.root.locator(`input[type="checkbox"][id="${institutionId}"]`).click();
  }

  get saveAffiliationsButton(): Locator {
    return this.root.getByRole('button', { name: 'Save', exact: true });
  }
}

export class EditLicenseModal {
  constructor(protected readonly page: Page) {}

  get root(): Locator {
    return this.page.getByRole('dialog', { name: 'Edit License', exact: true });
  }

  get saveButton(): Locator {
    return this.root.getByRole('button', { name: 'Save', exact: true });
  }

  async selectFromDropdownListbox(license: string): Promise<void> {
    await this.root.getByRole('combobox').click();
    await this.page.getByRole('option', { name: license, exact: true }).click();
  }
}
