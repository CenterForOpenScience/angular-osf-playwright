import { Page } from '@playwright/test';

import * as settings from '../config/settings';
import { test as base, expect } from '../src/fixtures';
import * as osfApi from '../src/api/osfApi';
import { OsfSession } from '../src/api/session';
import { logout, safeLoginShort } from '../src/pages/LoginPage';
import {
  AddContributorDialog,
  BrandedPreprintsDiscoverPage,
  PreprintDiscoverPage,
  PreprintEditPage,
  PreprintLandingPage,
  PreprintModerationPage,
  PreprintNewVersionPage,
  PreprintPage,
  PreprintProviderSelectPage,
  PreprintSubmitPage,
  PreprintWithdrawDialog,
  ReviewsDashboardPage,
  guidFromUrl,
  readContributorNames,
} from '../src/pages/PreprintPage';
import { clickExpectingDownload, clickExpectingPopup } from '../src/utils';


// The file the UI tests upload: no file on disk is needed, the file chooser takes
// the content directly (`PreprintSubmitPage.uploadFileFromComputer`).
const UPLOAD_FILE_NAME = 'selenium_preprint_test.txt';
const PROJECT_WITH_FILE_TITLE = 'OSF Reg Project with file fpp';
const PROJECT_FILE_NAME = 'osf selenium test file for preprints.txt';

// The Selenium moderation providers must exist in every test environment, with
// USER_ONE as their moderator.
const PRE_MODERATION = { id: 'selpremod', name: 'Selenium Pre-moderation' };
const POST_MODERATION = { id: 'selpostmod', name: 'Selenium Post-moderation' };

const PENDING_PRE_MODERATION_BANNER =
  'Pending: Selenium Pre-moderation uses pre-moderation. This preprint is not publicly ' +
  'available or searchable until approved by a moderator.';
const REJECTED_PRE_MODERATION_BANNER =
  'Rejected: Selenium Pre-moderation uses pre-moderation. This preprint has been ' +
  'rejected by a moderator and is not publicly available or searchable.';
const PENDING_POST_MODERATION_BANNER =
  'Pending: Selenium Post-moderation uses post-moderation. This preprint is publicly ' +
  'available and searchable but is subject to removal by a moderator.';

// The workflow, moderation and overview tests walk several multi-step forms and make
// several API calls each - well past the default per-test budget.
const LONG_FLOW_TIMEOUT_MS = 180_000;

const test = base.extend<{
  landingPage: PreprintLandingPage;
  projectWithFileReg: osfApi.OsfProject;
  preprintGuid: string;
  preprintDetailPage: PreprintPage;
  userTwoSession: OsfSession;
}>({
  /** Port of the module-level `landing_page` fixture. */
  landingPage: async ({ page }, use) => {
    const landingPage = new PreprintLandingPage(page);
    await landingPage.goto();
    await landingPage.verify();
    await use(landingPage);
  },

  /** Port of `project_with_file_reg` - a USER_ONE project with a file, deleted afterwards. */
  projectWithFileReg: async ({ session }, use) => {
    const project = await osfApi.createProject(session, { title: PROJECT_WITH_FILE_TITLE });
    await osfApi.uploadFakeFile(session, project, PROJECT_FILE_NAME);
    await use(project);
    await project.delete().catch((error) => {
      console.error('\n=== CLEANUP FAILED (IGNORED) ===');
      console.error(`Error: ${error}`);
    });
  },

  /**
   * The preprint behind `preprint_detail_page` - a pending preprint on the
   * pre-moderation provider. `Preprint Overview` overrides it for its own tests.
   */
  preprintGuid: async ({ session }, use) => {
    await use(
      await osfApi.createPreprint(session, {
        providerId: PRE_MODERATION.id,
        title: 'OSF Selenium Preprint',
      })
    );
  },

  /** Port of `preprint_detail_page` - opens the `preprintGuid` preprint's detail page. */
  preprintDetailPage: async ({ page, preprintGuid }, use) => {
    const detailPage = new PreprintPage(page, preprintGuid);
    await detailPage.goto();
    await detailPage.verify();
    await use(detailPage);
  },

  /** Port of `osf_api.get_user_two_session()` - USER_TWO submits the moderated preprints. */
  userTwoSession: async ({}, use) => {
    const userTwoSession = await osfApi.getUserTwoSession();
    await use(userTwoSession);
    await userTwoSession.dispose();
  },
});

/** Port of the "accept via the API, then reload the detail page" step most workflow tests start with. */
async function acceptAndReload(detailPage: PreprintPage, guid: string): Promise<void> {
  await osfApi.acceptModeratedPreprint(guid);
  await detailPage.goto();
  await detailPage.verify();
}

/**
 * Creates a new version through the UI, uploading a file from the computer, and
 * returns the new version's guid (`<guid>_v2`) once its detail page shows it.
 */
async function createNewVersionFromComputer(page: Page, detailPage: PreprintPage): Promise<string> {
  await detailPage.createNewVersionButton.click();
  const versionPage = await PreprintNewVersionPage.expectOn(page);
  await versionPage.uploadFileFromComputer(UPLOAD_FILE_NAME);
  await versionPage.goToNextStep('Consent To Publish');
  await versionPage.button('Submit').click();
  await expect(detailPage.doiVersion).toHaveText('Version: 2');
  return guidFromUrl(page.url());
}

/**
 * The shared body of `test_edit_preprint` / `test_edit_new_preprint_version`: change
 * the title and abstract, add a subject and a tag, submit, and check the detail page.
 */
async function editTitleAbstractAndSubject(
  page: Page,
  detailPage: PreprintPage,
  tag: string
): Promise<void> {
  await detailPage.editButton.click();
  const editPage = await PreprintEditPage.openLoaded(page);
  await editPage.titleInput.fill('Selenium Preprint Edit');
  await editPage.abstractInput.fill('Testing Selenium Abstract edit');
  await editPage.goToNextStep('Metadata');
  await editPage.selectTopLevelSubject('Education');
  await expect(editPage.selectedSubject('Education')).toBeVisible();
  await editPage.tagsInput.fill(tag);
  await editPage.tagsInput.press('Enter');
  await editPage.goToNextStep('Author Assertions');
  await editPage.goToNextStep('Supplements (optional)');
  await editPage.goToNextStep('Consent To Publish');
  await editPage.button('Submit').click();

  await detailPage.verify();
  await expect(detailPage.title).toHaveText('Selenium Preprint Edit');
  await expect(detailPage.abstract).toContainText('Testing Selenium Abstract edit');
  await expect(detailPage.subjects.filter({ hasText: /^\s*Education\s*$/ })).toHaveCount(1);
}

/** Withdraw through the detail page's Withdraw dialog. */
async function requestWithdrawal(page: Page, detailPage: PreprintPage): Promise<void> {
  await detailPage.withdrawButton.click();
  const withdrawDialog = new PreprintWithdrawDialog(page);
  await withdrawDialog.reasonInput.fill(`OSF Selenium Test: ${test.info().title}`);
  await expect(withdrawDialog.withdrawButton).toBeEnabled();
  await withdrawDialog.withdrawButton.click();
  await expect(withdrawDialog.root).toBeHidden();
}

/** Accepts a preprint's withdrawal request through the API, as the provider's moderator. */
async function acceptWithdrawalRequest(guid: string): Promise<void> {
  // The request was just made through the UI - wait until the API lists it.
  let requestId = '';
  await expect
    .poll(async () => (requestId = await osfApi.getPreprintRequestId(guid)), {
      message: `withdrawal request of ${guid} listed`,
    })
    .not.toBe('');
  await osfApi.acceptWithdrawPreprint(requestId);
}

/** Checks the `machine_state` of a preprint's withdrawal request record in the API. */
async function expectWithdrawalRequestState(guid: string, machineState: string): Promise<void> {
  const requests = await osfApi.getPreprintRequestsRecords(guid);
  expect(requests, `No Requests records found for preprint: ${guid}`).not.toHaveLength(0);
  const withdrawal = requests.find((request) => request.attributes.request_type === 'withdrawal');
  expect(withdrawal, `Withdrawal Request record was not found for preprint: ${guid}`).toBeDefined();
  expect(withdrawal.attributes.machine_state).toBe(machineState);
}

test.describe('Preprint Workflow', () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
    test.setTimeout(LONG_FLOW_TIMEOUT_MS);
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  test('create preprint from landing', async ({ page, landingPage }) => {
    // Python also picked 'Selenium Pre-moderation' on test1, an environment this
    // project doesn't define.
    const providerName = settings.STAGE4 || settings.TEST4 ? 'PsyArXiv' : 'AfricArXiv';

    await landingPage.addPreprintButton.click();
    const selectProviderPage = await PreprintProviderSelectPage.expectOn(page);
    await selectProviderPage.selectProvider(providerName);
    await selectProviderPage.nextButton.click();
    const submitPage = await PreprintSubmitPage.expectOn(page);

    // Title and Abstract
    await submitPage.titleInput.fill('Selenium Test Preprint');
    await submitPage.abstractInput.fill('Center for Open Selenium');
    await submitPage.goToNextStep('File');

    // File
    await submitPage.uploadFileFromComputer(UPLOAD_FILE_NAME);
    await submitPage.goToNextStep('Metadata');

    // Metadata - the license list order differs between environments, so select by name.
    await submitPage.selectLicense('CC0 1.0 Universal');
    await submitPage.selectTopLevelSubject('Engineering');
    await expect(submitPage.selectedSubject('Engineering')).toHaveText('Engineering');
    await submitPage.tagsInput.fill('selenium');
    await submitPage.tagsInput.press('Enter');
    await submitPage.goToNextStep('Author Assertions');

    // Author Assertions - each answer reveals its own text box.
    await submitPage.conflictOfInterestYes.check();
    await expect(submitPage.conflictOfInterestInput).toBeEditable();
    await submitPage.conflictOfInterestInput.fill('QA Testing');
    await submitPage.publicDataAvailable.check();
    await expect(submitPage.publicDataInput).toBeVisible();
    await submitPage.publicDataInput.fill('https://osf.io/');
    await submitPage.preregistrationUnavailable.check();
    await expect(submitPage.preregistrationInput).toBeEditable();
    await submitPage.preregistrationInput.fill('QA Testing');
    await expect(submitPage.nextButton).toBeEnabled();
    await submitPage.goToNextStep('Supplements (optional)');
  });

  test('edit preprint', async ({ page, preprintDetailPage }) => {
    await editTitleAbstractAndSubject(page, preprintDetailPage, test.info().title);
  });

  test('withdraw preprint', async ({ page, preprintGuid, preprintDetailPage }) => {
    await acceptAndReload(preprintDetailPage, preprintGuid);
    await requestWithdrawal(page, preprintDetailPage);
    await acceptWithdrawalRequest(preprintGuid);
    await preprintDetailPage.goto();
    await preprintDetailPage.verify();
    await expect(preprintDetailPage.withdrawnBanner).toBeVisible();

    // The API's withdrawal request record must now be accepted.
    await expectWithdrawalRequestState(preprintGuid, 'accepted');
  });

  test('create new preprint version upload from computer', async ({
    page,
    preprintGuid,
    preprintDetailPage,
  }) => {
    await acceptAndReload(preprintDetailPage, preprintGuid);
    await createNewVersionFromComputer(page, preprintDetailPage);
    expect(await preprintDetailPage.getPreprintVersions()).toHaveLength(2);
  });

  test('create new preprint cancel upload from computer', async ({
    page,
    preprintGuid,
    preprintDetailPage,
    projectWithFileReg,
  }) => {
    void projectWithFileReg;
    await acceptAndReload(preprintDetailPage, preprintGuid);
    await preprintDetailPage.createNewVersionButton.click();
    const versionPage = await PreprintNewVersionPage.expectOn(page);
    await versionPage.button('Upload From Your Computer').click();
    await versionPage.button('Cancel').click();
    await versionPage.selectFileFromExistingProject(PROJECT_WITH_FILE_TITLE, PROJECT_FILE_NAME);
    await versionPage.goToNextStep('Consent To Publish');
    await versionPage.button('Submit').click();
    await expect(preprintDetailPage.doiVersion).toHaveText('Version: 2');
    expect(await preprintDetailPage.getPreprintVersions()).toHaveLength(2);
  });

  test('edit new preprint version', async ({ page, preprintGuid, preprintDetailPage }) => {
    await acceptAndReload(preprintDetailPage, preprintGuid);
    await createNewVersionFromComputer(page, preprintDetailPage);
    await editTitleAbstractAndSubject(page, preprintDetailPage, test.info().title);
  });

  test('withdraw new preprint version', async ({ page, preprintGuid, preprintDetailPage }) => {
    await acceptAndReload(preprintDetailPage, preprintGuid);
    const versionGuid = await createNewVersionFromComputer(page, preprintDetailPage);
    await osfApi.acceptModeratedPreprint(versionGuid);
    await page.reload();
    await preprintDetailPage.verify();
    await requestWithdrawal(page, preprintDetailPage);
    await acceptWithdrawalRequest(versionGuid);
    await page.reload();
    await preprintDetailPage.verify();
    await expect(preprintDetailPage.withdrawnBanner).toBeVisible();
  });

  test('reject resubmit initial preprint', async ({ page, preprintGuid, preprintDetailPage }) => {
    await osfApi.rejectModeratedPreprint(preprintGuid);
    await preprintDetailPage.goto();
    await expect(preprintDetailPage.statusBanner).toHaveText(REJECTED_PRE_MODERATION_BANNER);

    await preprintDetailPage.button('Edit And Resubmit').click();
    const editPage = await PreprintEditPage.openLoaded(page);
    await editPage.titleInput.fill('Selenium Preprint Edit');
    await editPage.abstractInput.fill('Testing Selenium Abstract edit');
    // Unlike a plain Edit, resubmitting also has the File step.
    await editPage.goToNextStep('File');
    await editPage.goToNextStep('Metadata');
    await editPage.goToNextStep('Author Assertions');
    await editPage.goToNextStep('Supplements (optional)');
    await editPage.goToNextStep('Consent To Publish');
    await editPage.button('Submit').click();

    await preprintDetailPage.verify();
    await expect(preprintDetailPage.title).toHaveText('Selenium Preprint Edit');
    await expect(preprintDetailPage.abstract).toContainText('Testing Selenium Abstract edit');
    await expect(preprintDetailPage.statusBanner).toHaveText(PENDING_PRE_MODERATION_BANNER);
  });

  test('withdraw new version post moderated', async ({ page, session }) => {
    const preprintGuid = await osfApi.createPreprint(session, {
      providerId: POST_MODERATION.id,
      title: 'OSF Selenium Post-Moderation Preprint',
    });
    // A post-moderated preprint is published on submission, pending review.
    await expectPublishAndReviewStates(preprintGuid, true, 'pending');

    const detailPage = new PreprintPage(page, preprintGuid);
    await detailPage.goto();
    await expect(detailPage.statusBanner).toHaveText(PENDING_POST_MODERATION_BANNER);
    await expect(detailPage.createNewVersionButton).toBeVisible();

    const versionGuid = await createNewVersionFromComputer(page, detailPage);
    await osfApi.acceptModeratedPreprint(versionGuid);
    await page.reload();
    await detailPage.verify();
    await requestWithdrawal(page, detailPage);
    await acceptWithdrawalRequest(versionGuid);
    await page.reload();
    await detailPage.verify();
    await expect(detailPage.withdrawnBanner).toBeVisible();
  });

  test('withdraw pending preprint', async ({ page, preprintDetailPage }) => {
    await requestWithdrawal(page, preprintDetailPage);
    await page.reload();
    await preprintDetailPage.verify();
    await expect(preprintDetailPage.withdrawnBanner).toBeVisible();
  });

  test('delete new version preprint draft', async ({ page, preprintGuid, preprintDetailPage }) => {
    await acceptAndReload(preprintDetailPage, preprintGuid);
    await preprintDetailPage.createNewVersionButton.click();
    const versionPage = await PreprintNewVersionPage.expectOn(page);
    await versionPage.uploadFileFromComputer(UPLOAD_FILE_NAME);
    await expect(versionPage.button('Delete')).toBeVisible();
    await versionPage.button('Delete').click();
    const confirmDialog = page.getByRole('alertdialog', { name: 'Delete Preprint Draft' });
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(confirmDialog).toBeHidden();

    await preprintDetailPage.goto();
    await expect(preprintDetailPage.doiVersion).toHaveText('Version: 1');
    expect(await preprintDetailPage.getPreprintVersions()).toHaveLength(1);
  });

  test('download new version preprint', async ({ page, preprintGuid, preprintDetailPage }) => {
    await acceptAndReload(preprintDetailPage, preprintGuid);
    const versionGuid = await createNewVersionFromComputer(page, preprintDetailPage);
    await osfApi.acceptModeratedPreprint(versionGuid);
    await page.reload();
    await preprintDetailPage.verify();

    const download = await clickExpectingDownload(page, preprintDetailPage.downloadButton);
    expect(download.suggestedFilename()).toBe(UPLOAD_FILE_NAME);
  });

  test('reject new version preprint', async ({ page, preprintGuid, preprintDetailPage }) => {
    await acceptAndReload(preprintDetailPage, preprintGuid);
    const versionGuid = await createNewVersionFromComputer(page, preprintDetailPage);
    await osfApi.rejectModeratedPreprint(versionGuid);
    await page.reload();
    await expect(preprintDetailPage.statusBanner).toHaveText(REJECTED_PRE_MODERATION_BANNER);
  });
});

/**
 * Opens a provider's moderation page from My Reviewing, optionally switches to the
 * Withdrawal Request tab, and opens the given preprint in the new tab the app opens
 * for it. The list is sorted newest first, so the item is the preprint just created -
 * checked against the guid in the opened tab's URL.
 */
async function openForModeration(
  page: Page,
  providerName: string,
  preprintTitle: string,
  preprintGuid: string,
  { withdrawalRequests = false } = {}
): Promise<Page> {
  const dashboardPage = new ReviewsDashboardPage(page);
  await dashboardPage.goto();
  await dashboardPage.verify();
  await dashboardPage.submissionsButton(providerName).click();
  const moderationPage = await PreprintModerationPage.expectOn(page);
  await expect(moderationPage.pendingFilter).toBeVisible();
  if (withdrawalRequests) {
    await moderationPage.withdrawalRequestsTab.click();
    await expect(moderationPage.withdrawalRequestsTab).toHaveAttribute('aria-selected', 'true');
  }
  const moderatorTab = await moderationPage.openItem(preprintTitle);
  await expect(moderatorTab).toHaveURL(new RegExp(`/${preprintGuid}\\?mode=moderator`));
  await expect(new PreprintPage(moderatorTab).makeDecisionButton).toBeVisible();
  return moderatorTab;
}

/** Picks a decision, fills in the text box it shows, and submits it. */
async function submitDecision(moderatorTab: Page, decision: string, comment: string): Promise<void> {
  const detailPage = new PreprintPage(moderatorTab);
  await detailPage.waitUntilLoaded();
  await detailPage.makeDecisionButton.click();
  await detailPage.decisionOption(decision).check();
  await detailPage.decisionComment.fill(comment);
  await detailPage.submitDecisionButton.click();
  // Submitting returns the moderator's tab to the provider's moderation page.
  await PreprintModerationPage.expectOn(moderatorTab);
}

/**
 * Port of the `get_preprint_publish_and_review_states` asserts. Python checked the
 * published flag with `assert` / `assert not`, and the API returns `null` rather than
 * `false` for a withdrawn preprint, so it's compared by truthiness here too.
 */
async function expectPublishAndReviewStates(
  guid: string,
  published: boolean,
  reviewState?: string
): Promise<void> {
  const [isPublished, reviewsState] = await osfApi.getPreprintPublishAndReviewStates(guid);
  expect(Boolean(isPublished), 'published').toBe(published);
  if (reviewState !== undefined) expect(reviewsState).toBe(reviewState);
}

/** Logs out and opens a preprint's public detail page. */
async function openAsLoggedOut(page: Page, preprintGuid: string): Promise<PreprintPage> {
  await logout(page);
  const detailPage = new PreprintPage(page, preprintGuid);
  await detailPage.goto();
  await detailPage.verify();
  return detailPage;
}

test.describe('Preprint Moderation', () => {
  test.beforeEach(async () => {
    test.setTimeout(LONG_FLOW_TIMEOUT_MS);
    test.skip(settings.PRODUCTION, 'Test should not run on production');
  });

  // USER_TWO submits the preprints (through the API) so that the submitter is not the
  // moderator, USER_ONE.

  test('accept pre moderated preprint', async ({ page, mustBeLoggedIn, userTwoSession }) => {
    void mustBeLoggedIn;
    const title = 'OSF Selenium Pre-Moderation Preprint AQA';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: PRE_MODERATION.id, title });
    await expectPublishAndReviewStates(guid, false, 'pending');

    const moderatorView = await openForModeration(page, PRE_MODERATION.name, title, guid);
    await submitDecision(moderatorView, 'Accept submission', 'Selenium Testing - Accepting Pre-Moderated Preprint');
    await expectPublishAndReviewStates(guid, true, 'accepted');

    // Now public, so visible logged out.
    const publicView = await openAsLoggedOut(page, guid);
    await expect(publicView.title).toHaveText(title);
    expect(page.url()).toContain(PRE_MODERATION.id);
  });

  test('reject pre moderated preprint', async ({ page, logInIfNotAlready, userTwoSession }) => {
    void logInIfNotAlready;
    const title = 'OSF Selenium Pre-Moderation Preprint AQA';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: PRE_MODERATION.id, title });
    await expectPublishAndReviewStates(guid, false, 'pending');

    const moderatorView = await openForModeration(page, PRE_MODERATION.name, title, guid);
    await submitDecision(moderatorView, 'Reject submission', 'Selenium Testing - Rejecting Pre-Moderated Preprint');
    // A pending pre-moderated preprint is already unpublished - only the review state
    // shows that the rejection happened.
    await expectPublishAndReviewStates(guid, false, 'rejected');

    // A rejected preprint isn't public: logged out, the app sends you to its
    // "forbidden" page instead of the preprint.
    await logout(page);
    await page.goto(new PreprintPage(page, guid).url as string);
    await expect(
      page.getByRole('heading', { name: "You Don't Have Permission To Perform This Action" })
    ).toBeVisible();
    expect(page.url()).not.toContain(PRE_MODERATION.id);
  });

  test('approve withdrawal request pre moderated preprint', async ({
    page,
    logInIfNotAlready,
    userTwoSession,
  }) => {
    void logInIfNotAlready;
    const title = 'OSF Selenium Pre-Moderation Preprint AQA';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: PRE_MODERATION.id, title });
    await osfApi.acceptModeratedPreprint(guid);
    await osfApi.createPreprintWithdrawalRequest(userTwoSession, guid);

    const moderatorView = await openForModeration(page, PRE_MODERATION.name, title, guid, {
      withdrawalRequests: true,
    });
    await expect(new PreprintPage(moderatorView).statusBanner).toContainText('Pending:');
    await submitDecision(
      moderatorView,
      'Approve withdrawal',
      'Selenium Testing - Approving Withdrawal Request of Pre-Moderated Preprint'
    );
    await expectPublishAndReviewStates(guid, false, 'withdrawn');

    // Logged out, the preprint is now a withdrawn tombstone page.
    const publicView = await openAsLoggedOut(page, guid);
    // TODO: also check for "This preprint has been withdrawn." after [ENG-5092] is fixed.
    await expect(publicView.withdrawReason).toBeVisible();
  });

  test('decline withdrawal request pre moderated preprint', async ({
    page,
    logInIfNotAlready,
    userTwoSession,
  }) => {
    void logInIfNotAlready;
    const title = 'OSF Selenium Pre-moderation Preprint';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: PRE_MODERATION.id, title });
    await osfApi.acceptModeratedPreprint(guid);
    await osfApi.createPreprintWithdrawalRequest(userTwoSession, guid);

    const moderatorView = await openForModeration(page, PRE_MODERATION.name, title, guid, {
      withdrawalRequests: true,
    });
    await expect(new PreprintPage(moderatorView).statusBanner).toContainText('Pending:');
    await submitDecision(
      moderatorView,
      'Decline withdrawal',
      'Selenium Testing - Declining Withdrawal Request of Pre-Moderated Preprint'
    );
    // The preprint was already published and accepted - only the request's own state
    // shows that the decline happened.
    await expectWithdrawalRequestState(guid, 'rejected');
    await expectPublishAndReviewStates(guid, true, 'accepted');

    // Still public.
    await openAsLoggedOut(page, guid);
    expect(page.url()).toContain(PRE_MODERATION.id);
  });

  test('accept post moderated preprint', async ({ page, logInIfNotAlready, userTwoSession }) => {
    void logInIfNotAlready;
    const title = 'OSF Selenium Post-Moderation Preprint';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: POST_MODERATION.id, title });
    await expectPublishAndReviewStates(guid, true, 'pending');

    const moderatorView = await openForModeration(page, POST_MODERATION.name, title, guid);
    await expect(new PreprintPage(moderatorView).statusBanner).toContainText('Pending:');
    await submitDecision(moderatorView, 'Accept submission', 'Selenium Testing - Accepting Post-Moderated Preprint');
    await expectPublishAndReviewStates(guid, true, 'accepted');

    const publicView = await openAsLoggedOut(page, guid);
    await expect(publicView.title).toHaveText(title);
    expect(page.url()).toContain(POST_MODERATION.id);
  });

  test('moderator withdrawal post moderated preprint', async ({
    page,
    logInIfNotAlready,
    userTwoSession,
  }) => {
    void logInIfNotAlready;
    const title = 'OSF Selenium Post-Moderation Preprint';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: POST_MODERATION.id, title });
    await expectPublishAndReviewStates(guid, true, 'pending');

    const moderatorView = await openForModeration(page, POST_MODERATION.name, title, guid);
    await expect(new PreprintPage(moderatorView).statusBanner).toContainText('Pending:');
    await submitDecision(
      moderatorView,
      'Withdraw submission',
      'Selenium Testing - Withdrawal by Moderator of a Post-Moderated Preprint'
    );
    await expectPublishAndReviewStates(guid, false, 'withdrawn');

    const publicView = await openAsLoggedOut(page, guid);
    await expect(publicView.title).toContainText(title);
    // TODO: also check for "This preprint has been withdrawn." after [ENG-5092] is fixed.
    await expect(publicView.withdrawReason).toBeVisible();
  });

  test('approve withdrawal request post moderated preprint', async ({
    page,
    logInIfNotAlready,
    userTwoSession,
  }) => {
    void logInIfNotAlready;
    const title = 'OSF Selenium Post-moderation Preprint';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: POST_MODERATION.id, title });
    await osfApi.acceptModeratedPreprint(guid);
    await osfApi.createPreprintWithdrawalRequest(userTwoSession, guid);

    const moderatorView = await openForModeration(page, POST_MODERATION.name, title, guid, {
      withdrawalRequests: true,
    });
    await expect(new PreprintPage(moderatorView).statusBanner).toContainText('Pending:');
    await submitDecision(
      moderatorView,
      'Approve withdrawal',
      'Selenium Testing - Approving Withdrawal Request of Post-Moderated Preprint'
    );
    await expectPublishAndReviewStates(guid, false, 'withdrawn');

    const publicView = await openAsLoggedOut(page, guid);
    // TODO: also check for "This preprint has been withdrawn." after [ENG-5092] is fixed.
    await expect(publicView.withdrawReason).toBeVisible();
  });

  test('decline withdrawal request post moderated preprint', async ({
    page,
    logInIfNotAlready,
    userTwoSession,
  }) => {
    void logInIfNotAlready;
    const title = 'OSF Selenium Post-moderation Preprint';
    const guid = await osfApi.createPreprint(userTwoSession, { providerId: POST_MODERATION.id, title });
    await osfApi.acceptModeratedPreprint(guid);
    await osfApi.createPreprintWithdrawalRequest(userTwoSession, guid);

    const moderatorView = await openForModeration(page, POST_MODERATION.name, title, guid, {
      withdrawalRequests: true,
    });
    await expect(new PreprintPage(moderatorView).statusBanner).toContainText('Pending:');
    await submitDecision(
      moderatorView,
      'Decline withdrawal',
      'Selenium Testing - Declining Withdrawal Request of Post-Moderated Preprint'
    );
    // As in the pre-moderation test, only the request's own state shows the decline.
    await expectWithdrawalRequestState(guid, 'rejected');
    await expectPublishAndReviewStates(guid, true, 'accepted');

    await openAsLoggedOut(page, guid);
    expect(page.url()).toContain(POST_MODERATION.id);
  });
});

test.describe('Preprint Search', { tag: '@core' }, () => {
  test('search results exist', { tag: '@smoke' }, async ({ page, landingPage }) => {
    const response = page.waitForResponse((res) => res.url().includes('index-card-search'));
    await landingPage.searchInput.fill('1');
    await landingPage.searchInput.press('Enter');
    const discoverPage = await PreprintDiscoverPage.expectOn(page);
    await response;
    await expect(discoverPage.searchResults.first()).toBeVisible();
  });

  test('preprint detail page', async ({ page }) => {
    const discoverPage = new PreprintDiscoverPage(page);
    await discoverPage.goto();
    await discoverPage.verify();
    // Python searched for the environment's host here, because all test environments
    // share one SHARE server. The app now filters every search by the environment
    // itself (`cardSearchFilter[accessService]`), and the host text matches nothing.
    if (settings.STAGE2) {
      // Stage 2 lists old preprints that no longer have detail pages - newest first.
      await discoverPage.applySort(discoverPage.sortByDateCreatedNewest, '-dateCreated');
    }
    await expect(discoverPage.searchResults.first()).toBeVisible();
    const detailTab = await clickExpectingPopup(page, discoverPage.firstSearchResultTitle);
    await PreprintPage.expectOn(detailTab);
  });
});

test.describe('Preprint Metrics', { tag: ['@smoke', '@core'] }, () => {
  /** Port of the session-scoped `latest_preprint_node` fixture. */
  let latestPreprintGuid: string;

  test.beforeEach(async () => {
    if (!latestPreprintGuid) {
      const guid = await osfApi.getMostRecentPreprintNodeId();
      if (!guid) throw new Error('No published preprint found');
      latestPreprintGuid = guid;
    }
  });

  test('preprint views count', async ({ page }) => {
    const apiViewsBefore = await osfApi.getPreprintViewsCount(latestPreprintGuid);
    const detailPage = new PreprintPage(page, latestPreprintGuid);
    await detailPage.goto();
    await detailPage.verify();
    const uiViewsBefore = await PreprintPage.readCount(detailPage.viewsCount);

    // Not reloaded on production, so as not to inflate the metrics there.
    if (!settings.PRODUCTION) {
      // The first load above counts one view, but the count (the same API metric the
      // page shows) can lag behind it - reloading before it lands shows +0. Wait for it:
      // on uat1 it was still uncounted 30s after the load.
      test.setTimeout(LONG_FLOW_TIMEOUT_MS);
      await expect
        .poll(() => osfApi.getPreprintViewsCount(latestPreprintGuid), {
          message: 'the first page load is counted as a view',
          timeout: 90_000,
        })
        .toBeGreaterThan(apiViewsBefore);
      // The reload counts a second view, but the API may not have caught up with it
      // yet - so only check that it went up.
      await detailPage.goto();
      await detailPage.verify();
      const uiViewsAfter = await PreprintPage.readCount(detailPage.viewsCount);
      const apiViewsAfter = await osfApi.getPreprintViewsCount(latestPreprintGuid);
      expect(uiViewsAfter).toBe(uiViewsBefore + 1);
      expect(apiViewsAfter).toBeGreaterThan(apiViewsBefore);
    }
  });

  test('preprint downloads count', async ({ page }) => {
    const detailPage = new PreprintPage(page, latestPreprintGuid);
    await detailPage.goto();
    await detailPage.verify();
    const uiDownloadsBefore = await PreprintPage.readCount(detailPage.downloadsCount);
    const apiDownloadsBefore = await osfApi.getPreprintDownloadsCount(latestPreprintGuid);
    expect(apiDownloadsBefore).toBe(uiDownloadsBefore);

    // Not downloaded on production, so as not to inflate the metrics there.
    if (!settings.PRODUCTION) {
      await clickExpectingDownload(page, detailPage.downloadButton);
      await detailPage.goto();
      await detailPage.verify();
      const uiDownloadsAfter = await PreprintPage.readCount(detailPage.downloadsCount);
      const apiDownloadsAfter = await osfApi.getPreprintDownloadsCount(latestPreprintGuid);
      expect(apiDownloadsAfter).toBe(apiDownloadsBefore + 1);
      expect(uiDownloadsAfter).toBe(uiDownloadsBefore + 1);
    }
  });
});

// One test per provider, like pytest's `@pytest.fixture(params=get_providers())`.
// Playwright collects tests synchronously, so the list is fetched synchronously too
// (see `osfApi.getPreprintProvidersSync`).
let providers: osfApi.PreprintProvider[] = [];
let providersError: Error | undefined;
try {
  providers = osfApi.getPreprintProvidersSync();
} catch (error) {
  providersError = error as Error;
}

test.describe('Providers With Custom Domains', { tag: '@core' }, () => {
  const customProviders = providers.filter((provider) => provider.domainRedirectEnabled);

  /**
   * Registers one test per custom-domain provider. With none (no test environment has
   * one), pytest still collects each test once, as a skipped `[NOTSET]` - kept here
   * so both suites count the same tests.
   */
  function forEachCustomProvider(
    name: string,
    body: (page: Page, provider: osfApi.PreprintProvider) => Promise<void>,
    loggedIn = false
  ): void {
    if (providersError) {
      test(name, () => {
        throw providersError;
      });
      return;
    }
    if (!customProviders.length) {
      test(`${name} [NOTSET]`, () => {
        test.skip(true, 'No preprint provider has a custom domain in this environment');
      });
      return;
    }
    for (const provider of customProviders) {
      test(`${name} [${provider.id}]`, async ({ page }) => {
        // `must_be_logged_in` - a fixture can't be made conditional in a shared loop.
        if (loggedIn) await safeLoginShort(page);
        await body(page, provider);
      });
    }
  }

  forEachCustomProvider('landing page loads', async (page, provider) => {
    const landingPage = new PreprintLandingPage(page, provider);
    await landingPage.goto();
    await landingPage.verify();
  });

  forEachCustomProvider('discover page loads', async (page, provider) => {
    const discoverPage = new BrandedPreprintsDiscoverPage(page, provider);
    await discoverPage.goto();
    await discoverPage.verify();
  });

  forEachCustomProvider(
    'submit page loads',
    async (page, provider) => {
      if (provider.allowSubmissions) {
        const submitPage = new PreprintSubmitPage(page, provider);
        await submitPage.goto();
        await submitPage.verify();
      } else {
        const landingPage = new PreprintLandingPage(page, provider);
        await landingPage.goto();
        await landingPage.verify();
        await expect(landingPage.addPreprintButton).toBeHidden();
      }
    },
    true
  );
});

test.describe('Branded Providers', { tag: '@smoke' }, () => {
  // Only on production: most branded providers in the test environments have no preprints.
  test.beforeEach(async ({ throttleOnProd }) => {
    void throttleOnProd;
    test.skip(
      !settings.PRODUCTION,
      'Most of the Branded Preprint Provider pages in test environments have no preprints'
    );
  });

  if (providersError) {
    test('detail page', () => {
      throw providersError;
    });
  }

  // These providers' preprints link off OSF, so their discover pages aren't checked.
  const providersLeavingOsf = ['ecoevorxiv', 'engrxiv', 'livedata', 'osf'];

  for (const provider of providers) {
    test(`detail page [${provider.id}]`, async ({ page, session, browserName }) => {
      // The arabixiv discover page is too big for Firefox without a query.
      const query = browserName === 'firefox' && provider.id === 'arabixiv' ? '?q=Analysis' : '';
      const discoverPage = new BrandedPreprintsDiscoverPage(page, provider, query);
      if (providersLeavingOsf.includes(provider.id)) return;

      await page
        .context()
        .addCookies([{ name: 'osf_cookieconsent', value: '1', url: settings.OSF_HOME }]);
      await discoverPage.goto();
      await discoverPage.verify();

      if (await osfApi.getProvidersTotal(session, provider.id)) {
        const firstPreprint = discoverPage.resultTitleLinks.first();
        await expect(firstPreprint).toBeVisible();
        const href = (await firstPreprint.getAttribute('href')) ?? '';
        const match = href.match(/^https:\/\/osf\.io\/([a-z0-9]{5})/);
        expect(match, `Unexpected preprint link: ${href}`).not.toBeNull();
        const preprintGuid = (match as RegExpMatchArray)[1];

        const detailTab = await clickExpectingPopup(page, firstPreprint);
        await PreprintPage.expectOn(detailTab);
        expect(detailTab.url()).toContain(provider.id);
        expect(detailTab.url()).toContain(preprintGuid);
      } else if (!provider.additionalProviders.length) {
        await expect(discoverPage.noResults).toBeVisible();
      }
    });
  }
});

/** Opens Edit and goes to the Metadata step, where the contributors are edited. */
async function openEditMetadata(page: Page, detailPage: PreprintPage): Promise<PreprintEditPage> {
  await detailPage.editButton.click();
  const editPage = await PreprintEditPage.openLoaded(page);
  await editPage.goToNextStep('Metadata');
  return editPage;
}

/** From the Metadata step, through the remaining steps to Review. */
async function goFromMetadataToReview(editPage: PreprintEditPage): Promise<void> {
  await editPage.goToNextStep('Author Assertions');
  await editPage.goToNextStep('Supplements (optional)');
  await editPage.goToNextStep('Consent To Publish');
}

/** "Month D, YYYY" for an API timestamp, in the local timezone like the app shows it. */
function formatApiDate(apiDate: string): string {
  return new Date(apiDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** The "Month D, YYYY" date in a line like "Submitted: October 8, 2026". */
function extractUiDate(text: string): string {
  const match = text.match(/[A-Za-z]+ \d{1,2}, \d{4}/);
  if (!match) throw new Error(`No date found in UI text: ${text}`);
  return match[0];
}

test.describe('Preprint Overview', { tag: '@core' }, () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
    test.setTimeout(LONG_FLOW_TIMEOUT_MS);
  });

  // Port of this class's own `preprint_detail_page`: a preprint on the OSF provider.
  test.use({
    preprintGuid: async ({ session }, use) => {
      await use(await osfApi.createPreprint(session, { providerId: 'osf', title: 'OSF Selenium Preprint' }));
    },
  });

  test('verify preprint details', async ({ page, session, preprintGuid, preprintDetailPage }) => {
    const details = await osfApi.getPreprintDetails(session, preprintGuid);
    const fileName = await osfApi.getPreprintFileName(session, preprintGuid);
    const licenseName = await osfApi.getPreprintLicenseName(session, preprintGuid);
    const subjects = await osfApi.getPreprintSubjects(session, preprintGuid);

    if (details.relationships.provider.data.id === 'osf') {
      await expect(preprintDetailPage.osfBanner).toHaveText(
        'OSF preprints are not peer reviewed and acceptance into OSF preprints is not an indicator of scholarly merit.'
      );
    }
    await expect(preprintDetailPage.fileName).toHaveText(fileName);
    await expect(preprintDetailPage.fileVersion).toHaveText(`Version: ${details.attributes.version}`);
    await expect(preprintDetailPage.licenseName).toHaveText(licenseName);

    expect(extractUiDate(await preprintDetailPage.submittedDate.innerText())).toBe(
      formatApiDate(details.attributes.date_created)
    );
    expect(extractUiDate(await preprintDetailPage.lastEditedDate.innerText())).toBe(
      formatApiDate(details.attributes.date_modified)
    );
    const publicationDate = details.attributes.original_publication_date;
    if (publicationDate) {
      expect(extractUiDate(await preprintDetailPage.publicationDate.innerText())).toBe(
        formatApiDate(publicationDate)
      );
    }

    const uiSubjects = (await preprintDetailPage.subjects.allInnerTexts()).map((s) => s.trim());
    expect(uiSubjects.length).toBeGreaterThan(0);
    for (const subject of uiSubjects) {
      expect(subjects).toContain(subject);
    }

    // Each author links to their profile page.
    const authors = preprintDetailPage.allContributors;
    const names = await readContributorNames(authors);
    const links = await authors.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLAnchorElement).href)
    );
    for (const [index, link] of links.entries()) {
      await page.goto(link);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(names[index]);
    }
  });

  test('add contributors', async ({ page, preprintDetailPage }) => {
    const newUser = settings.PRODUCTION ? 'OSF Tester1' : 'OSF Runscope Admin';
    const editPage = await openEditMetadata(page, preprintDetailPage);
    await editPage.button('Add Contributor By Search').click();
    const dialog = new AddContributorDialog(page);
    await dialog.searchInput.fill(newUser);
    await dialog.contributorCheckbox(newUser).check();
    await dialog.button('Next').click();
    await dialog.button('Done').click();
    await expect(editPage.contributorRow(newUser)).toBeVisible();

    await goFromMetadataToReview(editPage);
    expect(await editPage.getReviewContributorNames()).toContain(newUser);
    await editPage.button('Submit').click();
    await preprintDetailPage.verify();
    expect(await readContributorNames(preprintDetailPage.allContributors)).toContain(newUser);
  });

  test('add contributor by email', async ({ page, preprintDetailPage }) => {
    const newUserEmail = 'osframeworktesting+unregistered_user@gmail.com';
    const newUser = 'Add user by email';
    const editPage = await openEditMetadata(page, preprintDetailPage);
    await editPage.button('Add Contributor By Search').click();
    const dialog = new AddContributorDialog(page);
    await dialog.searchInput.fill(newUser);
    await dialog.button('Add Unregistered Contributor').click();
    await dialog.fullNameInput.fill(newUser);
    await dialog.emailInput.fill(newUserEmail);
    await dialog.button('Add').click();
    await expect(editPage.contributorRow(newUser)).toBeVisible();

    await goFromMetadataToReview(editPage);
    expect(await editPage.getReviewContributorNames()).toContain(newUser);
    await editPage.button('Submit').click();
    await preprintDetailPage.verify();

    // An unregistered contributor has no profile, so their name isn't a link.
    const newContributor = preprintDetailPage.allContributors.filter({ hasText: newUser });
    await expect(newContributor).toHaveCount(1);
    await expect(newContributor).not.toHaveAttribute('href');
  });

  test.describe(() => {
    // Port of `preprint_page_with_user`: a pre-moderation preprint with a second contributor.
    test.use({
      preprintGuid: async ({ session }, use) => {
        const guid = await osfApi.createPreprint(session, {
          providerId: PRE_MODERATION.id,
          title: 'OSF Selenium Preprint',
        });
        await osfApi.addContributorToPreprint(session, guid, 'OSF Runscope Write');
        await use(guid);
      },
    });

    test('reorder contributors', async ({ page, preprintDetailPage }) => {
      const contributorName = 'OSF Runscope Write';
      expect(await readContributorNames(preprintDetailPage.allContributors)).toHaveLength(2);
      const editPage = await openEditMetadata(page, preprintDetailPage);
      const sourceOrder = (await editPage.getContributorTableNames()).indexOf(contributorName);
      expect(sourceOrder).toBeGreaterThan(0);

      // Drag the contributor onto the first row, then save the new order.
      const rows = editPage.contributorsTableRows;
      await editPage
        .contributorDragHandle(editPage.contributorRow(contributorName))
        .dragTo(editPage.contributorDragHandle(rows.nth(1)));
      await editPage.button('Save').click();
      await expect(editPage.button('Save')).toBeHidden();
      expect((await editPage.getContributorTableNames())[0]).toBe(contributorName);

      await goFromMetadataToReview(editPage);
      await editPage.button('Submit').click();
      await preprintDetailPage.verify();
      expect((await readContributorNames(preprintDetailPage.allContributors))[0]).toBe(contributorName);
    });

    test('remove contributor', async ({ page, preprintDetailPage }) => {
      expect(await readContributorNames(preprintDetailPage.allContributors)).toHaveLength(2);
      const editPage = await openEditMetadata(page, preprintDetailPage);
      await editPage.contributorRow('OSF Runscope Write').getByRole('button', { name: 'Delete' }).click();
      const confirmDialog = page.getByRole('alertdialog', { name: 'Remove contributor' });
      await confirmDialog.getByRole('button', { name: 'Remove', exact: true }).click();
      await expect(editPage.contributorRow('OSF Runscope Write')).toBeHidden();

      await goFromMetadataToReview(editPage);
      expect(await editPage.getReviewContributorNames()).toHaveLength(1);
      await editPage.button('Submit').click();
      await preprintDetailPage.verify();
      await expect(preprintDetailPage.allContributors).toHaveCount(1);
    });
  });
});
