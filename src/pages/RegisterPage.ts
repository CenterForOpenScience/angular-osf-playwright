import { FrameLocator, Locator } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';

/**
 * Port of `pages/register.py` `RegisterPage` plus `components/generic.py` `SignUpForm`.
 * The form lives directly in `osf-sign-up`, and every field's `<label>` is `for=`-linked
 * to its input, so the fields are located by label instead of placeholder/XPath.
 */
export class RegisterPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/register`;
  }

  get identity(): Locator {
    return this.page.locator('osf-sign-up');
  }

  get nameInput(): Locator {
    return this.page.getByLabel('Full Name', { exact: true });
  }

  get givenNameInput(): Locator {
    return this.page.getByLabel('Given Name', { exact: true });
  }

  get familyNameInput(): Locator {
    return this.page.getByLabel('Family Name', { exact: true });
  }

  get emailOneInput(): Locator {
    return this.page.getByLabel('Email', { exact: true });
  }

  get emailTwoInput(): Locator {
    return this.page.getByLabel('Confirm email', { exact: true });
  }

  get passwordInput(): Locator {
    return this.page.getByLabel('Password', { exact: true });
  }

  get termsOfServiceCheckbox(): Locator {
    return this.page.getByRole('checkbox', { name: /I agree to the Terms of Use/ });
  }

  get signUpButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign Up', exact: true });
  }

  get registrationSuccess(): Locator {
    return this.page.getByRole('heading', { name: 'Registration successful' });
  }

  private get recaptchaFrame(): FrameLocator {
    return this.page.frameLocator('iframe[title="reCAPTCHA"]');
  }

  get recaptchaCheckbox(): Locator {
    return this.recaptchaFrame.getByRole('checkbox', { name: "I'm not a robot" });
  }

  /** Port of `SignUpForm.click_recaptcha`: only click it if it isn't already checked. */
  async clickRecaptcha(): Promise<void> {
    if ((await this.recaptchaCheckbox.getAttribute('aria-checked')) === 'false') {
      await this.recaptchaCheckbox.click();
    }
  }
}
