import dotenv from 'dotenv';

import { environments, isEnvironmentName, EnvironmentName } from './environments';

dotenv.config();

function env(name: string, fallback = ''): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function envBool(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envList(name: string, fallback: string[] = []): string[] {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return value.split(',').map((item) => item.trim());
}

const rawEnvName = env('TEST_ENV', env('DOMAIN', 'stage3'));
if (!isEnvironmentName(rawEnvName)) {
  throw new Error(
    `Unknown TEST_ENV "${rawEnvName}". Expected one of: ${Object.keys(environments).join(', ')}`
  );
}

export const DOMAIN: EnvironmentName = rawEnvName;

export const HEADLESS = envBool('HEADLESS', false);

// Env vars are seconds (matching settings.py); these feed straight into Playwright's
// own timeout knobs (expect.timeout, actionTimeout, navigationTimeout, global
// timeout), which want milliseconds, so the conversion happens right here.
export const QUICK_TIMEOUT_MS = envInt('QUICK_TIMEOUT', 4) * 1000;
export const TIMEOUT_MS = envInt('TIMEOUT', 25) * 1000;
export const LONG_TIMEOUT_MS = envInt('LONG_TIMEOUT', 35) * 1000;
export const VERY_LONG_TIMEOUT_MS = envInt('VERY_LONG_TIMEOUT', 60) * 1000;

// Not a wait timeout - a deliberate rate-limit sleep before hitting production.
export const PROD_THROTTLE = envInt('PROD_THROTTLE', 5);

export const NEW_USER_EMAIL = env('NEW_USER_EMAIL');

// Preferred node must be set to run tests on production.
export const PREFERRED_NODE = env('PREFERRED_NODE') || null;
export const POPULAR_PAGES = envList('POPULAR_PAGES');

export const EXPECTED_PROVIDERS = envList('EXPECTED_PROVIDERS', [
  'bitbucket',
  'box',
  'dataverse',
  'dropbox',
  'figshare',
  'github',
  'gitlab',
  'googledrive',
  'osfstorage',
  'onedrive',
  's3',
]);

const currentEnvironment = environments[DOMAIN];

export const OSF_HOME = currentEnvironment.home;
export const API_DOMAIN = currentEnvironment.api;
export const FILE_DOMAIN = currentEnvironment.files;
export const CAS_DOMAIN = currentEnvironment.cas;
export const CUSTOM_INSTITUTION_DOMAINS = currentEnvironment.customInstitutionDomains;
export const ADDON_DOMAIN = currentEnvironment.addons;
export const ADDON_API_TOKEN = env(currentEnvironment.addonTokenEnvVar);

export const USER_ONE = env('USER_ONE');
export const USER_ONE_PASSWORD = env('USER_ONE_PASSWORD');
export const USER_TWO = env('USER_TWO');
export const USER_TWO_PASSWORD = env('USER_TWO_PASSWORD');

// Used to skip certain tests on specific environments (mirrors settings.py flags).
export const STAGE1 = DOMAIN === 'stage1';
export const STAGE2 = DOMAIN === 'stage2';
export const STAGE3 = DOMAIN === 'stage3';
export const STAGE4 = DOMAIN === 'stage4';
export const TEST = DOMAIN === 'test';
export const TEST2 = DOMAIN === 'test2';
export const TEST3 = DOMAIN === 'test3';
export const TEST4 = DOMAIN === 'test4';
export const PRODUCTION = DOMAIN === 'prod';

export const FUNDER_INFO_URL =
  'https://staging-share.osf.io/api/v3/index-value-search?valueSearchPropertyPath=funder&acceptMediatype=application%2Fvnd.api%2Bjson';

// Users for testing CAS login scenarios.
export const DEACTIVATED_USER = env('DEACTIVATED_USER');
export const DEACTIVATED_USER_PASSWORD = env('DEACTIVATED_USER_PASSWORD');
export const UNCONFIRMED_USER = env('UNCONFIRMED_USER');
export const UNCONFIRMED_USER_PASSWORD = env('UNCONFIRMED_USER_PASSWORD');
export const CAS_2FA_USER = env('CAS_2FA_USER');
export const CAS_2FA_USER_PASSWORD = env('CAS_2FA_USER_PASSWORD');
export const CAS_TOS_USER = env('CAS_TOS_USER');
export const CAS_TOS_USER_PASSWORD = env('CAS_TOS_USER_PASSWORD');
export const DEVAPP_CLIENT_ID = env('DEVAPP_CLIENT_ID');
export const DEVAPP_CLIENT_SECRET = env('DEVAPP_CLIENT_SECRET');

// User with IMAP enabled email.
export const IMAP_EMAIL = env('IMAP_EMAIL');
export const IMAP_EMAIL_PASSWORD = env('IMAP_EMAIL_PASSWORD');
export const IMAP_HOST = env('IMAP_HOST');

export const REGISTRATIONS_USER = env('REGISTRATIONS_USER');
export const REGISTRATIONS_USER_PASSWORD = env('REGISTRATIONS_USER_PASSWORD');

export const PROFILE_USER = env('PROFILE_USER');
export const PROFILE_USER_PASSWORD = env('PROFILE_USER_PASSWORD');

export const ADMIN_USER = env('ADMIN_USER');
export const ADMIN_USER_PASSWORD = env('ADMIN_USER_PASSWORD');

export const WRITE_USER = env('WRITE_USER');
export const WRITE_USER_PASSWORD = env('WRITE_USER_PASSWORD');

export const READ_USER = env('READ_USER');
export const READ_USER_PASSWORD = env('READ_USER_PASSWORD');

export const MENDELEY_EMAIL = env('MENDELEY_EMAIL');
export const MENDELEY_PASSWORD = env('MENDELEY_PASSWORD');
export const ZOTERO_USER = env('ZOTERO_USER');
export const ZOTERO_PASSWORD = env('ZOTERO_PASSWORD');
export const DATAVERSE_URL = env('DATAVERSE_URL');
export const DATAVERSE_API_TOKEN = env('DATAVERSE_API_TOKEN');

// Populated at runtime by the `waffledPages` fixture (see src/fixtures/index.ts),
// mirroring `settings.EMBER_PAGES` being set dynamically in the old conftest.py.
export const runtime = {
  emberPages: [] as string[],
};
