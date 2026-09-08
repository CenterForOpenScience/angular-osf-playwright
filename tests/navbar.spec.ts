import { Page } from '@playwright/test';

import * as settings from '../config/settings';
import { test, expect } from '../src/fixtures';
import { absent, clickExpectingPopup } from '../src/utils';
import { acceptCookies, LoginPage } from '../src/pages/LoginPage';
import { LandingPage } from '../src/pages/LandingPage';
import { SearchPage } from '../src/pages/SearchPage';
import { UserProfilePage } from '../src/pages/UserProfilePage';
import { ProfileInformationPage } from '../src/pages/UserPages';
import { Navbar } from '../src/pages/components/Navbar';
import {
  MeetingsPage,
  InstitutionsLandingPage,
  RegistriesLandingPage,
  PreprintLandingPage,
  NewPreprintsProviderServicePage,
  MyProjectsPage,
  MyRegistrationsPage,
  SupportPage,
} from '../src/pages/BrowsePages';


async function checkOsfHomeDropdownLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.homeLink.click();
  await LandingPage.expectOn(page);
}

async function checkPreprintsDropdownLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.clickPreprintsLink();
  await PreprintLandingPage.expectOn(page);
}

async function checkRegistriesDropdownLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.clickRegistriesLink();
  await RegistriesLandingPage.expectOn(page);
}

async function checkMeetingsDropdownLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.meetingsLink.click();
  await MeetingsPage.expectOn(page);
}

async function checkInstitutionsDropdownLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.institutionsLink.click();
  await InstitutionsLandingPage.expectOn(page);
}

async function checkDonateLink(page: Page, navbar: Navbar): Promise<void> {
  const popup = await clickExpectingPopup(page, navbar.donateLink);
  expect(popup.url()).toContain('support-cos');
}

async function checkSignInButton(page: Page, navbar: Navbar): Promise<void> {
  await navbar.signInButton.click();
  await LoginPage.expectOn(page);
}

async function checkUserDropdownNotPresent(navbar: Navbar): Promise<void> {
  expect(await absent(navbar.settingsHeader, settings.QUICK_TIMEOUT_MS)).toBe(true);
}


async function checkUserProfileMenuProfileLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.profileLink.click();
  await expect(new UserProfilePage(page).identity).toBeVisible();
}

async function checkUserProfileMenuSettingsLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.clickSettingsProfileLink();
  await ProfileInformationPage.expectOn(page);
}

async function checkSignInButtonNotPresent(navbar: Navbar): Promise<void> {
  expect(await absent(navbar.signInButton, settings.QUICK_TIMEOUT_MS)).toBe(true);
}


async function checkSignUpButtonNotPresent(navbar: Navbar): Promise<void> {
  expect(await absent(navbar.signUpButton, settings.QUICK_TIMEOUT_MS)).toBe(true);
}

async function checkLogoutLink(page: Page, navbar: Navbar): Promise<void> {
  await navbar.logoutLink.click();
  await LandingPage.expectOn(page);
}


test.describe('OSF Home Navbar - Logged Out', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, throttleOnProd }) => {
    void throttleOnProd;
    await page.goto(settings.OSF_HOME);
    await acceptCookies(page);
  });

  test('osf home dropdown link', async ({ page }) => {
    await checkOsfHomeDropdownLink(page, new Navbar(page));
  });

  test('preprints dropdown link', async ({ page }) => {
    await checkPreprintsDropdownLink(page, new Navbar(page));
  });

  test('registries dropdown link', async ({ page }) => {
    await checkRegistriesDropdownLink(page, new Navbar(page));
  });

  test('meetings dropdown link', async ({ page }) => {
    await checkMeetingsDropdownLink(page, new Navbar(page));
  });

  test('institutions dropdown link', async ({ page }) => {
    await checkInstitutionsDropdownLink(page, new Navbar(page));
  });

  test('donate link', async ({ page }) => {
    await checkDonateLink(page, new Navbar(page));
  });

  test('sign in button', async ({ page }) => {
    await checkSignInButton(page, new Navbar(page));
  });

  test('user dropdown not present', async ({ page }) => {
    await checkUserDropdownNotPresent(new Navbar(page));
  });

  test('my projects link not present', async ({ page }) => {
    expect(await absent(new Navbar(page).myProjectsItem, settings.QUICK_TIMEOUT_MS)).toBe(true);
  });

  test('search link', async ({ page }) => {
    await new Navbar(page).searchLink.click();
    await SearchPage.expectOn(page);
  });

  test('support link', async ({ page }) => {
    const popup = await clickExpectingPopup(page, new Navbar(page).supportLink);
    await expect(new SupportPage(popup).identity).toBeVisible();
  });
});


test.describe('OSF Home Navbar - Logged In', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, logInIfNotAlready, throttleOnProd }) => {
    void logInIfNotAlready;
    void throttleOnProd;
    await page.goto(`${settings.OSF_HOME}/dashboard`);
  });

  test('user profile menu profile link', async ({ page }) => {
    await checkUserProfileMenuProfileLink(page, new Navbar(page));
  });

  test('user profile menu settings link', async ({ page }) => {
    await checkUserProfileMenuSettingsLink(page, new Navbar(page));
  });

  test('sign in button not present', async ({ page }) => {
    await checkSignInButtonNotPresent(new Navbar(page));
  });

  test('sign up button not present', async ({ page }) => {
    await checkSignUpButtonNotPresent(new Navbar(page));
  });

  test('logout link', async ({ page }) => {
    await checkLogoutLink(page, new Navbar(page));
  });

  test('my projects link', async ({ page }) => {
    await new Navbar(page).clickMyProjectsLink();
    await MyProjectsPage.expectOn(page);
  });
});


test.describe('Preprints Navbar - Logged In', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, logInIfNotAlready, throttleOnProd }) => {
    void logInIfNotAlready;
    void throttleOnProd;
    await page.goto(`${settings.OSF_HOME}/preprints/discover`);
  });

  test('user profile menu profile link', async ({ page }) => {
    await checkUserProfileMenuProfileLink(page, new Navbar(page));
  });

  test('user profile menu settings link', async ({ page }) => {
    await checkUserProfileMenuSettingsLink(page, new Navbar(page));
  });

  test('sign in button not present', async ({ page }) => {
    await checkSignInButtonNotPresent(new Navbar(page));
  });

  test('sign up button not present', async ({ page }) => {
    await checkSignUpButtonNotPresent(new Navbar(page));
  });

  test('logout link', async ({ page }) => {
    await checkLogoutLink(page, new Navbar(page));
  });

  test('add a preprint link', async ({ page }) => {
    await new PreprintLandingPage(page).addAPreprintButton.click();
    await NewPreprintsProviderServicePage.expectOn(page);
  });


  test('my preprints link', async ({ page }) => {
    await new Navbar(page).clickMyPreprintsLink();
    expect(page.url()).toContain('/my-preprints');
  });
});


test.describe('Registries Navbar - Logged Out', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, throttleOnProd }) => {
    void throttleOnProd;
    await page.goto(`${settings.OSF_HOME}`);
    await acceptCookies(page);
  });

  test('osf home dropdown link', async ({ page }) => {
    await checkOsfHomeDropdownLink(page, new Navbar(page));
  });

  test('preprints dropdown link', async ({ page }) => {
    await checkPreprintsDropdownLink(page, new Navbar(page));
  });

  test('registries dropdown link', async ({ page }) => {
    await checkRegistriesDropdownLink(page, new Navbar(page));
  });

  test('meetings dropdown link', async ({ page }) => {
    await checkMeetingsDropdownLink(page, new Navbar(page));
  });

  test('institutions dropdown link', async ({ page }) => {
    await checkInstitutionsDropdownLink(page, new Navbar(page));
  });

  test('donate link', async ({ page }) => {
    await checkDonateLink(page, new Navbar(page));
  });

  test('user dropdown not present', async ({ page }) => {
    await checkUserDropdownNotPresent(new Navbar(page));
  });

  test('sign in button', async ({ page }) => {
    await checkSignInButton(page, new Navbar(page));
  });
});


test.describe('Registries Navbar - Logged In', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, logInIfNotAlready, throttleOnProd }) => {
    void logInIfNotAlready;
    void throttleOnProd;
    await page.goto(`${settings.OSF_HOME}/registries/discover`);
  });

  test('user profile menu profile link', async ({ page }) => {
    await checkUserProfileMenuProfileLink(page, new Navbar(page));
  });

  test('user profile menu settings link', async ({ page }) => {
    await checkUserProfileMenuSettingsLink(page, new Navbar(page));
  });

  test('sign in button not present', async ({ page }) => {
    await checkSignInButtonNotPresent(new Navbar(page));
  });

  test('sign up button not present', async ({ page }) => {
    await checkSignUpButtonNotPresent(new Navbar(page));
  });

  test('logout link', async ({ page }) => {
    await checkLogoutLink(page, new Navbar(page));
  });

  test('my registrations link', async ({ page }) => {
    await new Navbar(page).clickMyRegistrationsLink();
    await MyRegistrationsPage.expectOn(page);
  });
});


test.describe('Meetings Navbar - Logged In', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, logInIfNotAlready, throttleOnProd }) => {
    void logInIfNotAlready;
    void throttleOnProd;
    await page.goto(`${settings.OSF_HOME}/meetings`);
  });

  test('user profile menu profile link', async ({ page }) => {
    await checkUserProfileMenuProfileLink(page, new Navbar(page));
  });

  test('user profile menu settings link', async ({ page }) => {
    await checkUserProfileMenuSettingsLink(page, new Navbar(page));
  });

  test('sign in button not present', async ({ page }) => {
    await checkSignInButtonNotPresent(new Navbar(page));
  });

  test('sign up button not present', async ({ page }) => {
    await checkSignUpButtonNotPresent(new Navbar(page));
  });

  test('logout link', async ({ page }) => {
    await checkLogoutLink(page, new Navbar(page));
  });
});


test.describe('Institutions Navbar - Logged In', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, logInIfNotAlready, throttleOnProd }) => {
    void logInIfNotAlready;
    void throttleOnProd;
    await page.goto(`${settings.OSF_HOME}/institutions`);
  });

  test('user profile menu profile link', async ({ page }) => {
    await checkUserProfileMenuProfileLink(page, new Navbar(page));
  });

  test('user profile menu settings link', async ({ page }) => {
    await checkUserProfileMenuSettingsLink(page, new Navbar(page));
  });

  test('sign in button not present', async ({ page }) => {
    await checkSignInButtonNotPresent(new Navbar(page));
  });

  test('sign up button not present', async ({ page }) => {
    await checkSignUpButtonNotPresent(new Navbar(page));
  });

  test('logout link', async ({ page }) => {
    await checkLogoutLink(page, new Navbar(page));
  });
});


test.describe('Projects Navbar - Logged In', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ page, logInIfNotAlready, projectWithFile, throttleOnProd }) => {
    void logInIfNotAlready;
    void throttleOnProd;
    await page.goto(`${settings.OSF_HOME}/${projectWithFile.id}`);
  });

  test('search link', async ({ page }) => {
    await new Navbar(page).searchLink.click();
    await SearchPage.expectOn(page);
  });

  test('support link', async ({ page }) => {
    const popup = await clickExpectingPopup(page, new Navbar(page).supportLink);
    await expect(new SupportPage(popup).identity).toBeVisible();
  });

  test('donate link', async ({ page }) => {
    await checkDonateLink(page, new Navbar(page));
  });
});
