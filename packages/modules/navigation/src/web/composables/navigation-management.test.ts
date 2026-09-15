import { expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { NavigationCatalog, NavigationVersion, SaveRoleGrants } from '../../shared/index.js'
import { useNavigationEditor } from './use-navigation-editor.js'
import { useNavigationFeedback } from './use-navigation-feedback.js'
import { useNavigationVersions } from './use-navigation-versions.js'
import { useRoleNavigationGrants } from './use-role-navigation-grants.js'

function snapshot(): NavigationVersion {
  return {
    id: 'version-1',
    revision: 1,
    editRevision: 0,
    status: 'DRAFT',
    publishedAt: null,
    authEntryCode: 'signin',
    homeCode: null,
    nodes: [
      {
        id: 'node-1',
        code: 'signin',
        name: 'Sign in',
        parentId: null,
        type: 'PAGE',
        status: 'ENABLED',
        routeKey: 'iam.login',
        path: '/signin',
        layout: 'blank',
        icon: null,
        sortOrder: 0,
        accessMode: 'PUBLIC',
        href: null,
        externalTarget: null,
        params: {},
        query: {},
      },
    ],
  }
}
function editorState() {
  const feedback = useNavigationFeedback()
  const catalog = ref<NavigationCatalog>({ routes: [], roles: [] })
  const editor = useNavigationEditor(catalog, feedback, () => true)
  editor.replaceVersion(snapshot())
  return { editor, feedback }
}
it('keeps local JSON edits separate from version persistence and refuses invalid node changes', () => {
  const { editor, feedback } = editorState()
  editor.queryText.value = '{'
  editor.dirty.value = true
  editor.selectNode('another-node')
  expect(editor.selectedId.value).toBe('node-1')
  expect(feedback.error.value).not.toBe('')
  editor.queryText.value = '{"tab":"profile"}'
  editor.applyJson()
  expect(editor.selected.value?.query).toEqual({ tab: 'profile' })
  expect(editor.dirty.value).toBe(true)
})
it('saves the expected revision, adopts returned node IDs, and preserves publish concurrency inputs', async () => {
  const { editor, feedback } = editorState()
  const draft = snapshot()
  const saved = {
    ...draft,
    editRevision: 1,
    nodes: draft.nodes.map((node) => ({ ...node, id: 'saved-node' })),
  }
  const api = {
    getNavigationAdmin: vi.fn(() =>
      Promise.resolve({ publishedVersionId: 'old-published', versions: [] }),
    ),
    getNavigationVersion: vi.fn(() =>
      Promise.resolve({ ...draft, id: 'old-published', status: 'PUBLISHED' as const }),
    ),
    createNavigationDraft: vi.fn(() => Promise.resolve(draft)),
    saveNavigationDraft: vi.fn(() => Promise.resolve(saved)),
    validateNavigationVersion: vi.fn(() => Promise.resolve({ issues: [] })),
    publishNavigationVersion: vi.fn(() =>
      Promise.resolve({ ...saved, status: 'PUBLISHED' as const }),
    ),
    deleteNavigationDraft: vi.fn(() => Promise.resolve({ id: draft.id })),
  }
  const versions = useNavigationVersions(api, editor, feedback, () => true)
  await versions.save()
  expect(api.saveNavigationDraft).toHaveBeenCalledWith(
    draft.id,
    expect.objectContaining({ expectedEditRevision: 0 }),
  )
  expect(editor.selectedId.value).toBe('saved-node')
  await versions.publish(false)
  expect(api.publishNavigationVersion).toHaveBeenCalledWith(
    draft.id,
    { expectedEditRevision: 1, expectedPublishedVersionId: 'old-published' },
    false,
  )
})
it('deletes a draft and falls back to the published version', async () => {
  const { editor, feedback } = editorState()
  const draft = snapshot()
  const published = { ...draft, id: 'published-1', status: 'PUBLISHED' as const }
  const api = {
    getNavigationAdmin: vi.fn(() =>
      Promise.resolve({ publishedVersionId: published.id, versions: [] }),
    ),
    getNavigationVersion: vi.fn(() => Promise.resolve(published)),
    createNavigationDraft: vi.fn(() => Promise.resolve(draft)),
    saveNavigationDraft: vi.fn(),
    validateNavigationVersion: vi.fn(),
    publishNavigationVersion: vi.fn(),
    deleteNavigationDraft: vi.fn(() => Promise.resolve({ id: draft.id })),
  }
  const versions = useNavigationVersions(api, editor, feedback, () => true)
  await versions.deleteDraft()
  expect(api.deleteNavigationDraft).toHaveBeenCalledWith(draft.id)
  expect(editor.version.value?.id).toBe(published.id)
  expect(feedback.message.value).toBe('草稿已删除。')
})
it('clears prior role state on failed reads and cannot save a role that was not loaded', async () => {
  const feedback = useNavigationFeedback()
  const api = {
    getRoleNavigation: vi.fn((id: string) => {
      if (id === 'broken') return Promise.reject(new Error('forbidden'))
      return Promise.resolve({ codes: ['external.help'] })
    }),
    saveRoleNavigation: vi.fn(() => Promise.resolve({ codes: [] })),
  }
  const roles = useRoleNavigationGrants(api, ref(null), feedback, () => true)
  roles.roleId.value = 'first'
  await roles.loadRole()
  expect(roles.grants.value).toEqual(['external.help'])
  roles.roleId.value = 'broken'
  await roles.loadRole()
  await roles.saveGrants()
  expect(roles.loadedRoleId.value).toBe('')
  expect(roles.grants.value).toEqual([])
  expect(api.saveRoleNavigation).not.toHaveBeenCalled()
})
it('uses the original role code set for compare-and-replace and honors confirmation', async () => {
  const feedback = useNavigationFeedback()
  const confirm = vi.fn(() => false)
  const api = {
    getRoleNavigation: vi.fn(() => Promise.resolve({ codes: ['old'] })),
    saveRoleNavigation: vi.fn((_role: string, input: SaveRoleGrants) =>
      Promise.resolve({ codes: input.codes }),
    ),
  }
  const roles = useRoleNavigationGrants(api, ref(null), feedback, confirm)
  roles.roleId.value = 'role'
  await roles.loadRole()
  roles.grants.value = ['new']
  await roles.saveGrants()
  expect(api.saveRoleNavigation).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  await roles.saveGrants()
  expect(api.saveRoleNavigation).toHaveBeenCalledWith('role', {
    codes: ['new'],
    expectedCodes: ['old'],
  })
})
