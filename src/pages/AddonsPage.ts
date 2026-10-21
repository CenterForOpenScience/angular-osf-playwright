import { Page, Locator, expect } from '@playwright/test';
import { GuidBasePage } from './GuidBasePage';
import * as settings from '../../config/settings';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive exact name match, ignoring surrounding whitespace. */
const exactNameIgnoreCase = (text: string) =>
    new RegExp(`^\\s*${escapeRegex(text)}\\s*$`, 'i');

export class AddonsPage extends GuidBasePage {
    static baseUrl = '{guid}/addons/';
    // Locators

    // Tabs
    readonly allAddonsTab: Locator;
    readonly connectedAddonsTab: Locator;

    // Dropdowns (PrimeNG <p-select> renders role="combobox", items role="option")
    readonly addonDropdowns: Locator;
    readonly addonsDropdownTrigger: Locator;
    readonly selectOption: Locator;

    readonly searchInput: Locator;
    readonly addonCardTitle: Locator;
    readonly connectedTabEmpty: Locator;
    readonly addonCardLogo: Locator;

    constructor(
        page: Page,
        verify: boolean = false,
        guid: string = '',
        domain: string = settings.OSF_HOME,
    ) {
        super(page, verify, guid, domain);

        // Prefer resilient, role-based or test-id selectors over fragile long utility classes

        this.allAddonsTab = page.getByRole('tab', { name: 'All Add-ons', exact: true });
        this.connectedAddonsTab = page.getByRole('tab', { name: 'Connected Add-ons', exact: true });

        this.addonDropdowns = page.getByRole('combobox');

        this.searchInput = page.getByPlaceholder('Search add-ons', { exact: true });
        this.addonCardTitle = page.getByRole('heading', { level: 3 });
        this.connectedTabEmpty = page.getByText('No results found.', { exact: true });
        this.addonsDropdownTrigger = page.getByRole('button', { name: 'dropdown trigger' });
        this.selectOption = page.getByRole('option', { name: 'settings.addons.categories.additionalService' })
        this.addonCardLogo = page.getByRole('img', { name: 'Addon card image', exact: true });

    }


    get url(): string {
        return `${this.domain}/${AddonsPage.baseUrl
            .replace('{guid}', this.guid)}`;
    }

    get identity(): Locator {
        return this.page.locator('[data-test-page-heading]');
    }

    connectedTabSearchInput(): Locator {
        return this.searchInput.nth(1);
    }

    async clickOnTab(tabName: string): Promise<void> {
        await this.page.getByRole('tab', { name: (tabName), exact: true }).click()
    }

    // async selectFromAddonDropdown(option: string): Promise<void> {
    //     console.log(option);
    //     await this.addonsDropdownTrigger.click();
    //     await this.page.getByRole('option', { name: 'settings.addons.categories.'+(option)}).click();
    // }

    async selectFromAddonDropdown(option: string): Promise<void> {
        await this.addonsDropdownTrigger.click();
        const normalizedOption = option.trim().replace(/\s+/g, ' ');
        await this.page.locator('p-selectitem')
            .filter({
                hasText: new RegExp(
                    `^\\s*${normalizedOption.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`
                )
            })
            .click();
    }


    /**
   * The add-on card containing a heading with the given name (case-insensitive).
   * This is the only locator that depends on the card's markup: it assumes each
   * card is rendered as a list item. If it isn't, ask for a data-testid on the
   * card and switch this to page.getByTestId('addon-card').filter(...).
   */
    addonCard(name: string): Locator {

        return this.page.getByRole('article').filter({          // ← role from the snapshot
            has: this.page.getByRole('heading', { level: 3, name: (name) }),
        });
    }

    /** Logo for the card whose heading matches provider . */
    /** Card names with whitespace removed and lowercased ("Google Drive" -> "googledrive"). */
    private static normalize(text: string): string {
        return text.replace(/\s+/g, '').toLowerCase();
    }

    async addonCardNames(): Promise<string[]> {
        return (await this.addonCardTitle.allInnerTexts()).map(AddonsPage.normalize);
    }

    /** Retries until the visible cards are exactly the expected add-ons (proves the filter applied). */
    async expectCardsToBe(expectedNames: string[]): Promise<void> {
        const expected = expectedNames.map(AddonsPage.normalize).sort();
        await expect
            .poll(async () => (await this.addonCardNames()).sort(), {
                message: 'Add-on list does not match the selected filter',
            })
            .toEqual(expected);
    }

    /** Logo for the card whose title matches provider. */
    async addonProviderLogo(provider: string): Promise<Locator> {
        const target = AddonsPage.normalize(provider);

        // Retries: the list may still be switching after a filter change
        let titles: string[] = [];
        await expect
            .poll(async () => (titles = await this.addonCardNames()), {
                message: `No add-on card titled "${provider}"`,
            })
            .toContain(target);

        // Logos are paired with titles by position, so the counts must match
        await expect(
            this.addonCardLogo,
            `Expected one logo per card (${titles.length} cards). A card is missing its logo, so logos can't be matched by position`,
        ).toHaveCount(titles.length);

        return this.addonCardLogo.nth(titles.indexOf(target));
    }

    async getAddonProviderLogo(provider: string): Promise<string | null> {
        return (await this.addonProviderLogo(provider)).getAttribute('src');
    }

    async clickOnButton(buttonName: string): Promise<void> {
        await this.page.getByRole('button', { name: buttonName, exact: true }).click();
    }

    /** Assert the add-on card shows a 'Connect' button (i.e. it is disconnected). */
    async verifyAddonCard(addon: string): Promise<void> {
        await expect(
            this.addonCard(addon).getByRole('button', { name: 'Connect', exact: true }),
            `Addon "${addon}" not disconnected`,
        ).toBeVisible();
    }

}