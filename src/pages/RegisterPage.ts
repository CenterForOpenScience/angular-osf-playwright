import { Locator } from '@playwright/test';

import * as settings from '../../config/settings';
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  get url(): string {
    return `${settings.OSF_HOME}/register`;
  }

  get identity(): Locator {
    return this.page.locator('osf-sign-up');
  }
}
