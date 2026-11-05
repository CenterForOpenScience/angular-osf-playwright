import { Page } from '@playwright/test';
import { test as base, expect } from '../src/fixtures';
import { AnalyticsPage } from '../src/pages/ProjectAnalyticsPage';
import { FilesPage } from '../src/pages/FilesPage';
import * as settings from '../config/settings';
import { OsfSession } from '../src/api/session';
import { installChartProbe } from '../src/utils/chartProbe';
import {
    AnalyticsTimespan,
    getProjectNodeAnalyticsData,
    getProjectRelatedCounts
} from '../src/api/osfApi';

/**
 * OSF records a visit only on in-app navigation after the project has loaded
 * (and only for users who aren't contributors). So: load the project, then click
 * through to Files, and wait for the page-view request.
 */
async function analyticsFor(session: OsfSession, guid: string, timespan: AnalyticsTimespan) {
    const data = await getProjectNodeAnalyticsData(session, guid, timespan);
    expect(data, `no node analytics data for ${guid} (${timespan})`).not.toBeNull();
    return data!.attributes;
}

/** True once the API has at least one recorded view of the project's Files page. */
async function filesVisitRecorded(session: OsfSession, guid: string) {
    const api = await analyticsFor(session, guid, 'week');
    return api.popular_pages.some((p) => p.path.includes('/files') && p.count > 0);
}

async function registerVisit(page: Page, session: OsfSession, guid: string) {
    await page.goto(`${settings.OSF_HOME}/${guid}/`);
    const filesLink = page.getByRole('link', { name: 'Files', exact: true });
    await expect(filesLink).toBeVisible();

    const pageview = page.waitForResponse(
        (r) => r.url().includes('/_/metrics/events/counted_usage/') && r.request().method() === 'POST',
    );
    await filesLink.click();
    const res = await pageview;
    expect(res.ok(), `page view was not recorded (HTTP ${res.status()})`).toBeTruthy();

    // Repeat visits by the same user within a short time aren't counted again,
    // so wait for the Files page to appear in the metrics, not for the count to rise.
    await expect
        .poll(() => filesVisitRecorded(session, guid), {
            message: 'Files page visit did not show up in the metrics API',
            timeout: 120_000,
            intervals: [2_000, 5_000],
        })
        .toBe(true);
}

const test = base.extend<{ analyticsPage: AnalyticsPage }>({
    analyticsPage: async ({ page, defaultProjectWithFile }, use) => {
        // Construct only — each test registers a visit first, then navigates here.
        await installChartProbe(page);
        await use(new AnalyticsPage(page, false, defaultProjectWithFile.id));
    },
});

/** Hover over the top bar on the Popular Pages graph and return the tooltip value. */
export async function getTooltipValue(
    analyticsPage: AnalyticsPage,
    barCount: number,
): Promise<number> {
    const tooltip = await analyticsPage.popularPagesTooltip(0, barCount);
    return tooltip.value;
}

const dateRangeOptions: AnalyticsTimespan[] = ['week', 'fortnight', 'month'];

test.describe('Project analytics page', { tag: ['@smoke', '@core'] }, () => {
    test.beforeEach(async ({ throttleOnProd }) => {
        void throttleOnProd;
    });
    for (const dateRangeOption of dateRangeOptions) {
        test(`charts match API: ${dateRangeOption}`, async ({
            page, session: OsfSession, analyticsPage, defaultProjectWithFile,
        }) => {
            const guid = defaultProjectWithFile.id;

            // Register a visit so today / the current hour has data.
            const filesPage = new FilesPage(page, false, guid, settings.OSF_HOME, 'osfstorage');
            await registerVisit(page, OsfSession, guid);

            await analyticsPage.gotoGuid();
            await analyticsPage.selectDateRange(dateRangeOption); // <- adjust if your method takes 2 args

            const api = await analyticsFor(OsfSession, guid, dateRangeOption);

            await test.step('Unique visits', async () => {
                const tooltips = await analyticsPage.uniqueVisitsTooltips(api.unique_visits.length);
                console.table(api.unique_visits.map((d, i) => ({
                    date: d.date, tooltip: tooltips.get(i)!.title,
                    ui: tooltips.get(i)!.value, api: d.count,
                })));
                for (const [i, t] of tooltips) {
                    expect.soft(t.value, `unique visits on ${api.unique_visits[i].date}`)
                        .toBe(api.unique_visits[i].count);
                }
            });

            await test.step('Time of day', async () => {
                // Bars with 0 visits have no height, so they can't be hovered.
                const indices = api.time_of_day.flatMap((d, i) => (d.count > 0 ? [i] : []));
                const tooltips = await analyticsPage.timeOfDayTooltips(api.time_of_day.length, indices);
                console.table(indices.map((i) => ({
                    hour: api.time_of_day[i].hour, ui: tooltips.get(i)!.value, api: api.time_of_day[i].count,
                })));
                for (const [i, t] of tooltips) {
                    expect.soft(t.value, `visits at hour ${api.time_of_day[i].hour}`)
                        .toBe(api.time_of_day[i].count);
                }
            });

            await test.step('Popular pages', async () => {
                if (api.popular_pages.length === 0) return;
                const tooltips = await analyticsPage.popularPagesTooltips(api.popular_pages.length);
                console.table(api.popular_pages.map((p, i) => ({
                    page: tooltips.get(i)!.title, ui: tooltips.get(i)!.value, api: p.count,
                })));
                for (const [i, t] of tooltips) {
                    expect.soft(t.value, `popular page ${api.popular_pages[i].title}`)
                        .toBe(api.popular_pages[i].count);
                }
            });
        });
    }

    test('KPI counts match API', async ({ session, analyticsPage, defaultProjectWithFile }) => {
        const counts = await getProjectRelatedCounts(session, defaultProjectWithFile.id);
        await analyticsPage.gotoGuid();

        const ui = {
            forksCount: await analyticsPage.kpiValue(analyticsPage.duplicatesKpi),
            linksToCount: await analyticsPage.kpiValue(analyticsPage.linksToProjectKpi),
            templateCount: await analyticsPage.kpiValue(analyticsPage.templateCopiesKpi),
        };
        console.table({ ui, api: counts });

        expect.soft(ui.forksCount, 'Duplicates').toBe(counts.forksCount);
        expect.soft(ui.linksToCount, 'Links to this project').toBe(counts.linksToCount);
        expect.soft(ui.templateCount, 'Template copies').toBe(counts.templateCount);
    });

    test('View duplicates button', async ({ page, session, analyticsPage, defaultProjectWithFile }) => {
        const guid = defaultProjectWithFile.id;
        const { forksCount } = await getProjectRelatedCounts(session, guid);
        await analyticsPage.gotoGuid();

        // The app only shows the button when the count is above 0.
        if (forksCount === 0) {
            await expect(analyticsPage.viewDuplicatesButton).toBeHidden();
            return;
        }
        await analyticsPage.viewDuplicatesButton.click();
        await expect(page).toHaveURL(new RegExp(`/${guid}/analytics/duplicates`));
    });

    test('View links button', async ({ page, session, analyticsPage, defaultProjectWithFile }) => {
        const guid = defaultProjectWithFile.id;
        const { linksToCount } = await getProjectRelatedCounts(session, guid);
        await analyticsPage.gotoGuid();

        if (linksToCount === 0) {
            await expect(analyticsPage.viewLinksButton).toBeHidden();
            return;
        }
        await analyticsPage.viewLinksButton.click();
        await expect(page).toHaveURL(new RegExp(`/${guid}/analytics/linked-projects`));
    });
});