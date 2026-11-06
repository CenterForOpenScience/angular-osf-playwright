import { Page } from '@playwright/test';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import { BasePage } from '../src/pages/BasePage';
import { COSProductsPage, LandingPage } from '../src/pages/LandingPage';
import { PreprintPage } from '../src/pages/PreprintPage';
import { ProjectPage } from '../src/pages/ProjectPage';
import { RegisterPage } from '../src/pages/RegisterPage';
import { RegistrationPage } from '../src/pages/RegistrationPage';


const test = base.extend<{ landingPage: LandingPage }>({
  landingPage: async ({ page }, use) => {
    const landingPage = await new LandingPage(page).goto();
    await landingPage.verify();
    await use(landingPage);
  },
});

test.describe('Home Landing Page', { tag: '@smoke' }, () => {
  test('get started', { tag: '@core' }, async ({ page, landingPage }) => {
    await landingPage.getStartedButton.click();
    await RegisterPage.expectOn(page);
  });

  test('learn more', { tag: '@core' }, async ({ page, landingPage }) => {

    const [cosPage] = await Promise.all([
      page.context().waitForEvent('page'),
      landingPage.learnMoreButton.click(),
    ]);
    await COSProductsPage.expectOn(cosPage);
    await cosPage.close();
  });

  test('testimonials by buttons', async ({ landingPage }) => {
    // Verify that Testimonial 1 slide is initially visible
    await landingPage.testimonialButton(0).click();
    await expect(landingPage.testimonialSlide(0)).toBeVisible();

    // Click the button above the testimonial carousel to go to Testimonial 3
    await landingPage.testimonialButton(2).click();
    await expect(landingPage.testimonialSlide(2)).toBeVisible();
    await expect(landingPage.testimonialSlide(0)).toHaveCount(0);

    // Click the button above the testimonial carousel to go to Testimonial 2
    await landingPage.testimonialButton(1).click();
    await expect(landingPage.testimonialSlide(1)).toBeVisible();
    await expect(landingPage.testimonialSlide(2)).toHaveCount(0);

    // Click the button above the testimonial carousel to go to Testimonial 1
    await landingPage.testimonialButton(0).click();
    await expect(landingPage.testimonialSlide(0)).toBeVisible();
    await expect(landingPage.testimonialSlide(1)).toHaveCount(0);
  });
});

const POPULAR_PAGE_CLASSES: Record<string, new (page: Page) => BasePage> = {
  project: ProjectPage,
  preprint: PreprintPage,
  registration: RegistrationPage,
};

test.describe('Popular Pages', () => {
  /**
   * Checks that certain popular pages in OSF Production load correctly. The pages come
   * from the POPULAR_PAGES env var, each as `<type>:<guid>` where type is project,
   * preprint or registration (e.g. `project:abcde`). Every page is tried before the test
   * fails, and the failure lists all the pages that didn't load.
   */
  test('popular pages load', async ({ page }) => {
    test.skip(!settings.PRODUCTION, 'This test is only for the Two Minute Drill in Production');

    const failedList: string[] = [];
    for (const popularPage of settings.POPULAR_PAGES) {
      const [pageType, guid] = popularPage.split(':');
      const PageClass = POPULAR_PAGE_CLASSES[pageType];
      if (!PageClass || !guid) {
        failedList.push(`Not a valid object type - ${popularPage}`);
        continue;
      }
      try {
        await page.goto(`${settings.OSF_HOME}/${guid}`);
        await new PageClass(page).verify(settings.LONG_TIMEOUT_MS);
      } catch {
        failedList.push(popularPage);
      }
    }

    expect(failedList, `The following Pages Failed: ${failedList.join(', ')}`).toEqual([]);
  });
});
