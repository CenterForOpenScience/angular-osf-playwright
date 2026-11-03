import { test as base, expect } from '../src/fixtures';
import { AnalyticsPage } from '../src/pages/ProjectAnalyticsPage';
import { FilesPage } from '../src/pages/FilesPage';
import * as settings from '../config/settings';
import { OsfSession } from '../src/api/session';
import { installChartProbe } from '../src/utils/chartProbe';
import {
    AnalyticsTimespan,
    getProjectNodeAnalyticsData,
} from '../src/api/osfApi';
 

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


async function analyticsFor(session:OsfSession, guid: string, timespan: AnalyticsTimespan) {
    const data = await getProjectNodeAnalyticsData(session, guid, timespan);
    expect(data, `no node analytics data for ${guid} (${timespan})`).not.toBeNull();
    return data!.attributes;
}

const dateRangeOptions: AnalyticsTimespan[] = ['week', 'fortnight', 'month'];
 
for (const dateRangeOption of dateRangeOptions) {
    test(`charts match API: ${dateRangeOption}`, async ({
        page, session:OsfSession, analyticsPage, defaultProjectWithFile,
    }) => {
        const guid = defaultProjectWithFile.id;

        // Register a visit so today / the current hour has data.
        await new FilesPage(page, false, guid, settings.OSF_HOME, 'osfstorage').gotoGuid();

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