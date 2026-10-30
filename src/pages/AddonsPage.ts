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
    readonly configureButton: Locator;
    readonly addonCardActionButton: Locator;

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
        this.configureButton = page.getByRole('button', { name: 'Configure', exact: true });
        this.addonCardActionButton = page.getByRole('button', { name: /^\s*(Connect|Configure)\s*$/ });
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

    tabPanel(tabName: string): Locator {
        return this.page.getByRole('tabpanel', { name: tabName, exact: true });
    }

    async selectFromAddonDropdown(option: string, tabName?: string): Promise<void> {
        const scope = tabName ? this.tabPanel(tabName) : this.page;
        await scope.getByRole('button', { name: 'dropdown trigger' }).click();
        //await this.addonsDropdownTrigger.click();
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

    async expectSearchResults(term: string): Promise<void> {
        const target = AddonsPage.normalize(term);
        await expect
            .poll(async () => {
                const names = await this.addonCardNames();
                return names.includes(target) && names.every((n) => n.includes(target));
            }, { message: `Search results for "${term}" did not update` })
            .toBe(true);
    }

    /** Finds the item belonging to provider's card: one item per card, in card order. */
    private async pairedWithCard(provider: string, items: Locator, what: string): Promise<Locator> {
        const target = AddonsPage.normalize(provider);

        let titles: string[] = [];
        await expect
            .poll(async () => (titles = await this.addonCardNames()), {
                message: `No add-on card titled "${provider}"`,
            })
            .toContain(target);

        await expect(
            items,
            `Expected one ${what} per card (${titles.length} cards), so ${what}s can't be matched by position`,
        ).toHaveCount(titles.length);

        return items.nth(titles.indexOf(target));
    }

    /** Logo for the card whose title matches provider. */
    async addonProviderLogo(provider: string): Promise<Locator> {
        return this.pairedWithCard(provider, this.addonCardLogo, 'logo');
    }

    async addonCardAction(provider: string): Promise<Locator> {
        return this.pairedWithCard(provider, this.addonCardActionButton, 'Connect/Configure button');
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

    /** Search the All Add-ons tab. fill() clears the field first, like clear() + send_keys(). */
    async searchAddon(name: string, tabName?: string): Promise<void> {
        const input = tabName
            ? this.tabPanel(tabName).getByPlaceholder('Search add-ons', { exact: true })
            : this.searchInput.first();
        await input.fill(name);
    }

    /** Card names shown in one tab, normalised like addonCardNames(). */
    async tabCardNames(tabName: string): Promise<string[]> {
        return (await this.tabPanel(tabName).getByRole('heading', { level: 3 }).allInnerTexts())
            .map(AddonsPage.normalize);
    }

    /** "No results found." inside one tab. */
    tabNoResults(tabName: string): Locator {
        return this.tabPanel(tabName).getByText('No results found.', { exact: true });
    }

}