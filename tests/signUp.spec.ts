import { randomUUID } from 'crypto';

import { Faker } from '@faker-js/faker';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import { RegisterPage } from '../src/pages/RegisterPage';

/**
 * Port of `tests/test_sign_up_user.py`. The only collected test is
 * `TestRegisterPage::test_create_user`, which comes from `tests/generic.py`'s
 * `CreateUserMixin`.
 */

const test = base.extend<{ registerPage: RegisterPage }>({
  registerPage: async ({ page }, use) => {
    await use(await new RegisterPage(page).goto());
  },
});

/**
 * Port of `fake.password(length=8, special_chars=True, digits=True, upper_case=True,
 * lower_case=True)`: 8 characters with at least one of each class, as the sign-up form
 * requires.
 */
function generatePassword(fake: Faker): string {
  const required = [
    fake.string.alpha({ length: 1, casing: 'upper' }),
    fake.string.alpha({ length: 1, casing: 'lower' }),
    fake.string.numeric(1),
    fake.helpers.arrayElement([...'!@#$%^&*()_+']),
  ];
  const rest = fake.string.alphanumeric({ length: 4 }).split('');
  return fake.helpers.shuffle([...required, ...rest]).join('');
}

test.describe('Register Page', () => {
  test('create user', async ({ registerPage, fake }) => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
    test.skip(settings.TEST, 'There is a real recapcha on test. Robots cannot create users there.');

    const uniqueId = randomUUID().slice(0, 8);
    const name = fake.person.fullName();
    // Add name with no spaces to end of email
    const email = settings.NEW_USER_EMAIL.replace('{}', name.replace(/\s+/g, '') + uniqueId);
    const password = generatePassword(fake);

    await registerPage.nameInput.fill(name);
    await registerPage.givenNameInput.fill('Given NameTest');
    await registerPage.familyNameInput.fill('Family NameTest');
    await registerPage.emailOneInput.fill(email);
    await registerPage.emailTwoInput.fill(email);
    await registerPage.passwordInput.fill(password);
    await registerPage.termsOfServiceCheckbox.check();
    await registerPage.clickRecaptcha();
    await registerPage.signUpButton.click();
    await expect(registerPage.registrationSuccess).toBeVisible({ timeout: settings.LONG_TIMEOUT_MS });
  });
});
