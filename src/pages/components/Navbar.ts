import { Page, Locator } from '@playwright/test';

/**
 * Port of `components/navbars.py`. The old app had a distinct navbar subclass per
 * service (Home/Ember/Preprints/Registries/Meetings/Institutions), each a flat list
 * of direct links. The current Angular app instead renders one persistent
 * `p-panelmenu` left sidebar (plus a top `osf-header` bar) shared across every
 * section, so this is a single class rather than a hierarchy - one `Navbar`
 * instance works regardless of which section's page you're on.
 *
 * IDs are carried over unchanged from the old markup (`home_header`,
 * `search_header`, `my-projects`, etc.), which is what made this a locator port
 * rather than a rewrite - verified live via `tests/_debug_inspect.spec.ts` per
 * `CLAUDE.md`'s "verify against the live DOM" rule.
 *
 * Some items (`registries_header`, `preprints_header`, `my-resources_header`,
 * `settings_header`) are dropdown parents now - clicking them only expands a
 * submenu instead of navigating directly like the old flat navbar did. The
 * `click*Link()` methods do the expand-then-select two-step; the plain locators
 * below are for the leaf items that still navigate on a single click.
 */
export class Navbar {
  constructor(protected readonly page: Page) {}

  get homeLink(): Locator {
    return this.page.locator('#home_header');
  }

  get searchLink(): Locator {
    return this.page.locator('#search_header');
  }

  /** Opens help.osf.io in a new tab - pair with `clickExpectingPopup`. */
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

  /**
   * The top header bar's "Sign in" button. The sidebar's `#sign-in_header` item
   * (a `role="button"` div, not a real `<button>`) leads to the same CAS login
   * page and shares the same accessible name - `getByRole` unscoped would match
   * both, so this is scoped to `osf-header` to get just the real button.
   * Matches how `HomeNavbar` and `RegistriesNavbar` mapped both `sign_in_button`
   * and `login_link` to the same `sign-in_header` id in the Python source; this is
   * the one used for both here too.
   */
  get signInButton(): Locator {
    return this.page.locator('osf-header').getByRole('button', { name: 'Sign in', exact: true });
  }

  /**
   * The current app has no "Sign Up" control in the persistent nav chrome itself -
   * it only exists as a CTA on the logged-out landing page's hero
   * (`LandingPage.getStartedButton`). Kept as a `getByRole` lookup here (rather than
   * dropped) so a "sign up button not present" check reads the same as the Python
   * original: assert this is absent while logged in.
   */
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

  /**
   * Clicking a dropdown-parent header (`registries_header`, `preprints_header`,
   * `my-resources_header`, `settings_header`) only *expands* its submenu - the
   * child item itself still needs a click to navigate. The header's own click
   * kicks off a PrimeNG collapsible transition, and while the child becomes
   * DOM-visible almost immediately, clicking it before the transition (and
   * whatever Angular wires up alongside it) has actually settled can silently
   * highlight the item as active (visibly selected) without the router actually
   * navigating - confirmed live: the item's `boundingBox()` was already stable
   * within ~100ms (so waiting for layout to settle isn't what's slow here), and
   * even a flat 800ms wait before the click only got this to navigate reliably
   * most of the time, not every time - repeated live runs put the residual flake
   * at roughly 1 in 5 for the worst case (My OSF -> My Preprints, straight after
   * the Preprints panel had itself just been auto-expanded for the active route).
   * Every caller of this method ends in a URL change, so retrying the click a
   * couple of times when the URL hasn't moved is a bounded, honest workaround for
   * that click-timing flake - not a loosened assertion, since a click that never
   * actually navigates still leaves the URL unchanged and the caller's assertion
   * fails for real.
   */
  private async expandAndClick(header: Locator, item: Locator): Promise<void> {
    const urlBeforeClick = this.page.url();
    await header.click();
    await item.waitFor({ state: 'visible' });
    await this.page.waitForTimeout(800);
    for (let attempt = 0; attempt < 3; attempt++) {
      await item.click();
      await this.page.waitForTimeout(500);
      if (this.page.url() !== urlBeforeClick) return;
    }
  }
}
