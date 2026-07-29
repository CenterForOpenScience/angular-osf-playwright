import { test as base, expect, Page } from '@playwright/test';
import { faker, Faker } from '@faker-js/faker';

import * as settings from '../../config/settings';
import * as osfApi from '../api/osfApi';
import { OsfSession, createSession } from '../api/session';
import { acceptCookies, logout, safeLogin, safeLoginShort } from '../pages/LoginPage';

/**
 * Port of `tests/conftest.py`. Playwright's built-in `page` fixture stands in for the
 * old `driver` fixture (cross-browser selection now happens via playwright.config.ts
 * projects instead of `utils.launch_driver`), and `request`/API testing is available
 * out of the box, so those two are not reimplemented here.
 *
 * `defaultProjectPage` returns a minimal stub rather than a full `ProjectPage` port -
 * `pages/project.py` (~1600 lines) is out of scope for this login-suite migration
 * stage and should be ported separately when project-page tests are migrated.
 */
export interface ProjectPageStub {
  page: Page;
  guid: string;
}

type Fixtures = {
  session: OsfSession;
  checkCredentials: void;
  fake: Faker;
  waffledPages: void;
  hideFooterSlideIn: void;
  defaultLogout: void;
  mustBeLoggedIn: void;
  userLoggedIn: boolean;
  logInIfNotAlready: void;
  mustBeLoggedInAsUserTwo: void;
  mustBeLoggedInAsProfileUser: void;
  loginAsUserWithRegistrations: void;
  logInAsUserTwoIfNotAlready: void;
  mustBeLoggedInAsRegistrationUser: void;
  mustBeLoggedInAsAdminUser: void;
  mustBeLoggedInAsWriteUser: void;
  mustBeLoggedInAsReadUser: void;
  throttleOnProd: void;
  deleteUserProjectsAtSetup: void;
  defaultProject: osfApi.OsfProject;
  defaultProjectPage: ProjectPageStub;
  publicProject: osfApi.OsfProject;
  projectWithFile: osfApi.OsfProject;
  defaultProjectWithMetadata: osfApi.OsfProject;
  defaultProjectWithMetadataDescriptionLicense: osfApi.OsfProject;
  defaultProjectWithContributors: osfApi.OsfProject;
  defaultProjectWithAffiliations: osfApi.OsfProject;
  defaultProjectWithSubjects: osfApi.OsfProject;
  defaultProjectWithTags: osfApi.OsfProject;
  publicLinkProject: osfApi.OsfProject;
  defaultProjectWithAllMetadata: osfApi.OsfProject;
};

function getSessionCookieName(): string {
  if (settings.PRODUCTION) return 'osf';
  const host = settings.OSF_HOME.replace(/^https?:\/\//, '');
  const match = host.match(/^(.*)\.osf\.io/);
  return `osf_${match ? match[1] : settings.DOMAIN}`;
}

export const test = base.extend<Fixtures>({
  session: async ({}, use) => {
    const session = await createSession();
    await use(session);
    await session.dispose();
  },

  // Port of `check_credentials` (autouse). `pytest.exit` aborted the whole session on
  // failure; here we fail fast with a clear error on the current test instead.
  checkCredentials: [
    async ({ session }, use) => {
      try {
        await osfApi.currentUser(session);
      } catch (error) {
        throw new Error(`Your user credentials are incorrect. (${error})`);
      }
      await use();
    },
    { auto: true },
  ],

  fake: async ({}, use) => {
    await use(faker);
  },

  waffledPages: [
    async ({ session }, use) => {
      settings.runtime.emberPages = await osfApi.waffledPages(session);
      await use();
    },
    { auto: true },
  ],

  hideFooterSlideIn: async ({ page }, use) => {
    await page.evaluate(() => window.localStorage.setItem('slide', '0'));
    await use();
  },

  defaultLogout: [
    async ({ page }, use) => {
      await use();
      await logout(page).catch(() => undefined);
    },
    { auto: true },
  ],

  mustBeLoggedIn: async ({ page }, use) => {
    await safeLoginShort(page);
    await use();
  },

  userLoggedIn: async ({ page }, use) => {
    const cookieName = getSessionCookieName();
    const cookies = await page.context().cookies();
    await use(cookies.some((cookie) => cookie.name === cookieName));
  },

  logInIfNotAlready: async ({ page, userLoggedIn }, use) => {
    if (!userLoggedIn) {
      await safeLogin(page);
      await acceptCookies(page);
    }
    await use();
  },

  mustBeLoggedInAsUserTwo: async ({ page }, use) => {
    await safeLogin(page, settings.USER_TWO, settings.USER_TWO_PASSWORD);
    await acceptCookies(page);
    await use();
  },

  mustBeLoggedInAsProfileUser: async ({ page }, use) => {
    await safeLoginShort(page, settings.PROFILE_USER, settings.PROFILE_USER_PASSWORD);
    await use();
  },

  loginAsUserWithRegistrations: async ({ page }, use) => {
    await safeLogin(page, settings.REGISTRATIONS_USER, settings.REGISTRATIONS_USER_PASSWORD);
    await use();
  },

  logInAsUserTwoIfNotAlready: async ({ page, userLoggedIn }, use) => {
    if (!userLoggedIn) {
      await safeLogin(page, settings.USER_TWO, settings.USER_TWO_PASSWORD);
      await acceptCookies(page);
    }
    await use();
  },

  mustBeLoggedInAsRegistrationUser: async ({ page }, use) => {
    await safeLogin(page, settings.REGISTRATIONS_USER, settings.REGISTRATIONS_USER_PASSWORD);
    await acceptCookies(page);
    await use();
  },

  mustBeLoggedInAsAdminUser: async ({ page }, use) => {
    await safeLogin(page, settings.ADMIN_USER, settings.ADMIN_USER_PASSWORD);
    await acceptCookies(page);
    await use();
  },

  mustBeLoggedInAsWriteUser: async ({ page }, use) => {
    await safeLogin(page, settings.WRITE_USER, settings.WRITE_USER_PASSWORD);
    await acceptCookies(page);
    await use();
  },

  mustBeLoggedInAsReadUser: async ({ page }, use) => {
    await safeLogin(page, settings.READ_USER, settings.READ_USER_PASSWORD);
    await acceptCookies(page);
    await use();
  },

  throttleOnProd: async ({}, use) => {
    if (settings.PRODUCTION) {
      await new Promise((resolve) => setTimeout(resolve, settings.PROD_THROTTLE * 1000));
    }
    await use();
  },

  deleteUserProjectsAtSetup: async ({ session }, use) => {
    await osfApi.deleteAllUserProjects(session);
    await use();
  },

  defaultProject: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      await use(await osfApi.getNode(session));
      return;
    }
    const project = await osfApi.createProject(session, { title: 'OSF Test Project' });
    await use(project);
    try {
      await project.delete();
    } catch (error) {
      console.error('\n=== CLEANUP FAILED (IGNORED) ===');
      console.error(`Error: ${error}`);
    }
  },

  defaultProjectPage: async ({ page, defaultProject }, use) => {
    await use({ page, guid: defaultProject.id });
  },

  publicProject: async ({ session }, use) => {
    if (settings.PRODUCTION) {
      throw new Error('You should not create public projects on production!');
    }
    const project = await osfApi.createProject(session, {
      title: 'OSF Test Project',
      public: true,
    });
    await use(project);
    await project.delete();
  },

  projectWithFile: async ({ session, defaultProject }, use) => {
    if (settings.PREFERRED_NODE) {
      await osfApi.getExistingFile(session);
    } else {
      await osfApi.uploadFakeFile(session, defaultProject);
    }
    await use(defaultProject);
  },

  defaultProjectWithMetadata: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      const project = await osfApi.getNode(session);
      await osfApi.updateCustomProjectMetadata(session, project.id);
      await use(project);
      return;
    }
    const project = await osfApi.createProject(session, { title: 'OSF Test Project' });
    await osfApi.updateCustomProjectMetadata(session, project.id);
    await use(project);
    await project.delete();
  },

  defaultProjectWithMetadataDescriptionLicense: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      const project = await osfApi.getNode(session);
      await osfApi.updateCustomProjectMetadata(session, project.id);
      await use(project);
      return;
    }
    const project = await osfApi.createProject(session, {
      title: 'OSF Test Project',
      description: 'AQA test description',
    });
    await osfApi.updateCustomProjectMetadata(session, project.id);
    const { licenseId } = await osfApi.getLicenseDataForProvider(session, {
      providerType: 'registries',
      providerId: 'osf',
      licenseName: 'CC0 1.0 Universal',
    });
    await osfApi.updateNodeLicense(session, project.id, licenseId);
    await use(project);
    await project.delete();
  },

  defaultProjectWithContributors: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      const project = await osfApi.getNode(session);
      await osfApi.updateProjectWithContributors(session, project.id, 'OSF Tester1');
      await use(project);
      return;
    }
    const project = await osfApi.createProject(session, { title: 'OSF Test Project' });
    await osfApi.updateProjectWithContributors(session, project.id);
    await use(project);
    await project.delete();
  },

  defaultProjectWithAffiliations: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      const project = await osfApi.getNode(session);
      await osfApi.updateProjectWithAffiliations(session, project.id);
      await use(project);
      return;
    }
    const project = await osfApi.createProject(session, { title: 'OSF Test Project' });
    await osfApi.updateProjectWithAffiliations(session, project.id);
    await use(project);
    await project.delete();
  },

  defaultProjectWithSubjects: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      const project = await osfApi.getNode(session);
      await osfApi.updateProjectWithSubjects(session, project.id);
      await use(project);
      return;
    }
    const project = await osfApi.createProject(session, { title: 'OSF Test Project' });
    await osfApi.updateProjectWithSubjects(session, project.id);
    await use(project);
    await project.delete();
  },

  defaultProjectWithTags: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      const project = await osfApi.getNode(session);
      await osfApi.updateProjectWithTags(session, project.id);
      await use(project);
      return;
    }
    const project = await osfApi.createProject(session, { title: 'OSF Test Project' });
    await osfApi.updateProjectWithTags(session, project.id);
    await use(project);
    await project.delete();
  },

  publicLinkProject: async ({ session }, use) => {
    if (settings.PRODUCTION) {
      throw new Error('You should not create public projects on production!');
    }
    const project = await osfApi.createProject(session, {
      title: 'OSF Link Test Project',
      public: true,
    });
    await use(project);
    await project.delete();
  },

  defaultProjectWithAllMetadata: async ({ session }, use) => {
    if (settings.PREFERRED_NODE) {
      const project = await osfApi.getNode(session);
      await osfApi.updateProjectWithTags(session, project.id);
      await osfApi.updateCustomProjectMetadata(session, project.id);
      await osfApi.updateProjectWithContributors(session, project.id, 'OSF Tester');
      await osfApi.updateProjectWithAffiliations(session, project.id);
      await osfApi.updateProjectWithSubjects(session, project.id);
      await use(project);
      return;
    }
    const project = await osfApi.createProject(session, {
      title: 'OSF Test Project',
      description: 'AQA test description',
    });
    const { licenseId } = await osfApi.getLicenseDataForProvider(session, {
      providerType: 'registries',
      providerId: 'osf',
      licenseName: 'CC0 1.0 Universal',
    });
    await osfApi.updateNodeLicense(session, project.id, licenseId);
    await osfApi.updateProjectWithContributors(session, project.id);
    await osfApi.updateProjectWithAffiliations(session, project.id);
    await osfApi.updateProjectWithSubjects(session, project.id);
    await osfApi.updateProjectWithTags(session, project.id);
    await use(project);
    await project.delete();
  },
});

export { expect };
