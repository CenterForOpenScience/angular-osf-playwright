import { Page, Locator } from '@playwright/test';


export class Navbar {
  constructor(protected readonly page: Page) {}

  get homeLink(): Locator {
    return this.page.locator('#home_header');
  }

  get searchLink(): Locator {
    return this.page.locator('#search_header');
  }


  get supportLink(): Locator {
    return this.page.locator('#support_header');
  }

  get meetingsLink(): Locator {
    return this.page.locator('#meetings_header');
  }

  get institutionsLink(): Locator {
    return this.page.locator('#institutions_header');
  }

  /** Opens cos.io/support-cos in a new tab - pair with `clickExpectingPopup`. */
  get donateLink(): Locator {
    return this.page.locator('#donate_header');
  }


  get signInButton(): Locator {
    return this.page.locator('osf-header').getByRole('button', { name: 'Sign in', exact: true });
  }


  get signUpButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign Up', exact: true });
  }

  get profileLink(): Locator {
    return this.page.locator('#my-profile_header');
  }

  get logoutLink(): Locator {
    return this.page.locator('#log-out_header');
  }

  /** Only rendered when logged in - pair with `absent()` to confirm logged-out state. */
  get settingsHeader(): Locator {
    return this.page.locator('#settings_header');
  }

  get settingsProfileItem(): Locator {
    return this.page.locator('#settings-profile');
  }

  async clickSettingsProfileLink(): Promise<void> {
    await this.expandAndClick(this.settingsHeader, this.settingsProfileItem);
  }

  get registriesHeader(): Locator {
    return this.page.locator('#registries_header');
  }

  get registriesDiscoverItem(): Locator {
    return this.page.locator('#registries-overview');
  }

  async clickRegistriesLink(): Promise<void> {
    await this.expandAndClick(this.registriesHeader, this.registriesDiscoverItem);
  }

  get preprintsHeader(): Locator {
    return this.page.locator('#preprints_header');
  }

  get preprintsDiscoverItem(): Locator {
    return this.page.locator('#preprints-overview');
  }

  async clickPreprintsLink(): Promise<void> {
    await this.expandAndClick(this.preprintsHeader, this.preprintsDiscoverItem);
  }

  get myOsfHeader(): Locator {
    return this.page.locator('#my-resources_header');
  }

  /** Only rendered when logged in - pair with `absent()` to confirm logged-out state. */
  get myProjectsItem(): Locator {
    return this.page.locator('#my-projects');
  }

  get myRegistrationsItem(): Locator {
    return this.page.locator('#my-registrations');
  }

  get myPreprintsItem(): Locator {
    return this.page.locator('#my-preprints');
  }

  async clickMyProjectsLink(): Promise<void> {
    await this.expandAndClick(this.myOsfHeader, this.myProjectsItem);
  }

  async clickMyRegistrationsLink(): Promise<void> {
    await this.expandAndClick(this.myOsfHeader, this.myRegistrationsItem);
  }

  async clickMyPreprintsLink(): Promise<void> {
    await this.expandAndClick(this.myOsfHeader, this.myPreprintsItem);
  }


  private async expandAndClick(header: Locator, item: Locator): Promise<void> {
    const urlBeforeClick = this.page.url();
    await header.click();
    await item.waitFor({ state: 'visible' });

    await item.click();
    await this.page.waitForURL((url) => url.toString() !== urlBeforeClick, { timeout: 4500 });

  }
}
