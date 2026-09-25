import { Page, Locator, expect } from '@playwright/test';

/**
 * Port of the registration-contributors-page modals in `components/registration.py`
 * (`AddContributorsModal`, `CreateVOLModal`, `DeleteVOLModal`). Each PrimeNG dialog is
 * portaled to `document.body`, not nested under any page-section root, and the app
 * also runs a Help Scout Beacon widget that carries its own `role="dialog"` - so every
 * dialog here is scoped by `[aria-modal="true"]` as well, not just `role="dialog"`,
 * to avoid ever matching the Beacon widget.
 */
function dialog(page: Page): Locator {
  return page.locator('[role="dialog"][aria-modal="true"]');
}

export class AddContributorModal {
  constructor(protected readonly page: Page) {}

  get searchInput(): Locator {
    return dialog(this.page).getByPlaceholder('Search by name or user information');
  }

  /**
   * The checkbox's native `<input>` sits visually on top of PrimeNG's decorative
   * `.p-checkbox-box` div (verified live via `_debug_inspect.spec.ts` per CLAUDE.md:
   * a plain click on `.p-checkbox-box` fails actionability - "input intercepts
   * pointer events" - every retry for the full 25s timeout). `check({ force: true })`
   * on the input itself is the reliable target.
   */
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

/**
 * Unlike `AddContributorModal`/`CreateVolModal` (PrimeNG `p-dialog`, `role="dialog"`),
 * the VOL delete confirmation is PrimeNG's built-in `p-confirmdialog`
 * (`role="alertdialog"`) - per CLAUDE.md, its buttons are
 * `.p-confirmdialog-accept-button` / `.p-confirmdialog-reject-button`, not
 * role/text-matched. Verified live: with a `role="dialog"` scope, the row's own
 * still-visible "Delete" button behind the overlay makes `getByRole('button', {name:
 * 'Delete'})` ambiguous.
 */
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

/**
 * Below: port of the metadata-page modals in `components/registration.py`
 * (`EditContributorsModal`, `EditAffiliationsModal`, `EditLicenseModal`). Each is a
 * `p-dialog` whose `aria-labelledby` header gives it an accessible name, so they're
 * scoped with `getByRole('dialog', { name })` - verified live via
 * `_debug_inspect.spec.ts` per CLAUDE.md. That also keeps them apart when the Add
 * Contributor dialog opens on top of the Edit contributors one.
 */
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

  /**
   * Unlike the Contributors *page* (`RegistrationContributorsPage.searchFor`), this
   * dialog's search box doesn't filter the table - verified live via
   * `_debug_inspect.spec.ts`: typing a name (or pressing Enter) leaves every row in
   * place. Python's `user_permission` therefore silently read the *first* row (the
   * registration's admin owner) rather than the searched contributor. The search is
   * still typed to mirror the Python flow, but the row itself is located by name.
   */
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

  /**
   * Matched by visible text rather than `getByRole('option', { name })`: these options'
   * accessible names aren't their visible labels (the select itself is labelled with
   * raw i18n keys like `project.contributors.permissions.administrator`). Anchored so
   * `Read` can't also match `Read + Write`.
   */
  async selectFromDropdownListbox(contributorName: string, permission: string): Promise<void> {
    await this.userPermission(contributorName).click();
    await this.page
      .getByRole('option')
      .filter({ hasText: new RegExp(`^\\s*${permission.replace(/\+/g, '\\+')}\\s*$`) })
      .click();
  }

  /** The delete confirmation is a PrimeNG `p-confirmdialog` (`role="alertdialog"`), not part of this dialog. */
  get removeConfirmButton(): Locator {
    return this.page
      .getByRole('alertdialog', { name: 'Remove contributor' })
      .getByRole('button', { name: 'Remove', exact: true });
  }

  async clickOnBibliographicCheckbox(contributorName: string): Promise<void> {
    await this.rowFor(contributorName).getByLabel('Bibliographic Contributor').click();
  }

  /**
   * Scoped to the dialog body: the header's X icon button is also named "Close"
   * (`aria-label`), which would make a dialog-wide `Close` lookup ambiguous.
   */
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

  /**
   * The institution checkboxes carry no accessible name (the logo `<img>` beside them
   * holds the institution's name as `alt`), so the input's `id` - the institution id,
   * same hook the Python original used - is the only unique handle.
   */
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
