import { test as base, expect } from '../src/fixtures';
import { AddonsPage } from '../src/pages/AddonsPage';
import * as osfApi from '../src/api/osfApi';
import * as settings from '../config/settings';
import { request } from '@playwright/test';


const test = base.extend<{
    addonsPage: AddonsPage;
    defaultAddonsProject: osfApi.OsfProject;
}>({
    addonsPage: async ({ page, defaultAddonsProject, mustBeLoggedIn }, use) => {
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
        //console.log(`GET ${res.url()} -> ${res.status()}`);
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
/** Matches the exact file name at the end of the URL path, so box.svg won't match dropbox.svg. */
const logoFilePattern = (fileName: string) =>
    new RegExp(`(?:^|/)${escapeRegex(fileName)}(?:[?#]|$)`);

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

const testableAddons = [
    ...storageAddons.map((provider) => ({ provider, type: addonTypeConfig.additionalService })),
    ...citationAddons.map((provider) => ({ provider, type: addonTypeConfig.citationManager })),
];

test.describe('Project addons page', { tag: ['@smoke', '@core'] }, () => {
    test.beforeEach(async ({ throttleOnProd }) => {
        void throttleOnProd;
    });
    for (const addonType of addonTypes) {
        test(`addon dropdown shows correct addons: ${addonType}`, async ({
            addonsPage,
        }) => {
            // Keyed by your project's addonTypes values

            const config = addonTypeConfig[addonType];
            if (!config) {
                throw new Error(`No config for addon type "${addonType}". Known: ${Object.keys(addonTypeConfig).join(', ')}`);
            }

            const expectedList = (await fetchAddonNames(config.url)).sort();
            // Navigate to addons page All addons tab
            await addonsPage.clickOnTab('All Add-ons');

            // Select Addon type from dropdown
            await addonsPage.selectFromAddonDropdown(config.label, 'All Add-ons');

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
    for (const { provider, type } of testableAddons) {
        test(`addon logo is correct: ${provider}`, async ({ addonsPage }) => {
            const expectedNames = await fetchAddonNames(type.url);
            await addonsPage.clickOnTab('All Add-ons');

            if (storageAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('Additional Storage', 'All Add-ons');
            } else if (citationAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('Citation Manager', 'All Add-ons');
            }

            // The filter actually applied: only this type's add-ons are listed
            await addonsPage.expectCardsToBe(expectedNames);

            const fileName = logoFileOverrides[provider] ?? `${provider}.svg`;
            await expect(
                await addonsPage.addonProviderLogo(provider),
                `Expected ${fileName} as the logo for ${provider}`,
            ).toHaveAttribute('src', logoFilePattern(fileName));
        });
    }

    for (const { provider, type } of testableAddons) {
        test(`verify connected tab shows only configured ${provider} `, async ({ addonsPage }) => {
            // Search for the add-on on the All Add-ons tab
            await addonsPage.clickOnTab('All Add-ons');
            if (storageAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('Additional Storage','All Add-ons' );
            } else if (citationAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('Citation Manager','All Add-ons');
            }
            await addonsPage.searchAddon(provider);

            await addonsPage.expectSearchResults(provider);

            // The button on this provider's own card
            const action = await addonsPage.addonCardAction(provider);
            await expect(action).toHaveAccessibleName(/^(Connect|Configure)$/);
            const label = (await action.innerText()).trim();
            const connectedTab = 'Connected Add-ons';

            await addonsPage.clickOnTab('Connected Add-ons');
            if (storageAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('Additional Storage', connectedTab);
            } else if (citationAddons.includes(provider)) {
                await addonsPage.selectFromAddonDropdown('Citation Manager', connectedTab);
            }
            await addonsPage.searchAddon(provider, connectedTab);
            if (label === 'Connect') {
                const message = `${provider} is not connected: card shows "Connect" instead of "Configure"`;
                test.info().annotations.push({ type: 'not connected', description: message });
                console.log(message);
                await expect(addonsPage.connectedTabEmpty).toBeVisible();
                return;
            }
            else {
                expect(label, `Configure button should be shown for ${provider}`).toBe('Configure');
            }
            
        });
    }
});