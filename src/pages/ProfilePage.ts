import { Locator } from '@playwright/test';

import * as settings from '../../config/settings';
import { waitUntilPageReady } from '../utils';
import { SearchPage } from './SearchPage';

/**
 * Port of `pages/profile.py`'s `ProfilePage` - the signed-in user's own profile page
 * (`/profile/`, which redirects to their canonical `/<guid>/` profile). Extends
 * `SearchPage` rather than `BasePage` because the profile page renders the exact same
 * `osf-search-results-container` tabs/filters/results component the main search page
 * does - the `checkFilteringBy*`/tab-link getters ported there apply unchanged here,
 * so there is no need to re-implement or duplicate them (`tests/profile.spec.ts` uses
 * them directly against a page navigated to `/profile/` instead of `/search/`).
 */
export class ProfilePage extends SearchPage {
  get url(): string {
    return `${settings.OSF_HOME}/profile/`;
  }

  /** Port of `goto_short()` - navigates without asserting page structure. */
  async gotoShort(): Promise<this> {
    await this.page.goto(this.url);
    await waitUntilPageReady(this.page);
    return this;
  }

  get identity(): Locator {
    return this.page.locator('osf-profile-information');
  }

  get profileName(): Locator {
    return this.page.locator('osf-profile-information h1');
  }

  /**
   * `p.font-normal` (the original port of this locator) also matches unrelated
   * PrimeNG accordion-header paragraphs elsewhere on the page - verified live via
   * `tests/_debug_inspect.spec.ts` per `CLAUDE.md`'s "verify against the live DOM"
   * rule. The visible "Member since: ..." text is the actual unique, user-facing
   * anchor.
   */
  get profileCreatedDate(): Locator {
    return this.page.getByText(/Member since:/);
  }

  get profileLink(): Locator {
    return this.page.locator('a.dark-blue-two-link.font-bold');
  }

  get linkedInInput(): Locator {
    return this.page.getByPlaceholder('in/userID, profie/view?profileID, or pub/pubID');
  }

  async clickOnButton(buttonName: string): Promise<void> {
    await this.page.getByRole('button', { name: buttonName }).click();
  }

  async selectProfileTab(tabName: string): Promise<void> {
    await this.page.getByRole('tab', { name: tabName, exact: true }).click();
  }

  async sendSocialLinkInput(linkId: string, placeholderText: string): Promise<void> {
    await this.page.getByPlaceholder(placeholderText).fill(linkId);
  }

  /**
   * Port of `send_social_link_input_profile_id`. These five fields all share the same
   * `placeholder="profileID"` - the Python source disambiguates purely by DOM order,
   * preserved here via `.nth()`. `exact: true` is required: the Academia field further
   * down the form uses `placeholder="profileId"` (lowercase `d`), and Playwright's
   * `getByPlaceholder` substring-matches case-insensitively by default, which without
   * `exact` pulls that (and other false positives) into the match set - verified live
   * via `tests/_debug_inspect.spec.ts` per `CLAUDE.md`'s "verify against the live DOM"
   * rule.
   */
  async sendSocialLinkInputProfileId(linkName: string, linkId: string): Promise<void> {
    const indexByLinkName: Record<string, number> = {
      impactstory: 0,
      googlescholar: 1,
      researchgate: 2,
      baiduscholar: 3,
      ssrn: 4,
    };
    const index = indexByLinkName[linkName];
    if (index === undefined) return;
    await this.page.getByPlaceholder('profileID', { exact: true }).nth(index).fill(linkId);
  }

  /** Port of `get_social_link_logo`. Returns the logo `src` for a given social link, or `null` if not found. */
  async getSocialLinkLogo(socialLink: string): Promise<string | null> {
    const links = this.page.locator('a.cursor-pointer.custom-light-hover img');
    const stripSpaces = ['googlescholar', 'baiduscholar', 'yourwebsite'].includes(socialLink);
    const count = await links.count();
    for (let i = 0; i < count; i += 1) {
      const altRaw = (await links.nth(i).getAttribute('alt')) ?? '';
      const linkName = stripSpaces ? altRaw.replace(/ /g, '') : altRaw;
      if (linkName.trim().toLowerCase() === socialLink) {
        return links.nth(i).getAttribute('src');
      }
    }
    return null;
  }

  /**
   * Port of `click_on_save_button`. The Python source disambiguates the four
   * (Name/Social/Employment/Education) "Save" buttons by index into raw DOM order,
   * because Selenium's `find_elements` sees every one of them regardless of which
   * tab is active. `getByRole('button', ...)` only considers elements exposed to the
   * accessibility tree, which - verified live via `tests/_debug_inspect.spec.ts` -
   * already excludes the inactive tabs' buttons, leaving just the one for whichever
   * tab is currently selected. No index needed; `tabName` is kept for call-site
   * clarity/parity with the Python signature.
   */
  async clickOnSaveButton(tabName: 'Name' | 'Social' | 'Employment' | 'Education'): Promise<void> {
    void tabName;
    // Save re-routes the SPA to `/settings/profile?tab=N` on success rather than
    // reloading, so `waitUntilPageReady`'s readyState/spinner checks alone don't
    // reliably observe it finishing - verified live via `tests/_debug_inspect.spec.ts`
    // that navigating away immediately after the click can race the PATCH and read
    // back stale data. Wait for the PATCH itself instead.
    await Promise.all([
      this.page.waitForResponse(
        (response) =>
          /\/v2\/users\/[^/]+\/$/.test(response.url()) && response.request().method() === 'PATCH'
      ),
      this.page.getByRole('button', { name: 'Save' }).click(),
    ]);
  }
}
