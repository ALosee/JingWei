import { computed, onMounted, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import {
  createIamUser,
  listIamRoles,
  listIamUserRoles,
  listIamUsers,
  replaceIamUserRoles,
  resetIamUserPassword,
  updateIamUser,
} from '../../client/index.js'
import type {
  CreateManagedUser,
  IamRole,
  ManagedUser,
  ResetManagedUserPassword,
  UpdateManagedUser,
} from '../../shared/index.js'

interface UserManagementDependencies {
  loadUsers: typeof listIamUsers
  loadRoles: typeof listIamRoles
  createUser: typeof createIamUser
  updateUser: typeof updateIamUser
  resetPassword: typeof resetIamUserPassword
  loadUserRoles: typeof listIamUserRoles
  replaceRoles: typeof replaceIamUserRoles
}

/** Page-scoped user admin: list, create/update, reset password, and role assignment. */
export function useIamUserManagement(
  dependencies: UserManagementDependencies = {
    loadUsers: listIamUsers,
    loadRoles: listIamRoles,
    createUser: createIamUser,
    updateUser: updateIamUser,
    resetPassword: resetIamUserPassword,
    loadUserRoles: listIamUserRoles,
    replaceRoles: replaceIamUserRoles,
  },
) {
  const users = ref<ManagedUser[]>([])
  const roles = ref<IamRole[]>([])
  const selectedId = ref('')
  const search = ref('')
  const busy = ref(false)
  const error = ref('')
  const creating = ref(false)
  const draftUsername = ref('')
  const draftDisplayName = ref('')
  const draftEmail = ref('')
  const draftPhone = ref('')
  const draftPassword = ref('')
  const draftStatus = ref<'ACTIVE' | 'DISABLED'>('ACTIVE')
  const selectedRoleIds = ref<Set<string>>(new Set())
  const rolesDirty = ref(false)
  const newPassword = ref('')

  const listState = useApiRequestState()
  const rolesState = useApiRequestState()

  const selected = computed(() => users.value.find((user) => user.id === selectedId.value))
  const filteredUsers = computed(() => {
    const keyword = search.value.trim().toLocaleLowerCase()
    if (keyword === '') return users.value
    return users.value.filter(
      (user) =>
        user.username.toLocaleLowerCase().includes(keyword) ||
        user.displayName.toLocaleLowerCase().includes(keyword) ||
        (user.email ?? '').toLocaleLowerCase().includes(keyword),
    )
  })
  const activeRoles = computed(() => roles.value.filter((role) => role.status === 'ACTIVE'))

  function errorMessage(cause: unknown): string {
    if (cause instanceof Error) return cause.message
    return '操作失败'
  }

  async function run(action: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    error.value = ''
    try {
      await action()
    } catch (cause) {
      error.value = errorMessage(cause)
    } finally {
      busy.value = false
    }
  }

  function applyUserDraft(user: ManagedUser): void {
    draftUsername.value = user.username
    draftDisplayName.value = user.displayName
    draftEmail.value = user.email ?? ''
    draftPhone.value = user.phone ?? ''
    draftStatus.value = user.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'
    draftPassword.value = ''
    newPassword.value = ''
  }

  function resetRoleDraft(roleIds: string[]): void {
    selectedRoleIds.value = new Set(roleIds)
    rolesDirty.value = false
  }

  async function load(): Promise<void> {
    const [usersResult, rolesResult] = await Promise.all([
      dependencies.loadUsers(listState.options),
      dependencies.loadRoles(rolesState.options),
    ])
    if (usersResult.error !== null) throw usersResult.error
    if (rolesResult.error !== null) throw rolesResult.error
    users.value = usersResult.data.users
    roles.value = rolesResult.data.roles
  }

  async function loadSelectedRoles(id: string): Promise<void> {
    const result = await dependencies.loadUserRoles(id)
    if (result.error !== null) throw result.error
    resetRoleDraft(result.data.roles.map((role) => role.id))
  }

  function select(id: string) {
    selectedId.value = id
    creating.value = false
    const user = users.value.find((item) => item.id === id)
    if (user !== undefined) applyUserDraft(user)
    void run(() => loadSelectedRoles(id))
  }

  function beginCreate() {
    creating.value = true
    selectedId.value = ''
    draftUsername.value = ''
    draftDisplayName.value = ''
    draftEmail.value = ''
    draftPhone.value = ''
    draftPassword.value = ''
    draftStatus.value = 'ACTIVE'
    selectedRoleIds.value = new Set()
    rolesDirty.value = false
    newPassword.value = ''
  }

  function cancelCreate() {
    creating.value = false
  }

  async function createUser(input: CreateManagedUser) {
    await run(async () => {
      const result = await dependencies.createUser(input)
      if (result.error !== null) throw result.error
      users.value = [...users.value, result.data].toSorted((a, b) =>
        a.username.localeCompare(b.username),
      )
      creating.value = false
      selectedId.value = result.data.id
      applyUserDraft(result.data)
      resetRoleDraft(input.roleIds ?? [])
    })
  }

  async function saveSelected() {
    const user = selected.value
    if (user === undefined) return
    await run(async () => {
      const input: UpdateManagedUser = {
        displayName: draftDisplayName.value.trim(),
        email: draftEmail.value.trim() === '' ? null : draftEmail.value.trim(),
        phone: draftPhone.value.trim() === '' ? null : draftPhone.value.trim(),
        status: draftStatus.value,
      }
      const result = await dependencies.updateUser(user.id, input)
      if (result.error !== null) throw result.error
      users.value = users.value.map((item) => (item.id === user.id ? result.data : item))
      applyUserDraft(result.data)
    })
  }

  async function resetSelectedPassword() {
    const user = selected.value
    if (user === undefined) return
    await run(async () => {
      const input: ResetManagedUserPassword = { newPassword: newPassword.value }
      const result = await dependencies.resetPassword(user.id, input)
      if (result.error !== null) throw result.error
      newPassword.value = ''
    })
  }

  function toggleRole(roleId: string, enabled: boolean) {
    const next = new Set(selectedRoleIds.value)
    if (enabled) next.add(roleId)
    else next.delete(roleId)
    selectedRoleIds.value = next
    rolesDirty.value = true
  }

  async function saveRoles() {
    const user = selected.value
    if (user === undefined) return
    await run(async () => {
      const result = await dependencies.replaceRoles(user.id, {
        roleIds: [...selectedRoleIds.value],
      })
      if (result.error !== null) throw result.error
      resetRoleDraft(result.data.roles.map((role) => role.id))
      users.value = users.value.map((item) =>
        item.id === user.id ? { ...item, roleCount: result.data.roles.length } : item,
      )
    })
  }

  onMounted(() => {
    void run(async () => {
      await load()
      const first = users.value[0]
      if (first === undefined) return
      selectedId.value = first.id
      creating.value = false
      applyUserDraft(first)
      await loadSelectedRoles(first.id)
    })
  })

  return {
    users,
    filteredUsers,
    activeRoles,
    selected,
    selectedId,
    search,
    busy,
    error,
    creating,
    draftUsername,
    draftDisplayName,
    draftEmail,
    draftPhone,
    draftPassword,
    draftStatus,
    selectedRoleIds,
    rolesDirty,
    newPassword,
    loading: listState.loading,
    select,
    beginCreate,
    cancelCreate,
    createUser,
    saveSelected,
    resetSelectedPassword,
    toggleRole,
    saveRoles,
    load,
  }
}
