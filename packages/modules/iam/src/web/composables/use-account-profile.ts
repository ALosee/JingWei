import { computed, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import { getAccountProfile, getAccountRoles, updateAccountProfile } from '../../client/index.js'
import type { AccountProfile, AccountRole } from '../../shared/index.js'
import { patchIamSessionUser } from '../session-user.js'

interface AccountProfileDependencies {
  load: typeof getAccountProfile
  update: typeof updateAccountProfile
  loadRoles: typeof getAccountRoles
}

/** Owns account profile load/edit workflow; the page only binds fields and actions. */
export function useAccountProfile(
  dependencies: AccountProfileDependencies = {
    load: getAccountProfile,
    update: updateAccountProfile,
    loadRoles: getAccountRoles,
  },
) {
  const profile = ref<AccountProfile | null>(null)
  const roles = ref<AccountRole[]>([])
  const errorMessage = ref('')
  const loadState = useApiRequestState()
  const saveState = useApiRequestState()
  const rolesState = useApiRequestState()

  const draftDisplayName = ref('')
  const draftAvatarUrl = ref('')
  const dirty = computed(() => {
    if (profile.value === null) return false
    return (
      draftDisplayName.value.trim() !== profile.value.displayName ||
      normalizeAvatar(draftAvatarUrl.value) !== profile.value.avatarUrl
    )
  })

  function applyProfile(next: AccountProfile): void {
    profile.value = next
    draftDisplayName.value = next.displayName
    draftAvatarUrl.value = next.avatarUrl ?? ''
    patchIamSessionUser({ displayName: next.displayName, avatarUrl: next.avatarUrl })
  }

  async function load(): Promise<void> {
    errorMessage.value = ''
    const { data, error } = await dependencies.load(loadState.options)
    if (error !== null) {
      errorMessage.value = error.message
      return
    }
    applyProfile(data)
  }

  async function loadRoles(): Promise<void> {
    const { data, error } = await dependencies.loadRoles(rolesState.options)
    if (error !== null) {
      errorMessage.value = error.message
      return
    }
    roles.value = data.roles
  }

  async function save(): Promise<void> {
    if (profile.value === null || saveState.loading.value) return
    const displayName = draftDisplayName.value.trim()
    if (displayName.length === 0) {
      errorMessage.value = '显示名不能为空'
      return
    }
    errorMessage.value = ''
    const { data, error } = await dependencies.update(
      {
        displayName,
        avatarUrl: normalizeAvatar(draftAvatarUrl.value),
      },
      saveState.options,
    )
    if (error !== null) {
      errorMessage.value = error.message
      return
    }
    applyProfile(data)
  }

  function resetDraft(): void {
    if (profile.value === null) return
    draftDisplayName.value = profile.value.displayName
    draftAvatarUrl.value = profile.value.avatarUrl ?? ''
  }

  return {
    profile,
    roles,
    errorMessage,
    loading: loadState.loading,
    saving: saveState.loading,
    rolesLoading: rolesState.loading,
    draftDisplayName,
    draftAvatarUrl,
    dirty,
    load,
    loadRoles,
    save,
    resetDraft,
  }
}

function normalizeAvatar(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
