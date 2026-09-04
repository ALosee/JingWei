import { onMounted, ref } from 'vue'

import * as api from '../../client/index.js'
import type { NavigationCatalog } from '../../shared/index.js'
import { useNavigationEditor } from './use-navigation-editor.js'
import { useNavigationFeedback } from './use-navigation-feedback.js'
import { useNavigationVersions } from './use-navigation-versions.js'
import { useRoleNavigationGrants } from './use-role-navigation-grants.js'

/** Page composition: choose concrete client/dialog adapters and coordinate initial loading only. */
export function useNavigationManagement() {
  const confirm = (message: string) => window.confirm(message)
  const catalog = ref<NavigationCatalog>({ routes: [], roles: [] })
  const feedback = useNavigationFeedback()
  const editor = useNavigationEditor(catalog, feedback, confirm)
  const versions = useNavigationVersions(api, editor, feedback, confirm)
  const roles = useRoleNavigationGrants(api, versions.published, feedback, confirm)
  onMounted(() => {
    void feedback.run(async () => {
      await versions.loadIndex()
      catalog.value = await api.getNavigationCatalog()
      const id = versions.admin.value.publishedVersionId ?? versions.admin.value.versions[0]?.id
      if (id !== undefined) editor.replaceVersion(await api.getNavigationVersion(id))
    })
  })
  return { catalog, feedback, editor, versions, roles }
}
