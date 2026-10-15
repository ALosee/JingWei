import { computed, onMounted, onScopeDispose, ref, shallowRef, type Ref } from 'vue'

import { useApiRequestState } from '@jingwei/api-client/vue'

import {
  addIamRoleMembers,
  clearIamRoleMembers,
  listIamRoleMemberCandidates,
  listIamRoleMembers,
  removeIamRoleMembers,
} from '../../client/index.js'
import { useIamPermission } from '../../session/index.js'
import type { IamRole, RoleMemberChangeResult, RoleMemberPage } from '../../shared/index.js'

interface RoleMemberServices {
  list: typeof listIamRoleMembers
  candidates: typeof listIamRoleMemberCandidates
  add: typeof addIamRoleMembers
  remove: typeof removeIamRoleMembers
  clear: typeof clearIamRoleMembers
  refreshWorkspace(): void
}

export function useRoleMembers(
  role: Readonly<Ref<IamRole>>,
  onChanged: (value: { roleId: string; assignmentCount: number }) => void,
  services: RoleMemberServices = {
    list: listIamRoleMembers,
    candidates: listIamRoleMemberCandidates,
    add: addIamRoleMembers,
    remove: removeIamRoleMembers,
    clear: clearIamRoleMembers,
    refreshWorkspace: () => window.location.reload(),
  },
) {
  const members = shallowRef<RoleMemberPage | null>(null)
  const candidates = shallowRef<RoleMemberPage | null>(null)
  const search = ref(''),
    page = ref(1),
    candidateSearch = ref(''),
    candidatePage = ref(1)
  const selected = ref(new Set<string>()),
    additions = ref(new Set<string>())
  const error = ref(''),
    addOpen = ref(false),
    addSnapshot = ref('')
  const listState = useApiRequestState(),
    candidateState = useApiRequestState(),
    mutationState = useApiRequestState()
  const roleManage = useIamPermission('iam.role.manage'),
    userManage = useIamPermission('iam.user.manage')
  const canManage = computed(() => roleManage.value && userManage.value)
  const busy = computed(
    () => listState.loading.value || candidateState.loading.value || mutationState.loading.value,
  )
  let alive = true,
    memberRequest = 0,
    candidateRequest = 0,
    changing = false
  onScopeDispose(() => {
    alive = false
  })

  async function loadMembers(): Promise<void> {
    const request = ++memberRequest,
      roleId = role.value.id
    const result = await services.list(
      roleId,
      { page: page.value, pageSize: 20, search: search.value.trim() },
      listState.options,
    )
    if (!alive || request !== memberRequest || role.value.id !== roleId) return
    if (result.error !== null) {
      error.value = result.error.message
      return
    }
    if (members.value?.snapshot !== result.data.snapshot) selected.value = new Set()
    members.value = result.data
    onChanged({ roleId, assignmentCount: result.data.assignmentCount })
    const lastPage = Math.max(1, Math.ceil(result.data.total / result.data.pageSize))
    if (page.value > lastPage) {
      page.value = lastPage
      await loadMembers()
    }
  }

  async function loadCandidates(): Promise<void> {
    const request = ++candidateRequest,
      roleId = role.value.id
    const result = await services.candidates(
      roleId,
      { page: candidatePage.value, pageSize: 20, search: candidateSearch.value.trim() },
      candidateState.options,
    )
    if (!alive || request !== candidateRequest || role.value.id !== roleId) return
    if (result.error !== null) {
      error.value = result.error.message
      return
    }
    candidates.value = result.data
  }

  const selectedOnPage = computed(() =>
    (members.value?.members ?? [])
      .filter((member) => selected.value.has(member.id))
      .map((member) => member.id),
  )

  function selectPage(userIds: readonly string[]): void {
    const visibleIds = new Set((members.value?.members ?? []).map((member) => member.id))
    const next = new Set([...selected.value].filter((id) => !visibleIds.has(id)))
    for (const id of userIds) if (visibleIds.has(id)) next.add(id)
    if (next.size > 500) {
      error.value = '每次最多选择 500 位用户；解除整个角色请使用“解除全部分配”'
      return
    }
    selected.value = next
  }

  function toggle(id: string, checked: boolean, adding = false) {
    const target = adding ? additions : selected
    const next = new Set(target.value)
    if (checked && next.size >= 500) {
      error.value = '每次最多选择 500 位用户；解除整个角色请使用“解除全部分配”'
      return
    }
    if (checked) next.add(id)
    else next.delete(id)
    target.value = next
  }

  function togglePage(adding = false) {
    const target = adding ? additions : selected
    const visible = (adding ? candidates.value : members.value)?.members ?? []
    const clear = visible.length > 0 && visible.every((member) => target.value.has(member.id))
    const next = new Set(target.value)
    for (const member of visible) {
      if (clear) next.delete(member.id)
      else next.add(member.id)
    }
    if (next.size > 500) {
      error.value = '每次最多选择 500 位用户；解除整个角色请使用“解除全部分配”'
      return
    }
    target.value = next
  }

  async function openAdd() {
    if (!canManage.value || role.value.status !== 'ACTIVE' || members.value === null) return
    error.value = ''
    additions.value = new Set()
    candidates.value = null
    candidateSearch.value = ''
    candidatePage.value = 1
    addSnapshot.value = members.value.snapshot
    addOpen.value = true
    await loadCandidates()
  }

  async function change(
    action: 'add' | 'remove' | 'clear',
    expectedSnapshot: string,
    userIds: readonly string[] = [],
  ): Promise<boolean> {
    if (changing || !canManage.value) return false
    changing = true
    error.value = ''
    const roleId = role.value.id
    try {
      const result =
        action === 'clear'
          ? await services.clear(roleId, { expectedSnapshot }, mutationState.options)
          : await services[action](
              roleId,
              { expectedSnapshot, userIds: [...userIds] },
              mutationState.options,
            )
      if (!alive) return false
      if (result.error !== null) {
        if (result.error.code === 'IAM_ROLE_MEMBERS_CONFLICT') {
          addOpen.value = false
          selected.value = new Set()
          additions.value = new Set()
          await loadMembers()
        }
        error.value = result.error.message
        return false
      }
      const changed: RoleMemberChangeResult = result.data
      onChanged({ roleId, assignmentCount: changed.assignmentCount })
      addOpen.value = false
      selected.value = new Set()
      additions.value = new Set()
      if (changed.affectsCurrentUser) {
        services.refreshWorkspace()
        return true
      }
      await loadMembers()
      return true
    } finally {
      changing = false
    }
  }

  async function findMembers() {
    error.value = ''
    page.value = 1
    await loadMembers()
  }
  async function findCandidates() {
    error.value = ''
    candidatePage.value = 1
    await loadCandidates()
  }
  async function movePage(delta: number, adding = false) {
    if (busy.value) return
    if (adding) {
      candidatePage.value += delta
      await loadCandidates()
    } else {
      page.value += delta
      await loadMembers()
    }
  }

  onMounted(() => {
    void loadMembers()
  })
  return {
    members,
    candidates,
    search,
    page,
    candidateSearch,
    candidatePage,
    selected,
    selectedOnPage,
    selectPage,
    additions,
    error,
    addOpen,
    addSnapshot,
    canManage,
    busy,
    loadMembers,
    loadCandidates,
    toggle,
    togglePage,
    openAdd,
    change,
    findMembers,
    findCandidates,
    movePage,
  }
}
