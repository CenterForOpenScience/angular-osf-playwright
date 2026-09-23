import { Page, Locator } from '@playwright/test';

/**
 * Port of `components/registration.py`'s `SubmittedSideNavbar` - the side navigation
 * for a submitted registration. Rendered inside the app's single persistent
 * `osf-sidenav` (shared with the rest of the app, see `Navbar.ts`), scoped here so a
 * link like "Links" or "Analytics" can't accidentally match something in the global
 * nav below it. `comments_link` (`Comments`) was never rendered on the live app during
 * migration (feature-flagged off) and isn't ported - it wasn't used in
 * `test_registration_sidebar.py` either.
 */
export class RegistrationSideNavbar {
  constructor(protected readonly page: Page) {}

  private link(name: string): Locator {
    return this.page.locator('osf-sidenav').getByRole('link', { name, exact: true });
  }

  get overviewLink(): Locator {
    return this.link('Overview');
  }

  get metadataLink(): Locator {
    return this.link('Metadata');
  }

  get filesLink(): Locator {
    return this.link('Files');
  }

  get resourcesLink(): Locator {
    return this.link('Resources');
  }

  get wikiLink(): Locator {
    return this.link('Wiki');
  }

  get componentsLink(): Locator {
    return this.link('Components');
  }

  get linksLink(): Locator {
    return this.link('Links');
  }

  get analyticsLink(): Locator {
    return this.link('Analytics');
  }
}
