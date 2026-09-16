import { computed, onMounted, ref } from 'vue'

import type { ApiRequestOptions } from '@jingwei/api-client'
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
import { useIamPermission } from '../../session/index.js'
import type {
  CreateIamRole,
  IamRole,
  PermissionCatalogItem,
  RoleDataScopeType,
  RolePermissionGrant,
  UpdateIamRole,
} from '../../shared/index.js'
import {
  useCustomScopeReferenceDirectory,
  type CustomScopeReferenceOption,
} from '../scope-reference-directory.js'

export interface PermissionGrantDraft {
  readonly scopeType: RoleDataScopeType
  readonly organizationIds: readonly string[]
}

interface RoleManagementDependencies {
  loadRoles: typeof listIamRoles
  createRole: typeof createIamRole
  updateRole: typeof updateIamRole
  removeRole: typeof deleteIamRole
  loadCatalog: typeof listIamPermissionCatalog
  loadRolePermissions: typeof listIamRolePermissions
  replacePermissions: typeof replaceIamRolePermissions
  loadScopeReferences: (
    options?: ApiRequestOptions,
  ) => Promise<readonly CustomScopeReferenceOption[]>
}

/** Page-scoped role editor: list, create/update/delete, and full permission replacement. */
export function useIamRoleManagement(dependencies?: RoleManagementDependencies) {
  const scopeDirectory = dependencies === undefined ? useCustomScopeReferenceDirectory() : null
  const services: RoleManagementDependencies = dependencies ?? {
    loadRoles: listIamRoles,
    createRole: createIamRole,
    updateRole: updateIamRole,
    removeRole: deleteIamRole,
    loadCatalog: listIamPermissionCatalog,
    loadRolePermissions: listIamRolePermissions,
    replacePermissions: replaceIamRolePermissions,
    loadScopeReferences:
      scopeDirectory?.load.bind(scopeDirectory) ??
      (() => Promise.reject(new Error('当前版本未提供自定义数据范围选择器'))),
  }
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
  const selectedPermissions = ref<Map<string, PermissionGrantDraft>>(new Map())
  const permissionsDirty = ref(false)
  const organizationOptions = ref<CustomScopeReferenceOption[]>([])
  const organizationOptionsError = ref('')
  /** Functional permission is enforced on the server; this only improves button UX. */
  const canManage = useIamPermission('iam.role.manage')

  const listState = useApiRequestState()
  const catalogState = useApiRequestState()
  const organizationState = useApiRequestState()

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
    grants: {
      permissionCode: string
      scopeType: RoleDataScopeType
      organizationIds?: readonly string[] | undefined
    }[],
  ) {
    selectedPermissions.value = new Map(
      grants.map((grant) => [
        grant.permissionCode,
        {
          scopeType: grant.scopeType,
          organizationIds: grant.organizationIds ?? [],
        },
      ]),
    )
    permissionsDirty.value = false
  }

  async function load(): Promise<void> {
    const [rolesResult, catalogResult] = await Promise.all([
      services.loadRoles(listState.options),
      services.loadCatalog(catalogState.options),
    ])
    if (rolesResult.error !== null) throw rolesResult.error
    if (catalogResult.error !== null) throw catalogResult.error
    roles.value = rolesResult.data.roles
    catalog.value = catalogResult.data.permissions
  }

  async function loadOrganizationDirectory(): Promise<void> {
    organizationOptionsError.value = ''
    try {
      organizationOptions.value = [
        ...(await services.loadScopeReferences(organizationState.options)),
      ]
    } catch (cause) {
      organizationOptions.value = []
      organizationOptionsError.value = errorMessage(cause)
    }
  }

  async function loadSelectedPermissions(id: string): Promise<void> {
    const result = await services.loadRolePermissions(id)
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
      const result = await services.createRole(input)
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
      const result = await services.updateRole(role.id, input)
      if (result.error !== null) throw result.error
      roles.value = roles.value.map((item) => (item.id === role.id ? result.data : item))
      applyRoleDraft(result.data)
    })
  }

  async function removeSelected() {
    const role = selected.value
    if (role === undefined) return
    await run(async () => {
      const result = await services.removeRole(role.id)
      if (result.error !== null) throw result.error
      roles.value = roles.value.filter((item) => item.id !== role.id)
      selectedId.value = ''
      selectedPermissions.value = new Map()
      permissionsDirty.value = false
    })
  }

  function togglePermission(
    code: string,
    enabled: boolean,
    scope: RoleDataScopeType = 'ALL',
    organizationIds: readonly string[] = [],
  ) {
    const next = new Map(selectedPermissions.value)
    if (enabled)
      next.set(code, {
        scopeType: scope,
        organizationIds: scope === 'CUSTOM' ? organizationIds : [],
      })
    else next.delete(code)
    selectedPermissions.value = next
    permissionsDirty.value = true
  }

  function setPermissionScope(code: string, scopeType: RoleDataScopeType) {
    const existing = selectedPermissions.value.get(code)
    if (existing === undefined) return
    togglePermission(code, true, scopeType, existing.organizationIds)
  }

  function setPermissionOrganizations(code: string, organizationIds: readonly string[]) {
    const existing = selectedPermissions.value.get(code)
    if (existing?.scopeType !== 'CUSTOM') return
    togglePermission(code, true, 'CUSTOM', organizationIds)
  }

  function togglePermissionOrganization(code: string, orgUnitId: string, enabled: boolean) {
    const existing = selectedPermissions.value.get(code)
    if (existing?.scopeType !== 'CUSTOM') return
    const current = new Set(existing.organizationIds)
    if (enabled) current.add(orgUnitId)
    else current.delete(orgUnitId)
    setPermissionOrganizations(
      code,
      [...current].toSorted((a, b) => a.localeCompare(b)),
    )
  }

  const canSavePermissions = computed(() => {
    for (const draft of selectedPermissions.value.values()) {
      if (draft.scopeType === 'CUSTOM' && draft.organizationIds.length === 0) return false
    }
    return true
  })

  async function savePermissions() {
    const role = selected.value
    if (role === undefined) return
    if (!canSavePermissions.value) {
      error.value = '自定义组织范围必须至少选择一个组织'
      return
    }
    await run(async () => {
      const permissions: RolePermissionGrant[] = [...selectedPermissions.value].map(
        ([permissionCode, draft]) => ({
          permissionCode,
          scopeType: draft.scopeType,
          ...(draft.scopeType === 'CUSTOM' && draft.organizationIds.length > 0
            ? { organizationIds: [...draft.organizationIds] }
            : {}),
        }),
      )
      const result = await services.replacePermissions(role.id, { permissions })
      if (result.error !== null) throw result.error
      resetPermissionDraft(result.data.permissions)
    })
  }

  onMounted(() => {
    void run(async () => {
      await load()
      if (
        catalog.value.some(
          (permission) =>
            permission.dataScopeProvider !== null &&
            permission.allowedScopeTypes.includes('CUSTOM'),
        )
      )
        await loadOrganizationDirectory()
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
    canManage,
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
    canSavePermissions,
    organizationOptions,
    organizationOptionsError,
    loading: computed(
      () =>
        listState.loading.value || catalogState.loading.value || organizationState.loading.value,
    ),
    select,
    beginCreate,
    cancelCreate,
    createRole,
    saveSelected,
    removeSelected,
    togglePermission,
    setPermissionScope,
    setPermissionOrganizations,
    togglePermissionOrganization,
    savePermissions,
    load,
  }
}
