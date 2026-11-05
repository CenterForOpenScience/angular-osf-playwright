import { Page, Locator, expect } from '@playwright/test';
import { GuidBasePage } from './GuidBasePage';
import * as settings from '../../config/settings';
import * as osfApi from '../api/osfApi';
import { OsfSession } from '../api/session';
import { readChartTooltips, TooltipReading } from '../utils/chartProbe';


/** Option text in the date-range dropdown (en.json: project.analytics.charts.*). */
export type AnalyticsTimespan = 'week' | 'fortnight' | 'month';
const TIMESPAN_OPTIONS: Record<AnalyticsTimespan, string> = {
  week: 'project.analytics.charts.pastWeek',
  fortnight: 'project.analytics.charts.pastTwoWeeks',
  month: 'project.analytics.charts.pastMonth',
};

/** Mirrors settings.LONG_TIMEOUT from the Selenium suite (ms). */
const LONG_TIMEOUT = 30_000;



export class AnalyticsPage extends GuidBasePage {
  static baseUrl = '{guid}/analytics/';
  // Locators

  readonly timespan?: AnalyticsTimespan;

  // Page-level
  readonly privateProjectMessage: Locator;
  readonly disabledChart: Locator;
  readonly dateRangeDropdown: Locator;
 
  // Charts (osf-*-chart component with an h2 title) and their canvases
  readonly uniqueVisitsChart: Locator;
  readonly timeOfDayVisitsChart: Locator;
  readonly popularPagesChart: Locator;
  readonly uniqueVisitsCanvas: Locator;
  readonly timeOfDayCanvas: Locator;
  readonly popularPagesCanvas: Locator;
  readonly duplicatesKpi: Locator;
  readonly linksToProjectKpi: Locator;
  readonly templateCopiesKpi: Locator;
  readonly viewDuplicatesButton: Locator;
  readonly viewLinksButton: Locator;

  constructor(page: Page, verify: boolean = false, guid: string, timespan?: AnalyticsTimespan) {
    super(page, verify, guid);
    this.timespan = timespan;

    // TODO: confirm the exact wording of the private-project message.
    this.privateProjectMessage = page.getByText(/analytics.*(private|not available)/i);
    // Original selector '._Chart_1hff7g _Blurred_1hff7g' was missing a '.' and
    // used build-hashed class names; match on the stable class prefix instead.
    this.privateProjectMessage = page.getByText(
      'Analytics are not available for private projects',
    );
    this.disabledChart = page.locator('.disabled').filter({ has: page.locator('osf-line-chart') });
    this.dateRangeDropdown = page.locator('osf-select').getByRole('combobox');

    this.uniqueVisitsChart = this.chart('osf-line-chart', 'Unique visits');
    this.timeOfDayVisitsChart = this.chart('osf-bar-chart', 'Time of day of visits');
    this.popularPagesChart = this.chart('osf-bar-chart', 'Popular pages');

    this.uniqueVisitsCanvas = this.uniqueVisitsChart.locator('canvas');
    this.timeOfDayCanvas = this.timeOfDayVisitsChart.locator('canvas');
    this.popularPagesCanvas = this.popularPagesChart.locator('canvas');
    this.dateRangeDropdown = page.getByRole('button', { name: 'dropdown trigger' });
    this.duplicatesKpi = this.kpi('Duplicates');
    this.linksToProjectKpi = this.kpi('Links to this project');
    this.templateCopiesKpi = this.kpi('Template copies');
    this.viewDuplicatesButton = this.duplicatesKpi.getByRole('button', { name: 'View duplicates' });
    this.viewLinksButton = this.linksToProjectKpi.getByRole('button', { name: 'View links' });

  }

  /** The number on a card. While loading, the card shows a placeholder with no digits, so this waits for the number. */
  async kpiValue(kpi: Locator): Promise<number> {
    const value = kpi.getByText(/^\d+$/);
    await expect(value).toBeVisible();
    return Number((await value.innerText()).trim());
  }

  private kpi(title: string): Locator {
    return this.page.locator('osf-analytics-kpi').filter({
      has: this.page.getByText(title, { exact: true }),
    });
  }

  protected path(): string {
    const query = this.timespan ? `?timespan=${this.timespan}` : '';
    return `/${this.guid}/analytics/${query}`;
  }

  protected urlPattern(): RegExp {
    return /\/[a-z0-9]{5}\/analytics/i;
  }

  /** Confirms URL and page identity (replaces `identity` + LONG_TIMEOUT). */
  get url(): string {
    return `${this.domain}/${AnalyticsPage.baseUrl
      .replace('{guid}', this.guid)}`;
  }

  get identity(): Locator {
    return this.page.locator('[data-test-analytics-page-heading]');
  }

  async selectDateRange(timespan: AnalyticsTimespan): Promise<void> {
    const option = this.page.getByRole('option', { name: TIMESPAN_OPTIONS[timespan], exact: true });
 
    await this.dateRangeDropdown.click();
    await option.click();
 
    // Re-open to confirm the selection stuck, then close again.
    await this.dateRangeDropdown.click();
    await expect(option).toHaveAttribute('aria-selected', 'true');
    await this.page.keyboard.press('Escape');
  }

  async uniqueVisitsTooltips(count: number, indices?: number[]) {
    return readChartTooltips(this.uniqueVisitsCanvas, 'point', count, indices);
  }

  async timeOfDayTooltips(count: number, indices?: number[]) {
    return readChartTooltips(this.timeOfDayCanvas, 'bar', count, indices);
  }

  /** Index 0 is the top bar (the most visited page). */
  async popularPagesTooltips(count: number, indices?: number[]) {
    return readChartTooltips(this.popularPagesCanvas, 'bar', count, indices);
  }

  /** Single tooltip convenience wrapper. */
  async popularPagesTooltip(index: number, count: number): Promise<TooltipReading> {
    return (await this.popularPagesTooltips(count, [index])).get(index)!;
  }

  /** Canvas element(s) rendered inside a chart component. */
  chartCanvas(chart: Locator): Locator {
    return chart.locator('canvas');
  }

  // ---- private builders ----

  private chart(component: string, title: string): Locator {
    return this.page.locator(component).filter({
      has: this.page.getByRole('heading', { level: 2, name: title, exact: true }),
    });

  }
}