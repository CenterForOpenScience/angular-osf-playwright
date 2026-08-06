import { Page, Locator } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';

/** Port of `pages/login.py`. */
export class LoginPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/login`;
  }

  get identity(): Locator {
    return this.page.locator('#loginForm');
  }

  get usernameInput(): Locator {
    return this.page.locator('#username');
  }

  get passwordInput(): Locator {
    return this.page.locator('#password');
  }

  get loginErrorMessage(): Locator {
    return this.page.locator('.login-error-inline');
  }

  get submitButton(): Locator {
    return this.page.locator('[name="submit"]');
  }

  get rememberMeCheckbox(): Locator {
    return this.page.locator('#rememberMe');
  }

  get institutionalLoginButton(): Locator {
    return this.page.locator('#instnLogin');
  }

  get institutionSelectDropdown(): Locator {
    return this.page.locator('#institutionSelect');
  }

  get orcidLoginButton(): Locator {
    return this.page.locator('#orcidlogin');
  }

  get osfHomeLink(): Locator {
    return this.page.locator(
      'xpath=(//a[@class="navbar-link" and normalize-space(.)="Home"])[2]'
    );
  }

  get signUpButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign Up', exact: true });
  }

  get resetPasswordLink(): Locator {
    return this.page.getByRole('link', { name: 'Reset password', exact: true });
  }

  get needHelpLink(): Locator {
    return this.page.getByRole('link', { name: 'Need help signing in?', exact: true });
  }

  get cosFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Center for Open Science', exact: true });
  }

  get termsOfUseFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Terms of Use', exact: true });
  }

  get privacyPolicyFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Privacy Policy', exact: true });
  }

  get statusFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Status', exact: true });
  }

  get signInButton(): Locator {
    return this.page.locator('#sign-in_header');
  }

  get acceptCookiesButton(): Locator {
    return this.page.locator(
      'xpath=//button[.//span[normalize-space(text())="Accept cookies"]]'
    );
  }

  async selectInstitutionLogin(): Promise<void> {
    await this.institutionalLoginButton.click();
    await this.institutionSelectDropdown.click();
    //await this.page.locator('#institutionSelect option').first().waitFor();
  }

  async submitLogin(user: string, password: string): Promise<void> {
    await this.usernameInput.fill(user);
    await this.passwordInput.fill(password);
    if (await this.rememberMeCheckbox.isChecked()) {
      await this.rememberMeCheckbox.click();
    }
    await this.submitButton.click();
  }

  async submitLoginShort(user: string, password: string): Promise<void> {
    await this.usernameInput.fill(user);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

export class Login2FAPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('#totploginForm');
  }

  get usernameInput(): Locator {
    return this.page.locator('#username');
  }

  get oneTimePasswordInput(): Locator {
    return this.page.locator('#oneTimePassword');
  }

  get loginErrorMessage(): Locator {
    return this.page.locator('.login-error-inline');
  }

  get verifyButton(): Locator {
    return this.page.locator('[name="submit"]');
  }

  get cancelLink(): Locator {
    return this.page.getByRole('link', { name: 'Cancel', exact: true });
  }

  get needHelpLink(): Locator {
    return this.page.getByRole('link', { name: 'Need help signing in?', exact: true });
  }
}

export class LoginToSPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('#tosloginForm');
  }

  get termsOfUseLink(): Locator {
    return this.identity.getByRole('link', { name: 'Terms of Use', exact: true });
  }

  get privacyPolicyLink(): Locator {
    return this.identity.getByRole('link', { name: 'Privacy Policy', exact: true });
  }

  get tosCheckbox(): Locator {
    return this.page.locator('#termsOfServiceChecked');
  }

  get continueButton(): Locator {
    return this.page.locator('#primarySubmitButton');
  }

  get cancelLink(): Locator {
    return this.page.getByRole('link', { name: 'Cancel and go back to OSF', exact: true });
  }
}

export class InstitutionalLoginPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/login?campaign=institution`;
  }

  get identity(): Locator {
    return this.page.locator('#institutionSelect');
  }

  get institutionDropdown(): Locator {
    return this.page.locator('#institutionSelect');
  }

  get signInButton(): Locator {
    return this.page.locator('#sign-in_header');
  }

  get signInButtonInstitutions(): Locator {
    return this.page.locator('#institutionSubmit');
  }

  get osfHomeLink(): Locator {
    return this.page.locator(
      'xpath=(//a[@class="navbar-link" and normalize-space(.)="Home"])[2]'
    );
  }

  get signUpButton(): Locator {
    return this.page.locator('button.p-ripple.p-button.p-component.p-button-success');
  }

  get cantFindInstitutionLink(): Locator {
    return this.page.getByRole('link', { name: "I can't find my institution", exact: true });
  }

  get needHelpLink(): Locator {
    return this.page.getByRole('link', { name: 'Need help signing in?', exact: true });
  }

  get signInWithOsfLink(): Locator {
    return this.page.getByRole('link', { name: 'Sign in with your OSF account', exact: true });
  }

  get cosFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Center for Open Science', exact: true });
  }

  get termsOfUseFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Terms of Use', exact: true });
  }

  get privacyPolicyFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Privacy Policy', exact: true });
  }

  get statusFooterLink(): Locator {
    return this.page.getByRole('link', { name: 'Status', exact: true });
  }

  get dropdownOptions(): Locator {
    return this.page.locator('#institutionSelect option');
  }
}

export class GenericInstitutionLoginPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('input[type="password"]');
  }
}

export class GenericInstitutionEmailLoginPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('input[type="email"]');
  }
}

export class GenericInstitutionUsernameLoginPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('form[method="post"]');
  }
}

export class GenericInstitutionIDLoginPage extends BasePage {
  get identity(): Locator {
    return this.page.locator('input[autocomplete="username"]');
  }
}

export class ForgotPasswordPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/forgotpassword/`;
  }

  get identity(): Locator {
    return this.page.locator('osf-forgot-password');
  }
}

export class UnsupportedInstitutionLoginPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/login?campaign=unsupportedinstitution`;
  }

  get identity(): Locator {
    return this.page.locator('#osfUnsupportedInstitutionLogin');
  }
}

export class GenericCASPage extends BasePage {
  get url(): string {
    return settings.CAS_DOMAIN;
  }

  get identity(): Locator {
    return this.page.locator('.login-error-card');
  }

  get navbarBrand(): Locator {
    return this.page.locator('.cas-brand-text');
  }

  get autoRedirectMessage(): Locator {
    return this.page.locator(
      '#content > div > section > section.text-without-mdi.text-center.text-bold.text-large.margin-large-vertical.title'
    );
  }

  get statusMessage(): Locator {
    return this.page.locator('#content > div > section > section.card-message > h1');
  }

  get errorDetail(): Locator {
    return this.page.locator('#content > div > section > section.card-message > pre');
  }
}

export class CASAuthorizationPage extends BasePage {
  get url(): string {
    return `${settings.CAS_DOMAIN}/oauth2/authorize`;
  }

  get identity(): Locator {
    return this.page.locator('.login-section');
  }

  get navbarBrand(): Locator {
    return this.page.locator('.cas-brand-text');
  }

  get statusMessage(): Locator {
    return this.page.locator('#content > div > section > section.card-message > h1');
  }

  get allowButton(): Locator {
    return this.page.locator('#allow');
  }

  get denyButton(): Locator {
    return this.page.locator('#deny');
  }
}

/** Port of `old_login()`: click the header sign-in button (if present) then submit. */
export async function oldLogin(
  page: Page,
  user: string = settings.USER_ONE,
  password: string = settings.USER_ONE_PASSWORD
): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.signInButton.click({ timeout: 2000 }).catch(() => undefined);
  await loginPage.submitLogin(user, password);
}

/**
 * Port of `login()` / `safe_login()` / `safe_login_short()`. In the original these
 * three functions had converged on an identical implementation (safe_login and
 * safe_login_short were byte-for-byte the same, and `login`'s extra initial
 * `goto()` call was a redundant no-op double navigation), so they're consolidated
 * into one implementation here and re-exported under their original names since
 * conftest.py and test_login.py reference all three.
 */
async function performLogin(
  page: Page,
  user: string,
  password: string
): Promise<void> {
  await page.goto(`${settings.OSF_HOME}/login`);

  const loginPage = new LoginPage(page);
  await loginPage.submitLoginShort(user, password);
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
}

export async function login(
  page: Page,
  user: string = settings.USER_ONE,
  password: string = settings.USER_ONE_PASSWORD
): Promise<void> {
  await performLogin(page, user, password);
}

export async function safeLogin(
  page: Page,
  user: string = settings.USER_ONE,
  password: string = settings.USER_ONE_PASSWORD
): Promise<void> {
  await performLogin(page, user, password);
}

export async function safeLoginShort(
  page: Page,
  user: string = settings.USER_ONE,
  password: string = settings.USER_ONE_PASSWORD
): Promise<void> {
  await performLogin(page, user, password);
}

export async function acceptCookies(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: 'Accept cookies', exact: true })
    .click({ timeout: 5000 })
    .catch(() => undefined);
}

export async function logout(page: Page): Promise<void> {
  await page.goto(`${settings.OSF_HOME}/logout/`);
}
