import { Page, Locator } from '@playwright/test';

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
