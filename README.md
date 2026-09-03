# angular-osf-playwright
Playwright testing for angular-osf

# COD Playwright

Playwright/TypeScript migration of the OSF Selenium (pytest) test suite. This is
**stage 1** of the migration: project scaffolding, multi-environment/multi-browser
execution, and a full port of `test_login.py` plus the fixtures and API calls it
(and the wider `conftest.py`) depend on.

## Setup

```bash
npm install
npx playwright install
cp .env.example .env   # then fill in credentials
```

## Running tests

Environment is selected via `TEST_ENV` (mirrors the old `settings.DOMAIN`), browser
via Playwright's `--project` flag.

| Old (pytest/Selenium)                  | New (Playwright)                              |
|-----------------------------------------|------------------------------------------------|
| `DOMAIN=test4 pytest tests/test_login.py` | `npm run test:test4` / `TEST_ENV=test4 npx playwright test` |
| `DRIVER=Firefox pytest ...`             | `npm run test:firefox` / `npx playwright test --project=firefox` |

```bash
# Environment shortcuts
npm run test:test        # TEST_ENV=test
npm run test:test4       # TEST_ENV=test4
npm run test:stage1      # TEST_ENV=stage1 (staging.osf.io)
npm run test:stage2
npm run test:stage3      # default when TEST_ENV is unset
npm run test:stage4
npm run test:prod

# Browser shortcuts
npm run test:chromium
npm run test:firefox
npm run test:edge
npm run test:all-browsers

# Combine env + browser directly
TEST_ENV=test4 npx playwright test --project=firefox

# Just the login suite
npm run test:login

# View the HTML report after a run
npm run report

# Force trace recording for this run, regardless of the config's trace setting (view after with `npm run report` or `npx playwright show-trace`)
npx playwright test --project=chromium --trace on  

# Interactive UI mode (watch/run tests with timeline, DOM, network, console)
npx playwright test --ui

```

Tests are tagged the same way the old suite used pytest markers:
`@smoke` (was `smoke_test`), `@core` (was `core_functionality`). Filter with:

```bash
npx playwright test --grep @smoke
```

`dont_run_on_prod` is ported as a conditional `test.skip(settings.PRODUCTION, ...)`
inside a `beforeEach`, so those tests show as *skipped* (not absent) when run
against `TEST_ENV=prod`.

## Project layout

```
config/
  environments.ts   # domain map (stage1-4, test, test4, prod) - port of the `domains` dict in settings.py
  settings.ts        # env-var driven settings - port of settings.py
src/
  api/
    session.ts        # thin JSON:API wrapper around Playwright's APIRequestContext
    osfApi.ts          # port of the api/osf_api.py functions the fixtures below need
  pages/
    BasePage.ts        # port of pages/base.py (Playwright locators auto-wait, so
                        # base/locators.py's WebElementWrapper/Locator machinery isn't needed)
    LoginPage.ts        # LoginPage, Login2FAPage, LoginToSPage, InstitutionalLoginPage,
                        # generic institution login pages, ForgotPasswordPage,
                        # UnsupportedInstitutionLoginPage, GenericCASPage,
                        # CASAuthorizationPage, and the old_login/login/safe_login*/
                        # accept_cookies/logout helper functions
    LandingPage.ts
    RegisterPage.ts
  fixtures/
    index.ts           # port of tests/conftest.py fixtures via Playwright's test.extend
  utils/
    index.ts           # port of the utils.py helpers the above depend on
tests/
  login.spec.ts         # port of tests/test_login.py
  user.spec.ts          # port of tests/test_user.py
  search.spec.ts        # port of tests/test_search.py
  navbar.spec.ts        # port of tests/test_navbar.py
```

## Migration status

Sections mirror the checklist in the Selenium repo's `PLAYWRIGHT_MIGRATION_RULES.md`
(`C:\PyCharmProjects\OSF\osf-selenium-tests-develop`). When a section lands here,
tick it in **both** files.

| # | Section | Source (Selenium) | Spec here | Status |
|---|---------|-------------------|-----------|--------|
| 1 | Login | `tests/test_login.py` | `tests/login.spec.ts` | [x] Migrated |
| 2 | User settings | `tests/test_user.py` | `tests/user.spec.ts` | [x] Migrated |
| 3 | Profile | `tests/test_profile.py` | — | [ ] Not migrated |
| 4 | Search | `tests/test_search.py` | `tests/search.spec.ts` | [x] Migrated |
| 5 | Navbar | `tests/test_navbar.py` | `tests/navbar.spec.ts` | [x] Migrated |
| 6 | Dashboard | `tests/test_dashboard.py` | — | [ ] Not migrated |
| 7 | Collections | `tests/test_collections.py` | — | [ ] Not migrated |
| 8 | Registration sidebar | `tests/test_registration_sidebar.py` | — | [ ] Not migrated |
| 9 | Preprints | `tests/test_preprints.py` | — | [ ] Not migrated |
| 10 | Metadata | `tests/test_metadata.py` | — | [ ] Not migrated |
| 11 | Institutions | `tests/test_institutions.py` | — | [ ] Not migrated |
| 12 | My projects | `tests/test_my_projects.py` | — | [ ] Not migrated |
| 13 | My registrations | `tests/test_my_registrations.py` | — | [ ] Not migrated |
| 14 | My preprints | `tests/test_my_preprints.py` | — | [ ] Not migrated |
| 15 | Registration moderation | `tests/test_registration_moderation.py` | — | [ ] Not migrated |
| 16 | Registration user permissions | `tests/test_registration_user_permissions.py` | — | [ ] Not migrated |
| 17 | Registries | `tests/test_registries.py` | — | [ ] Not migrated |

Progress: **4 / 17** sections migrated.

## Notable differences from the Python suite

- **Cross-browser** is a Playwright `project` (`chromium`/`firefox`/`edge`) instead
  of Selenium `DRIVER`/BrowserStack config. BrowserStack/Remote execution was not
  ported in this stage - only local chromium/firefox/msedge.
- **`driver` fixture** is replaced by Playwright's built-in `page` fixture; there's
  no `launch_driver()` equivalent to maintain.
- **Locator waiting**: Playwright locators auto-wait, so page objects expose plain
  `Locator` getters instead of the custom `Locator`/`WebElementWrapper` wait logic
  from `base/locators.py`.
- **`check_credentials`** used to call `pytest.exit()` to abort the whole run on bad
  credentials; here it throws inside a fixture, which fails the current test with a
  clear message instead of aborting the whole run.
- **`login()` / `safe_login()` / `safe_login_short()`** had converged on an
  identical implementation in the Python source (with `login()`'s extra initial
  `goto()` being a redundant double-navigation) - consolidated into one
  implementation, re-exported under all three names.
- **`defaultProjectPage`** fixture returns a minimal `{ page, guid }` stub rather
  than a full `ProjectPage` port - `pages/project.py` (~1600 lines) is a separate,
  much larger page object out of scope for this login-suite stage.
- **OAuth API tests** (`OauthAPI` class in the original) are ported but skipped:
  that class was never actually collected by pytest (its name didn't start with
  `Test`, so it fell outside pytest's default `python_classes` pattern) - it's been
  dormant in the existing suite. Ported for parity, left skipped since it exercises
  real token issuance/revocation.
- Only the fixtures and `api/osf_api.py` functions that `conftest.py`'s fixtures
  actually call have been ported; the rest of `osf_api.py` (~2600 lines total)
  covers pages/tests well outside this stage's scope.
- **Navbar**: the old app had a distinct navbar subclass per service
  (`HomeNavbar`/`EmberNavbar`/`PreprintsNavbar`/`RegistriesNavbar`/etc. in
  `components/navbars.py`), each a flat list of direct links. The current app
  renders one persistent left sidenav shared across every section instead, so
  `src/pages/components/Navbar.ts` is a single class rather than a hierarchy.
  Some items (Registries, Preprints, My OSF, Settings) are dropdown parents now -
  clicking them only expands a submenu, so reaching e.g. Preprints Discover is a
  two-step expand-then-select instead of one direct link click. `test_navbar.py`'s
  `NavbarTestLoggedOutMixin`/`NavbarTestLoggedInMixin` are ported as plain shared
  functions called from each `test.describe` block, since Playwright has no
  class-inheritance equivalent. See `CLAUDE.md`'s "Known-flaky backend endpoints"
  section for a residual click-timing flake on the dropdown items.

## Next steps
