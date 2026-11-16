import { Page, Response } from '@playwright/test';

import * as settings from '../config/settings';
import * as osfApi from '../src/api/osfApi';
import { OsfSession, createSession } from '../src/api/session';
import { test as base, expect } from '../src/fixtures';
import { MyRegistrationsPage } from '../src/pages/BrowsePages';
import {
  DraftRegistrationMetadataPage,
  DraftRegistrationReviewPage,
  JustificationReviewPage,
  RegistrationAddNewPage,
  RegistrationJustificationPage,
} from '../src/pages/RegistriesPage';
import { RegistrationPage } from '../src/pages/RegistrationPage';

/** Port of `tests/test_my_registrations.py`. */

const OPEN_ENDED_SCHEMA = 'Open-Ended Registration';
const VERSIONING_REGISTRATION_TITLE = 'Angular Selenium Test Registration [PUBLIC] (Versioning)';
const DRAFT_SUMMARY = 'QA Selenium Testing';

async function getOpenEndedSchemaId(session: OsfSession): Promise<string> {
  const schemas = await osfApi.getRegistrationSchemasForProvider(session, 'osf');
  const schema = schemas.find(([name]) => name === OPEN_ENDED_SCHEMA);
  if (!schema) throw new Error(`No '${OPEN_ENDED_SCHEMA}' schema for the osf registry.`);
  return schema[1];
}

async function deleteDraft(session: OsfSession, draftId: string): Promise<void> {
  await osfApi.deleteDraftRegistration(session, draftId).catch((error) => {
    console.error('\n=== CLEANUP FAILED (IGNORED) ===');
    console.error(`Error: ${error}`);
  });
}

const test = base.extend<{
  myRegistrationsPage: MyRegistrationsPage;
  draftRegistrationWithoutProject: string;
  draftRegistrationFromProject: string;
}>({
  myRegistrationsPage: async ({ page }, use) => {
    await use(await new MyRegistrationsPage(page).goto());
  },

  /** Port of `create_single_draft_registration` (Python never deleted the draft). */
  draftRegistrationWithoutProject: async ({ session }, use) => {
    const draftId = await osfApi.createDraftRegistrationWithoutProject(
      session,
      await getOpenEndedSchemaId(session)
    );
    await use(draftId);
    await deleteDraft(session, draftId);
  },

  /**
   * Port of `create_single_draft_registration_without_project` - despite its name, a
   * draft of `defaultProjectWithMetadataDescriptionLicense` with a summary and the
   * Engineering subject.
   */
  draftRegistrationFromProject: async (
    { session, defaultProjectWithMetadataDescriptionLicense: project },
    use
  ) => {
    const subjectId = await osfApi.getSubjectId(session);
    if (!subjectId) throw new Error("Subject 'Engineering' not found.");
    const draftId = await osfApi.createDraftRegistrationWithSummaryAndSubject(session, {
      nodeId: project.id,
      schemaId: await getOpenEndedSchemaId(session),
      summary: DRAFT_SUMMARY,
      subjectIds: [subjectId],
    });
    await use(draftId);
    await deleteDraft(session, draftId);
  },
});

test.describe('My Registrations Page Empty', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ mustBeLoggedInAsUserTwo }) => {
    void mustBeLoggedInAsUserTwo;
  });

  test('no drafts', async ({ page, myRegistrationsPage }) => {
    await myRegistrationsPage.openDraftsTab();
    const panel = myRegistrationsPage.draftsPanel;
    await expect(myRegistrationsPage.noRegistrationsMessage(panel)).toBeVisible();
    await myRegistrationsPage.addRegistrationButton(panel).click();
    await RegistrationAddNewPage.expectOn(page);
  });

  test('no registrations', async ({ page, myRegistrationsPage }) => {
    await myRegistrationsPage.openSubmittedTab();
    const panel = myRegistrationsPage.submittedPanel;
    await expect(myRegistrationsPage.noRegistrationsMessage(panel)).toBeVisible();
    await myRegistrationsPage.addRegistrationButton(panel).click();
    await RegistrationAddNewPage.expectOn(page);
  });
});

/** The registrations user has a public registration and a draft registration for test purposes. */
test.describe('My Registrations User Two', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ loginAsUserWithRegistrations }) => {
    void loginAsUserWithRegistrations;
  });

  test('drafts tab', async ({ page, myRegistrationsPage }) => {
    await myRegistrationsPage.openDraftsTab();
    const drafts = myRegistrationsPage.registrationCards(myRegistrationsPage.draftsPanel);
    await expect(drafts.first(), 'the registrations user should have a draft registration').toBeVisible();
    await drafts.first().getByRole('button', { name: 'Edit', exact: true }).click();
    await DraftRegistrationMetadataPage.expectOn(page, settings.LONG_TIMEOUT_MS);
  });

  test('submissions tab', async ({ page, myRegistrationsPage }) => {
    await myRegistrationsPage.openSubmittedTab();
    const registrations = myRegistrationsPage.registrationCards(myRegistrationsPage.submittedPanel);
    await expect(registrations.first(), 'the registrations user should have a registration').toBeVisible();
    await registrations.first().getByRole('button', { name: 'View', exact: true }).click();
    await RegistrationPage.expectOn(page, settings.LONG_TIMEOUT_MS);
  });
});

test.describe('My Registrations Draft Tab', { tag: ['@smoke', '@core'] }, () => {
  test.beforeEach(async ({ mustBeLoggedIn }) => {
    void mustBeLoggedIn;
  });

  /**
   * Opens the Review page of the newest Drafts card titled `title` and checks it is
   * `draftId`'s (Python clicked the first Review button on the tab).
   */
  async function reviewDraft(
    page: Page,
    myRegistrationsPage: MyRegistrationsPage,
    title: string,
    draftId: string
  ): Promise<DraftRegistrationReviewPage> {
    await myRegistrationsPage.openDraftsTab();
    const card = myRegistrationsPage
      .registrationCardsByTitle(myRegistrationsPage.draftsPanel, title)
      .first();
    const reviewButton = card.getByRole('button', { name: 'Review', exact: true });
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();
    await expect(page).toHaveURL(new RegExp(`/registries/drafts/${draftId}/review`));
    return DraftRegistrationReviewPage.expectOn(page, settings.LONG_TIMEOUT_MS);
  }

  test('draft registration without project review button', async ({
    page,
    myRegistrationsPage,
    defaultProjectWithMetadataDescriptionLicense: project,
    draftRegistrationFromProject,
  }) => {
    const reviewPage = await reviewDraft(
      page,
      myRegistrationsPage,
      project.raw.attributes.title,
      draftRegistrationFromProject
    );

    // Check all entered data for the draft registration is displayed
    await expect(reviewPage.title).toContainText('OSF Test Project');
    await expect(reviewPage.description).toContainText(project.raw.attributes.description);
    await expect(reviewPage.subject).toContainText('Engineering');
    await expect(reviewPage.license).toContainText('CC0 1.0 Universal');
    await expect(reviewPage.summary).toContainText(DRAFT_SUMMARY);

    // Every required field is filled, so Register is enabled
    await expect(reviewPage.registerButton).toBeEnabled();
  });

  test('drafts tab review button', async ({
    page,
    myRegistrationsPage,
    draftRegistrationWithoutProject,
  }) => {
    const reviewPage = await reviewDraft(
      page,
      myRegistrationsPage,
      '(Untitled)',
      draftRegistrationWithoutProject
    );

    await expect(reviewPage.registerButton).toBeDisabled();

    // Check every required field shows an error
    for (const field of ['Title', 'Description', 'License', 'Subjects']) {
      await expect(reviewPage.requiredError(field), `required error under ${field}`).toBeVisible();
    }
  });
});

test.describe('Registrations Versioning', () => {
  // Both tests update the same registration; run them in order, as pytest did.
  test.describe.configure({ mode: 'default' });

  test.beforeEach(async ({ loginAsUserWithRegistrations }) => {
    test.skip(settings.PRODUCTION, 'Test should not run on production');
    void loginAsUserWithRegistrations;
  });

  async function openVersioningRegistration(page: Page): Promise<{ guid: string; overview: RegistrationPage }> {
    const guid = await osfApi.getRegistrationByTitle(VERSIONING_REGISTRATION_TITLE);
    if (!guid) throw new Error(`Registration '${VERSIONING_REGISTRATION_TITLE}' not found on the server.`);
    await page.goto(`${settings.OSF_HOME}/${guid}/overview`);
    const overview = new RegistrationPage(page);
    await overview.waitForOverview(guid);
    return { guid, overview };
  }

  /**
   * Starts a new update and returns its schema response id, so a test that stops halfway
   * can delete it (an in-progress update blocks the next "Update"). Python had unused
   * helpers for this (`delete_registration_version_draft`).
   */
  async function startUpdate(page: Page, overview: RegistrationPage): Promise<string> {
    await overview.updatesDropdown.click();
    const [created] = await Promise.all([
      page.waitForResponse(
        (response: Response) =>
          response.request().method() === 'POST' && /\/v2\/schema_responses\/$/.test(response.url())
      ),
      overview.updateButton.click(),
    ]);
    return (await created.json()).data.id;
  }

  async function deleteUnfinishedUpdate(schemaResponseId: string): Promise<void> {
    const session = await createSession(settings.REGISTRATIONS_USER, settings.REGISTRATIONS_USER_PASSWORD);
    await osfApi.deleteRegistrationVersionDraft(session, schemaResponseId).catch((error) => {
      console.error('\n=== CLEANUP FAILED (IGNORED) ===');
      console.error(`Error: ${error}`);
    });
  }

  test('versioning workflow', async ({ page, fake }) => {
    const { guid, overview } = await openVersioningRegistration(page);
    const schemaResponseId = await startUpdate(page, overview);
    let finished = false;
    try {
      const justificationPage = await RegistrationJustificationPage.expectOn(page);
      const justification =
        'This justification is provided by selenium test automation. \n' + fake.lorem.sentence(20);
      const summary =
        'This summary is provided by selenium test automation. \n' + fake.lorem.sentence(20);
      await justificationPage.performJustificationUpdate(justification);
      await justificationPage.performSummaryUpdate(summary);

      const reviewPage = await JustificationReviewPage.expectOn(page);
      await expect(reviewPage.summaryReview).toContainText(summary);
      await reviewPage.submitChangesButton.click();
      await reviewPage.acceptChangesButton.click();
      finished = true;

      await overview.waitForOverview(guid);
      await expect(overview.narrativeSummary).toContainText(summary);
    } finally {
      if (!finished) await deleteUnfinishedUpdate(schemaResponseId);
    }
  });

  test('delete versioning', async ({ page, fake }) => {
    const { guid, overview } = await openVersioningRegistration(page);
    await expect(overview.narrativeSummary).not.toBeEmpty();
    const originSummary = (await overview.narrativeSummary.innerText()).trim();

    const schemaResponseId = await startUpdate(page, overview);
    let finished = false;
    try {
      const justificationPage = await RegistrationJustificationPage.expectOn(page);
      const justification = 'This justification is provided by selenium test automation.';
      const summary =
        'This summary is provided by selenium test automation. \n' + fake.lorem.sentence(20);
      await justificationPage.performJustificationUpdate(justification);
      await justificationPage.performSummaryUpdate(summary);

      const reviewPage = await JustificationReviewPage.expectOn(page);
      await expect(reviewPage.summaryReview).toContainText(summary);
      const latestSummaryUpdate = (await reviewPage.summaryReview.innerText()).trim();
      await reviewPage.deleteDraftUpdateButton.click();
      await reviewPage.confirmDeleteDraftUpdate();
      finished = true;

      await overview.waitForOverview(guid);
      await expect(overview.narrativeSummary).toContainText(originSummary);
      expect(originSummary).not.toEqual(latestSummaryUpdate);
    } finally {
      if (!finished) await deleteUnfinishedUpdate(schemaResponseId);
    }
  });
});
