import { APIRequestContext, request } from '@playwright/test';

import * as settings from '../../config/settings';

/**
 * Thin JSON:API wrapper around Playwright's APIRequestContext, standing in for the
 * `pythosf.client.Session` object that `api/osf_api.py` was built on. Every osfApi.ts
 * function takes a `session` as its first argument, exactly like the original.
 */
export interface OsfSession {
  readonly baseURL: string;
  get<T = any>(url: string, params?: Record<string, string | number>): Promise<T>;
  post<T = any>(url: string, body: unknown): Promise<T>;
  patch<T = any>(url: string, body: unknown): Promise<T>;
  put<T = any>(url: string, body: unknown, params?: Record<string, string | number>): Promise<T>;
  delete(url: string): Promise<void>;
  dispose(): Promise<void>;
}

export class OsfApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string
  ) {
    super(`Request to ${url} failed with status ${status}: ${body}`);
  }
}

function resolveUrl(baseURL: string, url: string): string {
  if (url.startsWith('http')) return url;
  return `${baseURL}${url.startsWith('/') ? url : `/${url}`}`;
}

async function parseJsonOrThrow(response: {
  ok(): boolean;
  status(): number;
  url(): string;
  text(): Promise<string>;
  json(): Promise<any>;
}): Promise<any> {
  if (!response.ok()) {
    throw new OsfApiError(response.status(), response.url(), await response.text());
  }
  if (response.status() === 204) return undefined;
  const text = await response.text();
  return text ? JSON.parse(text) : undefined;
}

function wrapContext(context: APIRequestContext, baseURL: string): OsfSession {
  return {
    baseURL,
    async get(url, params) {
      const response = await context.get(resolveUrl(baseURL, url), { params });
      return parseJsonOrThrow(response);
    },
    async post(url, body) {
      const response = await context.post(resolveUrl(baseURL, url), { data: body });
      return parseJsonOrThrow(response);
    },
    async patch(url, body) {
      const response = await context.patch(resolveUrl(baseURL, url), { data: body });
      return parseJsonOrThrow(response);
    },
    async put(url, body, params) {
      const response = await context.put(resolveUrl(baseURL, url), { data: body, params });
      return parseJsonOrThrow(response);
    },
    async delete(url) {
      const response = await context.delete(resolveUrl(baseURL, url));
      await parseJsonOrThrow(response);
    },
    dispose: () => context.dispose(),
  };
}

export async function createSession(
  user: string = settings.USER_ONE,
  password: string = settings.USER_ONE_PASSWORD,
  baseURL: string = settings.API_DOMAIN
): Promise<OsfSession> {
  // Built and sent as a plain Authorization header (rather than relying on
  // Playwright's `httpCredentials`, which only auto-attaches once the context's own
  // `baseURL` origin issues a 401 challenge) so it's sent proactively on every
  // request - including cross-origin calls like file uploads to FILE_DOMAIN -
  // matching how `pythosf.client.Session(auth=...)` behaved.
  const basicAuth = Buffer.from(`${user}:${password}`).toString('base64');
  const context: APIRequestContext = await request.newContext({
    extraHTTPHeaders: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      Authorization: `Basic ${basicAuth}`,
    },
  });

  return wrapContext(context, baseURL);
}

/**
 * Port of `get_addon_session()`: talks to ADDON_DOMAIN using a Bearer token
 * (ADDON_API_TOKEN) instead of the Basic-auth OSF API session above.
 */
export async function createAddonSession(): Promise<OsfSession> {
  const context: APIRequestContext = await request.newContext({
    extraHTTPHeaders: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      Authorization: `Bearer ${settings.ADDON_API_TOKEN}`,
    },
  });

  return wrapContext(context, settings.ADDON_DOMAIN);
}
