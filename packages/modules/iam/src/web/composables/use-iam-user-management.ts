import { computed, onMounted, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import {
  createIamUser,
  deleteIamUser,
  getIamUserDeletionStatus,
  listIamRoles,
  listIamUserRoles,
  listIamUsers,
  replaceIamUserRoles,
  resetIamUserPassword,
  updateIamUser,
} from '../../client/index.js'
import { iamSessionUser, useIamPermission } from '../../session/index.js'
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
  removeUser: typeof deleteIamUser
  deletionStatus: typeof getIamUserDeletionStatus
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
    removeUser: deleteIamUser,
    deletionStatus: getIamUserDeletionStatus,
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
  let running = false
  const mutationState = useApiRequestState()
  const detailState = useApiRequestState()
  const deletionState = useApiRequestState()
  const deletion = ref<{ allowed: boolean; reason: string | null } | null>(null)
  const error = ref('')
  const creating = ref(false)
  const selectionBeforeCreate = ref('')
  /** Functional permission is enforced on the server; this only improves button UX. */
  const canManage = useIamPermission('iam.user.manage')
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
  const busy = computed(
    () =>
      listState.loading.value ||
      rolesState.loading.value ||
      mutationState.loading.value ||
      detailState.loading.value ||
      deletionState.loading.value,
  )

  const selected = computed(() => users.value.find((user) => user.id === selectedId.value))
  const deleteDisabledReason = computed(() => {
    const user = selected.value
    if (user === undefined) return '请先选择用户'
    if (user.id === iamSessionUser.value?.id) return '不能删除当前登录账号'
    if (user.status !== 'DISABLED') return '请先禁用账号'
    if (deletion.value === null) return '尚未完成删除条件检查'
    return deletion.value.allowed ? '' : (deletion.value.reason ?? '当前账号不能删除')
  })
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
    if (running) return false
    running = true
    error.value = ''
    try {
      await action()
      return true
    } catch (cause) {
      error.value = errorMessage(cause)
      return false
    } finally {
      running = false
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

  async function loadDeletionStatus(id: string): Promise<void> {
    deletion.value = null
    const user = users.value.find((item) => item.id === id)
    if (!canManage.value || user?.status !== 'DISABLED' || user.id === iamSessionUser.value?.id)
      return
    const result = await dependencies.deletionStatus(id, deletionState.options)
    if (selectedId.value !== id) return
    if (result.error !== null) {
      deletion.value = { allowed: false, reason: result.error.message }
      return
    }
    deletion.value = result.data
  }

  async function loadSelectedRoles(id: string): Promise<void> {
    const result = await dependencies.loadUserRoles(id, detailState.options)
    if (result.error !== null) throw result.error
    resetRoleDraft(result.data.roles.map((role) => role.id))
  }

  function select(id: string) {
    selectedId.value = id
    creating.value = false
    const user = users.value.find((item) => item.id === id)
    if (user !== undefined) applyUserDraft(user)
    deletion.value = null
    void run(async () => {
      await Promise.all([loadSelectedRoles(id), loadDeletionStatus(id)])
    })
  }

  function beginCreate() {
    creating.value = true
    selectionBeforeCreate.value = selectedId.value
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
    const restoreId = selectionBeforeCreate.value
    selectionBeforeCreate.value = ''
    if (restoreId === '') return
    select(restoreId)
  }

  async function createUser(input: CreateManagedUser) {
    await run(async () => {
      const result = await dependencies.createUser(input, mutationState.options)
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
      const result = await dependencies.updateUser(user.id, input, mutationState.options)
      if (result.error !== null) throw result.error
      users.value = users.value.map((item) => (item.id === user.id ? result.data : item))
      applyUserDraft(result.data)
      await loadDeletionStatus(user.id)
    })
  }

  async function resetSelectedPassword() {
    const user = selected.value
    if (user === undefined) return
    await run(async () => {
      const input: ResetManagedUserPassword = { newPassword: newPassword.value }
      const result = await dependencies.resetPassword(user.id, input, mutationState.options)
      if (result.error !== null) throw result.error
      newPassword.value = ''
    })
  }

  async function removeSelected(): Promise<boolean> {
    const user = selected.value
    if (user === undefined || deleteDisabledReason.value !== '') return false
    return run(async () => {
      const index = filteredUsers.value.findIndex((item) => item.id === user.id)
      const candidates = filteredUsers.value.filter((item) => item.id !== user.id)
      const nextId = candidates[Math.min(index, candidates.length - 1)]?.id
      const result = await dependencies.removeUser(user.id, mutationState.options)
      if (result.error !== null) {
        await loadDeletionStatus(user.id)
        throw result.error
      }
      users.value = users.value.filter((item) => item.id !== user.id)
      selectedId.value = ''
      resetRoleDraft([])
      newPassword.value = ''
      deletion.value = null
      await load()
      const next = users.value.find((item) => item.id === nextId)
      if (next === undefined) return
      selectedId.value = next.id
      applyUserDraft(next)
      await Promise.all([loadSelectedRoles(next.id), loadDeletionStatus(next.id)])
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
      const result = await dependencies.replaceRoles(
        user.id,
        {
          roleIds: [...selectedRoleIds.value],
        },
        mutationState.options,
      )
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
      await Promise.all([loadSelectedRoles(first.id), loadDeletionStatus(first.id)])
    })
  })

  return {
    users,
    filteredUsers,
    activeRoles,
    canManage,
    deleteDisabledReason,
    removeSelected,
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
