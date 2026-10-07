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
npm run test:test2       # TEST_ENV=test2
npm run test:test3       # TEST_ENV=test3
npm run test:test4       # TEST_ENV=test4
npm run test:stage1      # TEST_ENV=stage1 (staging.osf.io)
npm run test:stage2
npm run test:stage3      # default when TEST_ENV is unset
npm run test:stage4
npm run test:uat1        # TEST_ENV=uat1 (uat1.osf.io)
npm run test:prod

# Browser shortcuts
npm run test:chromium
npm run test:firefox
npm run test:edge
npm run test:webkit    # Safari engine (WebKit) - real Safari automation only exists on macOS
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
  environments.ts   # domain map (stage1-4, test, test2, test3, test4, uat1, prod) - port of the `domains` dict in settings.py
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
    searchCards.ts     # search-result card validators shared by profile/institutions specs
tests/
  login.spec.ts         # port of tests/test_login.py
  user.spec.ts          # port of tests/test_user.py
  profile.spec.ts       # port of tests/test_profile.py
  search.spec.ts        # port of tests/test_search.py
  navbar.spec.ts        # port of tests/test_navbar.py
  registrationSidebar.spec.ts  # port of tests/test_registration_sidebar.py
  registrationMetadata.spec.ts # port of tests/test_registration_metadata.py
  institutions.spec.ts  # port of tests/test_institutions.py
```

## Migration status

Sections mirror the checklist in the Selenium repo's `PLAYWRIGHT_MIGRATION_RULES.md`
(`C:\PyCharmProjects\OSF\osf-selenium-tests-develop`). When a section lands here,
tick it in **both** files.

| # | Section | Source (Selenium) | Spec here | Status |
|---|---------|-------------------|-----------|--------|
| 1 | Login | `tests/test_login.py` | `tests/login.spec.ts` | [x] Migrated |
| 2 | User settings | `tests/test_user.py` | `tests/user.spec.ts` | [x] Migrated |
| 3 | Profile | `tests/test_profile.py` | `tests/profile.spec.ts` | [x] Migrated |
| 4 | Search | `tests/test_search.py` | `tests/search.spec.ts` | [x] Migrated |
| 5 | Navbar | `tests/test_navbar.py` | `tests/navbar.spec.ts` | [x] Migrated |
| 6 | Dashboard | `tests/test_dashboard.py` | — | [ ] Not migrated |
| 7 | Collections | `tests/test_collections.py` | — | [ ] Not migrated |
| 8 | Registration sidebar | `tests/test_registration_sidebar.py` | `tests/registrationSidebar.spec.ts` | [x] Migrated |
| 9 | Preprints | `tests/test_preprints.py` | — | [ ] Not migrated |
| 10 | Metadata | `tests/test_registration_metadata.py` | `tests/registrationMetadata.spec.ts` | [x] Migrated |
| 11 | Institutions | `tests/test_institutions.py` | `tests/institutions.spec.ts` | [x] Migrated |
| 12 | My projects | `tests/test_my_projects.py` | — | [ ] Not migrated |
| 13 | My registrations | `tests/test_my_registrations.py` | — | [ ] Not migrated |
| 14 | My preprints | `tests/test_my_preprints.py` | — | [ ] Not migrated |
| 15 | Registration moderation | `tests/test_registration_moderation.py` | — | [ ] Not migrated |
| 16 | Registration user permissions | `tests/test_registration_user_permissions.py` | — | [ ] Not migrated |
| 17 | Registries | `tests/test_registries.py` | — | [ ] Not migrated |

Progress: **8 / 17** sections migrated.

## Notable differences from the Python suite

- **Cross-browser** is a Playwright `project` (`chromium`/`firefox`/`edge`/`webkit`)
  instead of Selenium `DRIVER`/BrowserStack config. BrowserStack/Remote execution was
  not ported in this stage - only local chromium/firefox/msedge/webkit. `webkit` is
  Playwright's own WebKit engine (a Safari stand-in), not real Safari - real Safari
  automation only runs on macOS.
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
- **Profile**: `pages/profile.py`'s `ProfilePage` (tab/filter/sort checks reused from
  `search.spec.ts`'s port of `pages/search.py`) and `SearchPageHelpers` are two
  separate Python objects bound to the same `driver`; since `SearchPage.ts` already
  carries all the `checkFilteringBy*`/tab-link locators, `src/pages/ProfilePage.ts`
  just extends it instead of re-implementing or duplicating them, so one
  `ProfilePage` instance covers both roles. `tests/test_profile.py`'s own
  `_validate_project_card`/etc. module-local helpers (near-identical to
  `search.spec.ts`'s `verify*SearchCard` functions) now live in
  `src/utils/searchCards.ts`, shared with `tests/institutions.spec.ts` (see
  Institutions below); `search.spec.ts` keeps its own copies.
- **Registration sidebar**: `RegistrationPage.ts` (already used by `search.spec.ts` as
  a scoped port of the overview page) is extended in place with the rest of
  `pages/registries.py`/`components/registration.py` this section needs, rather than
  duplicated into a new type - `search.spec.ts`'s existing fields are untouched.
  Metadata/Files/Components/Links/Analytics page objects stay identity-only, since
  `test_registration_sidebar.py` only ever navigates to them and checks `identity` -
  their fuller Python page objects (metadata editing, file browsing, etc.) are out of
  scope here. Two Python dead-code bugs were fixed rather than carried over (matching
  the Section 3 precedent above): `get_authors_list`/`get_affiliations_list` `return`
  from inside their loop in Python, so they only ever yielded the first item -
  `getAuthorsList`/`getAffiliationsList` here return the full list; and
  `RegistrationContributorsPage`'s Python `identity` locator passes an XPath string to
  a CSS `By.CSS_SELECTOR` (never actually matches) - ported as `osf-contributors`
  instead. `test_delete_resource`'s Python assertion also checked for a *lowercased*
  `<h2>` that could never match real markup (an always-true assertion) - ported as a
  real check against the actual (capitalized) resource-type heading. Several
  since-fixed timing races surfaced only under real load and are documented inline
  where fixed: the contributors table, VOL table, and overview license/authors sections
  all render asynchronously after their page's `identity` mounts; the contributors
  search box filters with a debounce (up to ~2s) rather than instantly; and VOL/resource
  delete confirmations are PrimeNG's `p-confirmdialog` (`.p-confirmdialog-accept-button`),
  not the `p-dialog` the Add Contributor/Create VOL modals use.
- **Registration metadata**: ports `TestRegistrationMetadata` (14 tests) - the only
  live class in `test_registration_metadata.py`; `TestFilesMetadata`/`TestProjectMetadata`
  are fully commented out in the Python source and weren't ported. The metadata page's
  cards are each their own Angular component (`osf-metadata-title`,
  `osf-metadata-contributors`, ...) and every Edit opens a named `p-dialog`, so
  `RegistrationMetadataPage` scopes by those instead of the Python `//div[h2[...]]`
  XPaths. The add/remove pairs (contributors, affiliations, subjects, tags) still rely on
  file order against one shared fixture registration, like the Python class. Changes
  from the Python source, all verified live:
  - The Edit contributors dialog's search box doesn't filter the table, so Python's
    `user_permission`/`remove_button` silently acted on the *first* row (the admin
    owner). Rows are now located by contributor name.
  - `remove contributors` only checked the Contributors card, which lists bibliographic
    contributors only - and the previous test already made that user non-bibliographic,
    so the assertion was always true. It now also checks the API contributor list.
  - The API refuses to leave a registration with zero subjects (400, "Registration must
    have at least one subject to be registered"), so with `Business` as the fixture's
    only subject the add/remove subject pair was stuck. `add top level subject` now
    resets the subjects to `Engineering` via the API first
    (`osfApi.updateRegistrationSubjects`).
  - The Resource language select's filter box always shows "No results found"
    (`filterBy="label"` on options that only have `name`/`code`), which looks like an
    app bug. The test scrolls the virtual-scrolled list to the option instead
    (`selectFromVirtualScrollList`).
  - Removing the only funder entry closes the Funding dialog - Python's reopen step is
    kept, with an explicit wait for the dialog to close first.
  - `edit support funding information` no longer fetches its award title/URI/number
    from the SHARE funder index (`get_funder_information`). SHARE staging search can
    hang for minutes, and the values were only used as text to type in. The same values
    every run could also match what an earlier run already saved, so the test could pass
    even if Save did nothing. It now types unique values generated each run. The
    Funder Name dropdown itself searches ROR (`api.ror.org`), not SHARE.
  - Subjects/tags/affiliations save as you toggle them, so the tests wait for that save
    request before reloading instead of reloading straight away.
- **Institutions**: ports all of `test_institutions.py` - 210 tests, the same count
  pytest collects (121 plus one landing-page test per institution; 89 on `test`). An institution's page
  (`/institutions/<id>`) renders the same `osf-search-results-container` component as
  `/search`, so `InstitutionBrandedPage` (`src/pages/InstitutionsPage.ts`) extends
  `SearchPage` the same way `ProfilePage` does. The Python module imported
  `_validate_*_card` from `test_profile.py`; a spec can't import another spec here (its
  tests would register twice), so those helpers moved out of `tests/profile.spec.ts`
  into `src/utils/searchCards.ts`, and both specs import them from there. Other changes:
  - The Python identities (`div[data-test-insitutions-header]`,
    `img[data-test-institution-banner]`) are Ember-era and gone - replaced with the
    `osf-institutions-list` / `osf-institutions-search` components (verified live).
  - `select_institution()` (type the name, click the card) is kept as the
    `institutionPage` fixture, including the `Exoft` substitution on test4/stage4.
    `InstitutionsLandingPage.searchFor()` retries the fill until the list actually
    filters: a fill that lands before the list component is ready is silently
    ignored, and clicking "the first card" then opens the wrong institution (seen
    live). The list locator also skips the sub-header's "Read more" link.
  - `verifyUserCard` (shared helper) now waits for each profile tab's own
    `index-card-search` response before reading its count, and allows a tab with
    zero results (withdrawn/spam items count on the card but not on the profile).
    It previously could read the All tab's total instead, and failed on a user whose
    public preprints were all hidden from the profile.
  - Tabs are opened with `SearchPage.openTab()` so the helpers don't read the previous
    tab's results, and the resource-type tests use the named-option fix `search.spec.ts`
    already made (`StudyRegistration` on registrations, `Book` on files/projects).
    Python's projects-tab resource-type check used `==` on the count; it's `<=` here
    because of SHARE's off-by-one facet counts (see `CLAUDE.md`).
  - Users-tab sorting checks the sort request and re-render only, like `search.spec.ts`
    (user cards show no dates).
  - `test_institution_landing_page` is parametrized per institution, like pytest's
    `@pytest.mark.parametrize` from an API call at collection time. Playwright collects
    tests synchronously, so `osfApi.getAllInstitutionIdsSync()` fetches the public
    `/v2/institutions/` list in a short child process, and caches it in an env var so
    workers don't fetch it again.
  - `institution admin dashboard` could not be verified live: no account in `.env` is
    a COS admin on `test` (the dashboard redirects to `/forbidden`, the metrics API
    returns 403). It needs USER_ONE set up as a COS institution admin. Its locators are
    user-facing versions of the Angular XPaths in the Python test. The Python page
    object's Ember `data-test-*` / hashed-class locators were dropped, including
    `click_on_listbox_trigger`.

## Next steps
