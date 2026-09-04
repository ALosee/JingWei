import { computed, ref, type Ref } from 'vue'

import type * as Client from '../../client/index.js'
import { isContainer, type NavigationVersion } from '../../shared/index.js'
import type { NavigationFeedback } from './use-navigation-feedback.js'

type RoleClient = Pick<typeof Client, 'getRoleNavigation' | 'saveRoleNavigation'>

/** Role grants are independent of configuration versions and are never rolled back with them. */
export function useRoleNavigationGrants(
  api: RoleClient,
  published: Ref<NavigationVersion | null>,
  feedback: NavigationFeedback,
  confirm: (message: string) => boolean,
) {
  const { getRoleNavigation, saveRoleNavigation } = api
  const { run, message, busy } = feedback
  const roleId = ref('')
  const loadedRoleId = ref('')
  const grants = ref<string[]>([])
  const originalGrants = ref<string[]>([])
  const assignable = computed(
    () =>
      published.value?.nodes.filter(
        (node) => !isContainer(node) && node.accessMode === 'PERMISSION',
      ) ?? [],
  )
  const retiredCodes = computed(() =>
    grants.value.filter((code) => !assignable.value.some((node) => node.code === code)),
  )
  async function loadRole() {
    await run(async () => {
      // Failed reads must not leave another role's editable grants on screen.
      loadedRoleId.value = ''
      grants.value = []
      originalGrants.value = []
      if (!roleId.value) return
      const result = await getRoleNavigation(roleId.value)
      grants.value = [...result.codes]
      originalGrants.value = [...result.codes]
      loadedRoleId.value = roleId.value
    })
  }
  async function saveGrants() {
    if (!roleId.value || loadedRoleId.value !== roleId.value || busy.value) return
    if (!confirm('替换所选角色的导航授权？业务 API 权限不会变化。')) return
    await run(async () => {
      const result = await saveRoleNavigation(roleId.value, {
        codes: grants.value,
        expectedCodes: originalGrants.value,
      })
      grants.value = [...result.codes]
      originalGrants.value = [...result.codes]
      message.value = '角色导航授权已保存，不会改变业务 API 权限。'
    })
  }
  return { roleId, loadedRoleId, grants, assignable, retiredCodes, loadRole, saveGrants }
}
