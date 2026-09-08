export type EnvironmentName =
  | 'stage1'
  | 'stage2'
  | 'stage3'
  | 'stage4'
  | 'test'
  | 'test2'
  | 'test3'
  | 'test4'
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

// Mirrors the `domains` dict in the old settings.py, one to one.
export const environments: Record<EnvironmentName, EnvironmentConfig> = {
  stage1: {
    home: 'https://staging.osf.io',
    api: 'https://api.staging.osf.io',
    files: 'https://files.us.staging.osf.io',
    cas: 'https://accounts.staging.osf.io',
    customInstitutionDomains: ['https://staging-osf-nd.cos.io'],
    addons: 'https://addons.staging.osf.io',
    addonTokenEnvVar: 'USER_ONE_STAGE1_PAT',
  },
  stage2: {
    home: 'https://staging2.osf.io',
    api: 'https://api.staging2.osf.io',
    files: 'https://files.us.staging2.osf.io',
    cas: 'https://accounts.staging2.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.staging2.osf.io',
    addonTokenEnvVar: 'USER_ONE_STAGE2_PAT',
  },
  stage3: {
    home: 'https://staging3.osf.io',
    api: 'https://api.staging3.osf.io',
    files: 'https://files.us.staging3.osf.io',
    cas: 'https://accounts.staging3.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.staging3.osf.io',
    addonTokenEnvVar: 'USER_ONE_STAGE3_PAT',
  },
  stage4: {
    home: 'https://staging4.osf.io',
    api: 'https://api.staging4.osf.io',
    files: 'https://files.us.staging4.osf.io',
    cas: 'https://accounts.staging4.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.staging4.osf.io',
    addonTokenEnvVar: 'USER_ONE_STAGE4_PAT',
  },
  test: {
    home: 'https://test.osf.io',
    api: 'https://api.test.osf.io',
    files: 'https://files.us.test.osf.io',
    cas: 'https://accounts.test.osf.io',
    customInstitutionDomains: [],
    addons: 'https://addons.test.osf.io',
    addonTokenEnvVar: 'USER_ONE_TEST_PAT',
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
