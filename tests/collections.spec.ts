
import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { CollectionDiscoverPage, CollectionSearchPage } from '../src/pages/CollectionsPage';

const test = base.extend<{ collectionPage: CollectionSearchPage }>({
  /** Port of the `collection_page` fixture, plus `skip_test_if_page_not_found`, which every test called first. */
  collectionPage: async ({ page }, use) => {
    const collectionPage = new CollectionSearchPage(page);
    await collectionPage.goto();
    await collectionPage.skipIfPageNotFound();
    await use(collectionPage);
  },
});

let providers: osfApi.CollectionProvider[] = [];
let providersError: Error | undefined;
try {
  providers = osfApi.getCollectionProvidersSync();
} catch (error) {
  providersError = error as Error;
}

test.describe('Collection Discover Pages', { tag: ['@smoke', '@core'] }, () => {
  if (providersError) {
    test('discover page', () => {
      throw providersError;
    });
  }

  for (const provider of providers) {
    test(`discover page [${provider.id}]`, async ({ page }) => {
      const discoverPage = new CollectionDiscoverPage(page, provider.id);
      await discoverPage.goto();
      await discoverPage.verify(settings.LONG_TIMEOUT_MS);
      await expect(discoverPage.providerName).toContainText(provider.name);
    });
  }
});

test.describe('Collection Search', () => {
  test('search results on collections page', async ({ collectionPage }) => {
    // Python checked `settings.DOMAIN in ('test4')`, a substring check on a string, so
    // `test` got 'Test' too.
    let inputText = 'Systematic';
    if (settings.TEST4 || settings.TEST) {
      inputText = 'Test';
    } else if (settings.UAT1) {
      inputText = 'Validation';
    }
    await collectionPage.searchInput.fill(inputText);
    await collectionPage.waitForResults(() => collectionPage.searchInput.press('Enter'));
    await expect(collectionPage.resultCards.first()).toBeVisible();
  });

  test('sorting by created date on collections page', async ({ collectionPage }) => {
    await collectionPage.checkSortingByCreatedDate('created');
  });

  test('sorting by modified date on collections page', async ({ collectionPage }) => {
    await collectionPage.checkSortingByModifiedDate();
  });

  test('filtering by status on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.statusMenu);
    await collectionPage.checkFilteringByCollectionField(collectionPage.statusMenu, 'Status');
  });

  test('filtering by program area on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.programAreaMenu);
    await collectionPage.checkFilteringByCollectionField(collectionPage.programAreaMenu, 'Program Area');
  });

  test('search in filtering by status on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.statusMenu);
    await collectionPage.statusMenu.click();
    await collectionPage.openFilterMultiselectDropdown.click();
    await collectionPage.checkSearchInFilteringOptions();
  });

  test('search in filtering by program area on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.programAreaMenu);
    await collectionPage.programAreaMenu.click();
    await collectionPage.openFilterMultiselectDropdown.click();
    await collectionPage.checkSearchInFilteringOptions();
  });

  test('filtering by creator on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.creatorDropdownMenu);
    await collectionPage.checkFilteringByCreator();
  });

  test('filtering by funder on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.funderMenu);
    await collectionPage.checkFilteringByFunder();
  });

  test('filtering by subject on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.subjectMenu);
    await collectionPage.checkFilteringBySubject('1');
  });

  test('filtering by license on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.licenseMenu);
    await collectionPage.checkFilteringByLicense();
  });

  test('filtering by institution on collections page', async ({ collectionPage }) => {
    await collectionPage.skipIfFilterNotPresent(collectionPage.institutionMenu);
    await collectionPage.checkFilteringByInstitution('1');
  });
});
