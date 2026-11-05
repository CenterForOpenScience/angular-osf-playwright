import { Page, Locator, expect } from '@playwright/test';
import { GuidBasePage } from './GuidBasePage';
import * as settings from '../../config/settings';

export class ProjectDetailsPage extends GuidBasePage {
    static baseUrl = '{guid}/overview/';

    readonly metadata: Locator;
    readonly overviewDescription: Locator;
    readonly overviewDateCreated: Locator;
    readonly overviewDateModified: Locator;
    readonly overviewLicense: Locator;
    readonly affiliationLinks: Locator;
    readonly authorLinks: Locator;
    readonly overviewTags: Locator;

    constructor(page: Page, verify: boolean = false, guid: string) {
        super(page, verify, guid);
        this.metadata = page.locator('osf-project-overview-metadata');
        const valueAfter = (label: string) => this.metadata.locator(`h3:text-is("${label}") + *`);

        this.overviewDescription = valueAfter('Description').locator('.text-content');
        this.overviewDateCreated = valueAfter('Date Created');
        this.overviewDateModified = valueAfter('Date Updated');
        // inner <div> renders only after the license loads (a skeleton shows before that)
        this.overviewLicense = valueAfter('License').locator('div');
        this.affiliationLinks = valueAfter('Affiliated Institutions').locator('a[href*="/institutions/"]');
        this.authorLinks = this.metadata.locator('osf-contributors-list a[data-test-contributor-name]');
        this.overviewTags = this.metadata.locator('osf-tags-list p-tag');
    }

    get url(): string {
        return `${this.domain}/${ProjectDetailsPage.baseUrl
            .replace('{guid}', this.guid)}`;
    }

    get identity(): Locator {
        return this.page.locator('[data-test-analytics-page-heading]');
    }

    // method
    async getTagsList(): Promise<string[]> {
        return (await this.overviewTags.allInnerTexts()).map((t) => t.trim());
    }

    async getAffiliationsList(): Promise<string[]> {
        const hrefs = await this.affiliationLinks.evaluateAll((els) =>
            els.map((el) => el.getAttribute('href') ?? ''),
        );
        return hrefs.map((href) => href.split('/institutions/')[1].replace(/\/$/, ''));
    }

    async getAuthorsList(): Promise<{ name: string; link: string }[]> {
        await this.authorLinks.first().waitFor(); // contributors load after the page
        const links = await this.authorLinks.all();
        return Promise.all(
            links.map(async (l) => ({
                name: (await l.innerText()).trim(),
                link: (await l.getAttribute('href')) ?? '',
            })),
        );
    }
}