import { Locator } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';

export class LandingPage extends BasePage {
  get url(): string {
    return settings.OSF_HOME;
  }

  get identity(): Locator {
    return this.page.locator('osf-home');
  }

  get getStartedButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign Up', exact: true });
  }

  /** Opens the COS product page (cos.io) in a new tab - pair with `waitForPopup`. */
  get learnMoreButton(): Locator {
    return this.page.getByRole('link', { name: 'Learn More', exact: true });
  }

  /**
   * The "What Others Are Saying" testimonials carousel. The home page has a second
   * carousel (OSF integrations), whose indicator buttons and slides use the same
   * labels, so everything below is scoped to this one.
   */
  get testimonialsCarousel(): Locator {
    return this.page
      .locator('section')
      .filter({ has: this.page.getByRole('heading', { name: 'What Others Are Saying' }) })
      .getByRole('region');
  }

  /** Indicator button above slide `index` (0-based). Its accessible name is 1-based. */
  testimonialButton(index: number): Locator {
    return this.testimonialsCarousel.getByRole('button', { name: String(index + 1), exact: true });
  }

  /**
   * Testimonial slide `index` (0-based, its `aria-label`), matched only while it is the
   * current slide: PrimeNG sets `aria-hidden="true"` on the others, which drops them
   * from the accessibility tree, and its cloned edge slides have no `group` role.
   */
  testimonialSlide(index: number): Locator {
    return this.testimonialsCarousel.getByRole('group', { name: String(index), exact: true });
  }
}

/** Port of `COSProductsPage` - the OSF product page on cos.io. */
export class COSProductsPage extends BasePage {
  get identity(): Locator {
    return this.page.getByRole('link', { name: 'Take me to OSF' });
  }
}
