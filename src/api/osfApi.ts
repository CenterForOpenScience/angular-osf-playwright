import * as settings from '../../config/settings';
import { createAddonSession, OsfApiError, OsfSession } from './session';

/**
 * Port of the subset of `api/osf_api.py` that `tests/conftest.py`'s fixtures, plus
 * `tests/test_user.py`, depend on. Function names/signatures mirror the Python
 * originals (snake_case -> camelCase) so the two stay easy to cross-reference during
 * migration.
 */

export interface OsfUser {
  id: string;
  raw: any;
  nodesUrl: string;
}

export interface OsfProject {
  id: string;
  raw: any;
  delete: () => Promise<void>;
}

function toProject(session: OsfSession, raw: any): OsfProject {
  return {
    id: raw.id,
    raw,
    delete: () => session.delete(`/v2/nodes/${raw.id}/`),
  };
}

export async function currentUser(session: OsfSession): Promise<OsfUser> {
  const data = await session.get('/v2/users/me/');
  return {
    id: data.data.id,
    raw: data.data,
    nodesUrl: data.data.relationships.nodes.links.related.href,
  };
}

export async function getNode(
  session: OsfSession,
  nodeId: string | null = settings.PREFERRED_NODE
): Promise<OsfProject> {
  if (!nodeId) {
    throw new Error('getNode requires a nodeId (PREFERRED_NODE is not set).');
  }
  const data = await session.get(`/v2/nodes/${nodeId}/`);
  return toProject(session, data.data);
}

export interface CreateProjectOptions {
  title?: string;
  tags?: string[];
  description?: string;
  public?: boolean;
}

export async function createProject(
  session: OsfSession,
  options: CreateProjectOptions = {}
): Promise<OsfProject> {
  const { title = 'osf selenium test', description, public: isPublic } = options;
  const tags = options.tags ?? ['qatest', process.env.PYTEST_CURRENT_TEST ?? 'playwright'];

  const attributes: Record<string, unknown> = { title, tags, category: '' };
  if (description !== undefined) attributes.description = description;
  if (isPublic !== undefined) attributes.public = isPublic;

  const data = await session.post('/v2/nodes/', {
    data: { type: 'nodes', attributes },
  });
  return toProject(session, data.data);
}

export async function deleteAllUserProjects(
  session: OsfSession,
  user?: OsfUser
): Promise<void> {
  const owner = user ?? (await currentUser(session));

  let data: any | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      data = await session.get(owner.nodesUrl);
      break;
    } catch (error) {
      lastError = error;
      if (error instanceof OsfApiError && error.status === 502) {
        continue;
      }
      throw error;
    }
  }
  if (!data) {
    throw lastError instanceof Error ? lastError : new Error('API not responding. Giving up.');
  }

  const failures: Array<[string, unknown]> = [];
  for (const node of data.data) {
    if (node.id === settings.PREFERRED_NODE) continue;
    try {
      await session.delete(`/v2/nodes/${node.id}/`);
    } catch (error) {
      failures.push([node.id, error]);
    }
  }
  if (failures.length) {
    const message = failures
      .map(([id, error]) => `node '${id}' errored with exception: '${error}'`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(message);
  }
}

export async function waffledPages(session: OsfSession): Promise<string[]> {
  const data = await session.get('/v2/_waffle/');
  return data.data
    .filter((page: any) => page.attributes.active)
    .map((page: any) => page.attributes.name);
}

export async function uploadFakeFile(
  session: OsfSession,
  node?: OsfProject,
  name = 'osf selenium test file for testing because its fake.txt',
  uploadUrl?: string,
  provider = 'osfstorage'
): Promise<{ name: string; metadata: any }> {
  let url = uploadUrl;
  if (!url) {
    if (!node) {
      throw new Error('Node must not be undefined when upload URL is not set.');
    }
    url = `${settings.FILE_DOMAIN}/v1/resources/${node.id}/providers/${provider}/`;
  }
  const metadata = await session.put(url, {}, { kind: 'file', name });
  return { name, metadata };
}

export async function getExistingFile(
  session: OsfSession,
  nodeId: string | null = settings.PREFERRED_NODE
): Promise<string> {
  const node = await getNode(session, nodeId);
  const filesUrl = node.raw.relationships.files.links.related.href;
  const data = await session.get(`${filesUrl}osfstorage/`);
  const files = data.data;
  if (files && files.length) {
    return files[0].attributes.name;
  }
  return (await uploadFakeFile(session, node)).name;
}

export async function updateCustomProjectMetadata(
  session: OsfSession,
  nodeId: string
): Promise<void> {
  await session.put(`v2/custom_item_metadata_records/${nodeId}/`, {
    data: {
      id: nodeId,
      type: 'custom-item-metadata-records',
      attributes: {
        language: 'eng',
        resource_type_general: 'Collection',
      },
    },
  });
}

export interface LicenseData {
  licenseId: string;
  requiredFields: string[];
}

export async function getLicenseDataForProvider(
  session: OsfSession,
  {
    licenseName = 'CC0 1.0 Universal',
  }: { providerType?: string; providerId?: string; licenseName?: string } = {}
): Promise<LicenseData> {
  const data = await session.get('v2/licenses/', { 'page[size]': 30 });
  const license = data.data.find((item: any) => item.attributes.name === licenseName);
  if (!license) {
    throw new Error(`License not found: ${licenseName}`);
  }
  return {
    licenseId: license.id,
    requiredFields: license.attributes.required_fields,
  };
}

export async function updateNodeLicense(
  session: OsfSession,
  nodeId: string,
  licenseId: string,
  copyrightHolders: string[] = [],
  year = 2023
): Promise<void> {
  await session.patch(`/v2/nodes/${nodeId}/`, {
    data: {
      type: 'nodes',
      id: nodeId,
      attributes: {
        node_license: {
          copyright_holders: copyrightHolders,
          year,
        },
      },
      relationships: {
        license: { data: { type: 'licenses', id: licenseId } },
      },
    },
  });
}

export async function getUserGuid(
  session: OsfSession,
  userName: string
): Promise<string | undefined> {
  let url: string | undefined = '/v2/users/?page=1';
  while (url) {
    const data: any = await session.get(url);
    const users = data.data ?? [];
    const match = users.find((u: any) => u.attributes.full_name === userName);
    if (match) return match.id;
    url = data.links?.next ?? undefined;
  }
  return undefined;
}

export async function updateProjectWithContributors(
  session: OsfSession,
  nodeId: string,
  userName = 'OSF Runscope Admin'
): Promise<void> {
  const userId = await getUserGuid(session, userName);
  await session.post(`/v2/nodes/${nodeId}/contributors/`, {
    data: {
      type: 'contributors',
      attributes: { permission: 'write', bibliographic: true },
      relationships: {
        users: { data: { type: 'users', id: userId } },
      },
    },
  });
}

export async function updateProjectWithAffiliations(
  session: OsfSession,
  nodeId: string,
  institutionId = 'google'
): Promise<void> {
  await session.patch(`/v2/nodes/${nodeId}/relationships/institutions/`, {
    data: [{ id: institutionId, type: 'institutions' }],
  });
}

export async function getSubjectId(
  session: OsfSession,
  subjectName = 'Engineering'
): Promise<string | undefined> {
  const data = await session.get('v2/subjects/', { 'page[size]': 1000 });
  const match = data.data.find((subject: any) => subject.attributes.text === subjectName);
  return match?.id;
}

export async function updateProjectWithSubjects(
  session: OsfSession,
  nodeId: string,
  subjectName = 'Engineering'
): Promise<void> {
  const subjectId = await getSubjectId(session, subjectName);
  await session.patch(`/v2/nodes/${nodeId}/relationships/subjects/`, {
    data: [{ id: subjectId, type: 'subjects' }],
  });
}

export async function updateProjectWithTags(
  session: OsfSession,
  nodeId: string,
  tagsList: string[] = ['selenium', 'automation test']
): Promise<void> {
  await session.patch(`/v2/nodes/${nodeId}/`, {
    data: {
      id: nodeId,
      type: 'nodes',
      attributes: { tags: tagsList },
    },
  });
}

/**
 * Below: functions ported for `tests/test_user.py` (settings/profile, developer
 * apps, personal access tokens, and citation/link addon connection flows).
 */

export async function getUserRegionName(
  session: OsfSession,
  user?: OsfUser
): Promise<string> {
  const resolvedUser = user ?? (await currentUser(session));
  const regionUrl = resolvedUser.raw.relationships.default_region.links.related.href;
  const data = await session.get(regionUrl);
  return data.data.attributes.name;
}

export async function getRegionsData(session: OsfSession): Promise<any[]> {
  const data = await session.get('/v2/regions/');
  return data.data;
}

export interface CreateDeveloperAppOptions {
  name?: string;
  description?: string;
  homeUrl?: string;
  callbackUrl?: string;
}

export async function createUserDeveloperApp(
  session: OsfSession,
  options: CreateDeveloperAppOptions = {}
): Promise<string | null> {
  const {
    name = 'OSF Test Dev App',
    description,
    homeUrl = settings.OSF_HOME,
    callbackUrl = settings.OSF_HOME,
  } = options;
  const data = await session.post('/v2/applications/', {
    data: {
      type: 'applications',
      attributes: {
        name,
        description,
        home_url: homeUrl,
        callback_url: callbackUrl,
      },
    },
  });
  return data?.data?.id ?? null;
}

export async function deleteUserDeveloperApp(
  session: OsfSession,
  appId: string
): Promise<void> {
  await session.delete(`/v2/applications/${appId}/`);
}

export async function getUserDeveloperAppData(
  session: OsfSession,
  appId: string
): Promise<any | null> {
  const data = await session.get(`/v2/applications/${appId}/`);
  return data.data ?? null;
}

export interface PersonalAccessToken {
  publicId: string;
  tokenId: string;
}

export async function createPersonalAccessToken(
  session: OsfSession,
  name = 'OSF Test PAT',
  scopes = 'osf.nodes.full_read'
): Promise<PersonalAccessToken | null> {
  const data = await session.post('/v2/tokens/', {
    data: {
      type: 'tokens',
      attributes: { name, scopes },
    },
  });
  if (!data) return null;
  return { publicId: data.data.id, tokenId: data.data.attributes.token_id };
}

export async function getTokenId(
  session: OsfSession,
  tokenName: string
): Promise<string | undefined> {
  const data = await session.get('/v2/tokens/');
  return data.data.find((token: any) => token.attributes.name === tokenName)?.id;
}

export async function deletePersonalAccessToken(
  session: OsfSession,
  tokenId: string
): Promise<void> {
  await session.delete(`/v2/tokens/${tokenId}/`);
}

export async function getUserPatData(
  session: OsfSession,
  tokenId: string
): Promise<any | null> {
  const data = await session.get(`/v2/tokens/${tokenId}/`);
  return data.data ?? null;
}

/**
 * Addon-domain lookups (ADDON_DOMAIN, Bearer auth) below. Each opens its own
 * short-lived addon session and disposes it before returning, matching the
 * per-call `get_addon_session()` pattern in osf_api.py while making disposal
 * explicit (Playwright request contexts, unlike `requests.Session`, need it).
 * Python's `get_external_storage_addons(session)` etc. accepted an unused
 * `session` param (the OSF API session) that the function body never referenced -
 * dropped here since it truly does nothing.
 */

async function listAddonDisplayNames(path: string): Promise<string[]> {
  const addonSession = await createAddonSession();
  try {
    const data = await addonSession.get(path);
    return data.data.map((addon: any) => addon.attributes.display_name);
  } finally {
    await addonSession.dispose();
  }
}

export function getExternalStorageAddons(): Promise<string[]> {
  return listAddonDisplayNames('/v1/external-storage-services');
}

export function getExternalCitationAddons(): Promise<string[]> {
  return listAddonDisplayNames('/v1/external-citation-services');
}

export function getExternalLinkedServices(): Promise<string[]> {
  return listAddonDisplayNames('/v1/external-link-services');
}

export async function getCitationAddonServiceId(
  provider: string
): Promise<string | undefined> {
  const addonSession = await createAddonSession();
  try {
    const data = await addonSession.get('/v1/external-citation-services');
    return data.data.find(
      (addon: any) => addon.attributes.display_name.toLowerCase() === provider
    )?.id;
  } finally {
    await addonSession.dispose();
  }
}

export async function getLinkServiceServiceId(
  provider: string
): Promise<string | undefined> {
  const addonSession = await createAddonSession();
  try {
    const data = await addonSession.get('/v1/external-link-services');
    return data.data.find(
      (addon: any) => addon.attributes.display_name.toLowerCase() === provider
    )?.id;
  } finally {
    await addonSession.dispose();
  }
}

export async function getUserReferenceId(
  addonSession: OsfSession,
  userId: string,
  currentUrl: string
): Promise<string> {
  const userUri = `${currentUrl}/${userId}`;
  const data = await addonSession.get('/v1/user-references', {
    'filter[user_uri]': userUri,
  });
  return data.data[0].id;
}

export async function getCitationUserAddon(
  session: OsfSession,
  provider: string,
  currentUrl: string,
  user?: OsfUser
): Promise<string | undefined> {
  const resolvedUser = user ?? (await currentUser(session));
  const addonSession = await createAddonSession();
  try {
    const userReferenceId = await getUserReferenceId(addonSession, resolvedUser.id, currentUrl);
    const data = await addonSession.get(
      `/v1/user-references/${userReferenceId}/authorized_citation_accounts`
    );
    return data.data.find(
      (service: any) =>
        service.attributes.display_name.replace(/ /g, '').toLowerCase() === provider
    )?.id;
  } finally {
    await addonSession.dispose();
  }
}

export async function getUserLinkedService(
  session: OsfSession,
  provider: string,
  currentUrl: string,
  user?: OsfUser
): Promise<string | undefined> {
  const resolvedUser = user ?? (await currentUser(session));
  const addonSession = await createAddonSession();
  try {
    const userReferenceId = await getUserReferenceId(addonSession, resolvedUser.id, currentUrl);
    const data = await addonSession.get(
      `/v1/user-references/${userReferenceId}/authorized_link_accounts`
    );
    return data.data.find(
      (service: any) =>
        service.attributes.display_name.replace(/ /g, '').toLowerCase() === provider
    )?.id;
  } finally {
    await addonSession.dispose();
  }
}

export async function connectUserCitationAddon(
  session: OsfSession,
  provider: string,
  currentUrl: string,
  user?: OsfUser
): Promise<void> {
  const resolvedUser = user ?? (await currentUser(session));
  const serviceId = await getCitationAddonServiceId(provider);
  const accountId = await getCitationUserAddon(session, provider, currentUrl, resolvedUser);
  const addonSession = await createAddonSession();
  try {
    await addonSession.post('/v1/authorized-citation-accounts/?include=external-citation-service', {
      data: {
        id: serviceId,
        type: 'authorized-citation-accounts',
        attributes: {
          display_name: provider,
          authorized_capabilities: ['ACCESS', 'UPDATE'],
        },
        relationships: {
          account_owner: { data: { type: 'user-references', id: accountId } },
          external_citation_service: {
            data: { type: 'external-citation-services', id: serviceId },
          },
        },
      },
    });
  } finally {
    await addonSession.dispose();
  }
}

export async function connectUserLinkService(
  session: OsfSession,
  provider: string,
  currentUrl: string,
  apiBaseUrl: string,
  accessToken: string,
  user?: OsfUser
): Promise<void> {
  const resolvedUser = user ?? (await currentUser(session));
  const serviceId = await getLinkServiceServiceId(provider);
  const accountId = await getUserLinkedService(session, provider, currentUrl, resolvedUser);
  const addonSession = await createAddonSession();
  try {
    await addonSession.post('/v1/authorized-link-accounts/?include=external-link-service', {
      data: {
        id: serviceId,
        type: 'authorized-link-accounts',
        attributes: {
          display_name: provider,
          credentials_available: false,
          authorized_capabilities: ['ACCESS', 'UPDATE'],
          api_base_url: apiBaseUrl,
          credentials: { access_token: accessToken },
        },
        relationships: {
          account_owner: { data: { type: 'user-references', id: accountId } },
          external_link_service: { data: { type: 'external-link-services', id: serviceId } },
        },
      },
    });
  } finally {
    await addonSession.dispose();
  }
}

export async function updateUserEmployment(
  session: OsfSession,
  userName: string
): Promise<any> {
  const userGuid = await getUserGuid(session, userName);
  return session.patch(`/v2/users/${userGuid}/`, {
    data: {
      id: userGuid,
      type: 'users',
      attributes: {
        employment: [
          {
            title: '111222 Test employ123',
            department: '',
            institution: 'QA institution',
            startYear: 2026,
            startMonth: 1,
            endYear: 2026,
            endMonth: 5,
            ongoing: false,
          },
        ],
      },
    },
  });
}

export async function updateUserEducation(
  session: OsfSession,
  userName: string
): Promise<any> {
  const userGuid = await getUserGuid(session, userName);
  return session.patch(`/v2/users/${userGuid}/`, {
    data: {
      id: userGuid,
      type: 'users',
      attributes: {
        education: [
          {
            degree: '',
            department: 'AQA department',
            institution: 'AQA education',
            startYear: 2026,
            startMonth: 1,
            endYear: 2026,
            endMonth: 5,
            ongoing: false,
          },
        ],
      },
    },
  });
}
