import { test as base, expect } from '../src/fixtures';
import { AddonsPage } from '../src/pages/AddonsPage';
import * as osfApi from '../src/api/osfApi';
import * as settings from '../config/settings';
import { request } from '@playwright/test';


const test = base.extend<{
  addonsPage: AddonsPage;
  defaultAddonsProject: osfApi.OsfProject;
}>({
  addonsPage: async ({ page,  defaultAddonsProject, mustBeLoggedIn }, use) => {
    void mustBeLoggedIn; // ensure login fixture resolves before this runs; 

    const addonsPage = new AddonsPage(
      page,
      false,
      defaultAddonsProject.id,
      settings.OSF_HOME,
    );
    await addonsPage.gotoGuid();
    await use(addonsPage);
  },

});

/** Normalise whatever the osfApi helper returns into lowercase addon names. */
const toAddonNames = (result: unknown): string[] => {
  const items = Array.isArray(result) ? result : (result as { data?: unknown[] })?.data;
  if (!Array.isArray(items)) {
    throw new Error(`Unexpected osfApi response: ${JSON.stringify(result)}`);
  }
  return items.map((item: any) =>
    String(
      typeof item === 'string'
        ? item
        : item.attributes?.display_name ?? item.display_name ?? item.name,
    )
      .trim()
      .toLowerCase(),
  );
};

async function fetchAddonNames(url: string): Promise<string[]> {
  const gv = await request.newContext({
    baseURL: settings.ADDON_DOMAIN,
    extraHTTPHeaders: {
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${settings.ADDON_API_TOKEN}`,
    },
  });
  try {
    const res = await gv.get(url);
    console.log(`GET ${res.url()} -> ${res.status()}`);
    if (!res.ok()) throw new Error(`${res.status()} ${await res.text()}`);
    const body = await res.json();
    return body.data.map((a: any) => a.attributes.display_name.trim().toLowerCase());
  } finally {
    await gv.dispose();
  }
}

// Example parameterized test replacing python's provider fixture
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const citationAddons = ['mendeley', 'zotero'];
const storageAddons = ['s3', 'box', 'bitbucket', 'dataverse', 'dropbox', 'figshare', 'github', 'gitlab', 'googledrive', 'onedrive', 'owncloud'];
//const providers = ['osfstorage', 'box'];
const addonTypes = ['additionalService', 'citationManager', 'linkedService']
export type AddonType = (typeof addonTypes)[number];
// Providers whose icon file name differs from the provider key
const logoFileOverrides: Record<string, string> = {
  googledrive: 'google_drive.svg',
};

test.describe('Project addons page', { tag: '@core' }, () => {
  test.beforeEach(() => {
      test.skip(settings.PRODUCTION, 'Test should not run on production');
    });
  
    for (const addonType of addonTypes) {
        test(`addon dropdown shows correct addons: ${addonType}`, async ({
            addonsPage,
        }) => {
            // Keyed by your project's addonTypes values
            const addonTypeConfig: Record<string, { label: string; url: string }> = {
                additionalService: {
                    label: 'Additional Storage',
                    url: '/v1/external-storage-services',
                },
                citationManager: {                       // ← use the exact key from your addonTypes
                    label: 'Citation Manager',
                    url: '/v1/external-citation-services',
                },
                linkedService: {                         // ← use the exact key from your addonTypes
                    label: 'Linked Services',
                    url: '/v1/external-link-services',
                },
            };
            const config = addonTypeConfig[addonType];
            if (!config) {
                throw new Error(`No config for addon type "${addonType}". Known: ${Object.keys(addonTypeConfig).join(', ')}`);
            }

            const expectedList = (await fetchAddonNames(config.url)).sort();
            // Navigate to addons page All addons tab
            await addonsPage.clickOnTab('All Add-ons');

            // Select Addon type from dropdown
            await addonsPage.selectFromAddonDropdown(addonType);

            // Actual results list
            const addonTitles = addonsPage.addonCardTitle;
            await expect(addonTitles).toHaveCount(expectedList.length);

            const actualList = (await addonTitles.allInnerTexts())
                .map((t) => t.trim().toLowerCase())
                .sort();

            // Verify Actual results list is same as expected results
            expect(actualList).toEqual(expectedList);
        });
    }
 
  // Equivalent of @pytest.mark.parametrize('provider', testable_addons + citation_addons)
    for (const provider of [...storageAddons, ...citationAddons]) {
        test(`addon logo is correct: ${provider}`, async ({ addonsPage }) => {
            await addonsPage.clickOnTab('All Add-ons');

            if (storageAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('additionalService');
            } else if (citationAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('citationManager');
            }

            const expectedLogo = logoFileOverrides[provider] ?? `${provider}.svg`;

            await expect(
                await addonsPage.addonProviderLogo(provider),
                `Expected ${expectedLogo} in src for ${provider}`,
            ).toHaveAttribute('src', new RegExp(escapeRegex(expectedLogo)));
        });
    }
});