import { Page, Locator, expect } from '@playwright/test';
import { GuidBasePage } from './GuidBasePage';

export class ProjectContributorsPage extends GuidBasePage {
    static baseUrl = '{guid}/contributors/';

    readonly createVolButton: Locator;
    readonly dialog: Locator;
    readonly volName: Locator;
    readonly createButton: Locator;
    readonly volTable: Locator;
    readonly volDeleteButton: Locator;

     constructor(page: Page, verify: boolean = false, guid: string) {
        super(page, verify, guid);
        this.createVolButton = page.locator('h2:text-is("View-only links") ~ p-button').getByRole('button', {
            name: 'Create',
            exact: true,
        });
        this.dialog = page.getByRole('dialog', { name: 'Create a new link to share your project' });
        this.volName = this.dialog.getByLabel('Link name');
        this.createButton = this.dialog.getByRole('button', { name: 'Create', exact: true });
        this.volTable = page.locator('osf-view-only-table');
        this.volDeleteButton = page.getByRole('row', { name: 'Playwright_VOL' }).getByLabel('Delete')
    }

    get url(): string {
        return `${this.domain}/${ProjectContributorsPage.baseUrl
            .replace('{guid}', this.guid)}`;
    }

    get identity(): Locator {
        return this.page.locator('[data-test-analytics-page-heading]');
    }

    async deletetVOL(volName:string): Promise<void> {
        expect(this.page.getByRole('cell', { name: volName })).toBeVisible();
        await this.page.getByRole('row', { name: volName }).getByLabel('Delete').click();
        await this.page.getByLabel('Delete Link ' + volName +'?').getByRole('button', { name: 'Delete' }).click();
        await expect(this.page.getByText('View only link successfully')).toBeVisible();
    }
}