// guid-base-page.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import * as settings from '../../config/settings';


export abstract class GuidBasePage extends BasePage {
  static baseUrl: string = '';
  guid: string;
  domain: string;

  constructor(
    page: Page,
    verify: boolean = false,
    guid: string = '',
    domain: string = settings.OSF_HOME
  ) {
    super(page);
    this.domain = domain;
    this.guid = guid;
  }

  get url(): string {
    const baseUrl = (this.constructor as typeof GuidBasePage).baseUrl;
    if (baseUrl.includes('{guid}')) {
      return `${this.domain}/${baseUrl.replace('{guid}', this.guid)}`;
    } else {
      throw new Error('No {guid} placeholder in base_url specified.');
    }
  }

  // guid-base-page.ts
  async goto(): Promise<this> {
    await this.page.goto(this.url);
    try {
      await this.page.getByText('Accept cookies').click({ timeout: 3000 });
    } catch {
      // banner not present, continue
    }
    return this;
  }
}