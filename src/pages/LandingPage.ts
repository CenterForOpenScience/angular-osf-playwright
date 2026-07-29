import { Locator } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';

export class LandingPage extends BasePage {
  get url(): string {
    return settings.OSF_HOME;
  }

  get identity(): Locator {
    return this.page.locator('section.home-container.flex.flex-column');
  }

  get getStartedButton(): Locator {
    return this.page.locator('button', { hasText: 'Sign Up' });
  }

  get learnMoreButton(): Locator {
    return this.page.getByRole('link', { name: 'Learn More', exact: true });
  }

  get carouselButtons(): Locator {
    return this.page.locator('[class="p-carousel-indicator-button"]');
  }

  get testimonial1Slide(): Locator {
    return this.page.locator('div.p-carousel-item[aria-label="0"]');
  }

  get testimonial2Slide(): Locator {
    return this.page.locator('div.p-carousel-item[aria-label="1"]');
  }

  get testimonial3Slide(): Locator {
    return this.page.locator('div.p-carousel-item[aria-label="2"]');
  }
}
