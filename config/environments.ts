export type EnvironmentName =
  | 'test'
  | 'test1'
  | 'test2'
  | 'test3'
  | 'test4'
  | 'uat1'
  | 'prod';

export interface EnvironmentConfig {
  home: string;
  api: string;
  files: string;
  cas: string;
  customInstitutionDomains: string[];
  addons: string;
  addonTokenEnvVar: string;
}

// Mirrors the `domains` dict in the old settings.py, minus the staging (stage1-4)
// environments, which this suite doesn't support.
export const environments: Record<EnvironmentName, EnvironmentConfig> = {
  test: {
    home: 'https://test.osf.io',
    api: 'https://api.test.osf.io',
    files: 'https://files.us.test.osf.io',
    cas: 'https://accounts.test.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.test.osf.io',
    addonTokenEnvVar: 'USER_ONE_TEST_PAT',
  },
  test1: {
    home: 'https://test1.osf.io',
    api: 'https://api.test1.osf.io',
    files: 'https://files.us.test1.osf.io',
    cas: 'https://accounts.test1.osf.io',
    customInstitutionDomains: ['https://test1-osf-nd.cos.io'],
    addons: 'https://addons.test1.osf.io',
    addonTokenEnvVar: 'USER_ONE_TEST1_PAT',
  },
  test2: {
    home: 'https://test2.osf.io',
    api: 'https://api.test2.osf.io',
    files: 'https://files.us.test2.osf.io',
    cas: 'https://accounts.test2.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.test2.osf.io',
    addonTokenEnvVar: 'USER_ONE_TEST2_PAT',
  },
  test3: {
    home: 'https://test3.osf.io',
    api: 'https://api.test3.osf.io',
    files: 'https://files.us.test3.osf.io',
    cas: 'https://accounts.test3.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.test3.osf.io',
    addonTokenEnvVar: 'USER_ONE_TEST3_PAT',
  },
  test4: {
    home: 'https://test4.osf.io',
    api: 'https://api.test4.osf.io',
    files: 'https://files.us.test4.osf.io',
    cas: 'https://accounts.test4.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.test4.osf.io',
    addonTokenEnvVar: 'USER_ONE_TEST4_PAT',
  },
  uat1: {
    home: 'https://uat1.osf.io',
    api: 'https://api.uat1.osf.io',
    files: 'https://files.us.uat1.osf.io',
    cas: 'https://accounts.uat1.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.uat1.osf.io',
    addonTokenEnvVar: 'USER_ONE_UAT1_PAT',
  },
  prod: {
    home: 'https://osf.io',
    api: 'https://api.osf.io',
    files: 'https://files.osf.io',
    cas: 'https://accounts.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.osf.io',
    addonTokenEnvVar: 'USER_ONE_PAT',
  },
};

export function isEnvironmentName(value: string): value is EnvironmentName {
  return value in environments;
}
