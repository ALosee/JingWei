import { computed, onMounted, ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import {
  createIamRole,
  deleteIamRole,
  listIamPermissionCatalog,
  listIamRolePermissions,
  listIamRoles,
  replaceIamRolePermissions,
  updateIamRole,
} from '../../client/index.js'
import type {
  CreateIamRole,
  IamRole,
  PermissionCatalogItem,
  RoleDataScopeType,
  RolePermissionGrant,
  UpdateIamRole,
} from '../../shared/index.js'

interface RoleManagementDependencies {
  loadRoles: typeof listIamRoles
  createRole: typeof createIamRole
  updateRole: typeof updateIamRole
  removeRole: typeof deleteIamRole
  loadCatalog: typeof listIamPermissionCatalog
  loadRolePermissions: typeof listIamRolePermissions
  replacePermissions: typeof replaceIamRolePermissions
}

/** Page-scoped role editor: list, create/update/delete, and full permission replacement. */
export function useIamRoleManagement(
  dependencies: RoleManagementDependencies = {
    loadRoles: listIamRoles,
    createRole: createIamRole,
    updateRole: updateIamRole,
    removeRole: deleteIamRole,
    loadCatalog: listIamPermissionCatalog,
    loadRolePermissions: listIamRolePermissions,
    replacePermissions: replaceIamRolePermissions,
  },
) {
  const roles = ref<IamRole[]>([])
  const catalog = ref<PermissionCatalogItem[]>([])
  const selectedId = ref('')
  const search = ref('')
  const busy = ref(false)
  const error = ref('')
  const creating = ref(false)
  const draftName = ref('')
  const draftCode = ref('')
  const draftDescription = ref('')
  const draftStatus = ref<'ACTIVE' | 'DISABLED'>('ACTIVE')
  const selectedPermissions = ref<Map<string, RoleDataScopeType>>(new Map())
  const permissionsDirty = ref(false)

  const listState = useApiRequestState()
  const catalogState = useApiRequestState()

  const selected = computed(() => roles.value.find((role) => role.id === selectedId.value))
  const filteredRoles = computed(() => {
    const keyword = search.value.trim().toLocaleLowerCase()
    if (keyword === '') return roles.value
    return roles.value.filter(
      (role) =>
        role.code.toLocaleLowerCase().includes(keyword) ||
        role.name.toLocaleLowerCase().includes(keyword),
    )
  })

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

  function applyRoleDraft(role: IamRole): void {
    draftName.value = role.name
    draftCode.value = role.code
    draftDescription.value = role.description ?? ''
    draftStatus.value = role.status
  }

  function resetPermissionDraft(
    grants: { permissionCode: string; scopeType: RoleDataScopeType }[],
  ) {
    selectedPermissions.value = new Map(
      grants.map((grant) => [grant.permissionCode, grant.scopeType]),
    )
    permissionsDirty.value = false
  }

  async function load(): Promise<void> {
    const [rolesResult, catalogResult] = await Promise.all([
      dependencies.loadRoles(listState.options),
      dependencies.loadCatalog(catalogState.options),
    ])
    if (rolesResult.error !== null) throw rolesResult.error
    if (catalogResult.error !== null) throw catalogResult.error
    roles.value = rolesResult.data.roles
    catalog.value = catalogResult.data.permissions
  }

  async function loadSelectedPermissions(id: string): Promise<void> {
    const result = await dependencies.loadRolePermissions(id)
    if (result.error !== null) throw result.error
    resetPermissionDraft(result.data.permissions)
  }

  function select(id: string) {
    selectedId.value = id
    creating.value = false
    const role = roles.value.find((item) => item.id === id)
    if (role !== undefined) applyRoleDraft(role)
    void run(() => loadSelectedPermissions(id))
  }

  function beginCreate() {
    creating.value = true
    selectedId.value = ''
    draftName.value = ''
    draftCode.value = ''
    draftDescription.value = ''
    draftStatus.value = 'ACTIVE'
    selectedPermissions.value = new Map()
    permissionsDirty.value = false
  }

  function cancelCreate() {
    creating.value = false
  }

  async function createRole(input: CreateIamRole) {
    await run(async () => {
      const result = await dependencies.createRole(input)
      if (result.error !== null) throw result.error
      roles.value = [...roles.value, result.data].toSorted((a, b) => a.code.localeCompare(b.code))
      creating.value = false
      selectedId.value = result.data.id
      applyRoleDraft(result.data)
      resetPermissionDraft([])
    })
  }

  async function saveSelected() {
    const role = selected.value
    if (role === undefined) return
    await run(async () => {
      const input: UpdateIamRole = {
        name: draftName.value.trim(),
        description: draftDescription.value.trim() === '' ? null : draftDescription.value.trim(),
        status: draftStatus.value,
      }
      const result = await dependencies.updateRole(role.id, input)
      if (result.error !== null) throw result.error
      roles.value = roles.value.map((item) => (item.id === role.id ? result.data : item))
      applyRoleDraft(result.data)
    })
  }

  async function removeSelected() {
    const role = selected.value
    if (role === undefined) return
    await run(async () => {
      const result = await dependencies.removeRole(role.id)
      if (result.error !== null) throw result.error
      roles.value = roles.value.filter((item) => item.id !== role.id)
      selectedId.value = ''
      selectedPermissions.value = new Map()
      permissionsDirty.value = false
    })
  }

  function togglePermission(code: string, enabled: boolean, scope: RoleDataScopeType = 'ALL') {
    const next = new Map(selectedPermissions.value)
    if (enabled) next.set(code, scope)
    else next.delete(code)
    selectedPermissions.value = next
    permissionsDirty.value = true
  }

  async function savePermissions() {
    const role = selected.value
    if (role === undefined) return
    await run(async () => {
      const permissions: RolePermissionGrant[] = [...selectedPermissions.value].map(
        ([permissionCode, scopeType]) => ({ permissionCode, scopeType }),
      )
      const result = await dependencies.replacePermissions(role.id, { permissions })
      if (result.error !== null) throw result.error
      resetPermissionDraft(result.data.permissions)
    })
  }

  onMounted(() => {
    void run(async () => {
      await load()
      const first = roles.value[0]
      if (first === undefined) return
      selectedId.value = first.id
      creating.value = false
      applyRoleDraft(first)
      await loadSelectedPermissions(first.id)
    })
  })

  return {
    roles,
    filteredRoles,
    catalog,
    selected,
    selectedId,
    search,
    busy,
    error,
    creating,
    draftName,
    draftCode,
    draftDescription,
    draftStatus,
    selectedPermissions,
    permissionsDirty,
    loading: listState.loading,
    select,
    beginCreate,
    cancelCreate,
    createRole,
    saveSelected,
    removeSelected,
    togglePermission,
    savePermissions,
    load,
  }
}
