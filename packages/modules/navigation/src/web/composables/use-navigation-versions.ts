import { ref } from 'vue'
import type * as Client from '../../client/index.js'
import type { AdminNavigation, NavigationVersion } from '../../shared/index.js'
import type { NavigationEditor } from './use-navigation-editor.js'
import type { NavigationFeedback } from './use-navigation-feedback.js'

type VersionClient = Pick<typeof Client, 'getNavigationAdmin' | 'getNavigationVersion' | 'createNavigationDraft'
  | 'saveNavigationDraft' | 'validateNavigationVersion' | 'publishNavigationVersion'>

/** Version workflow owns persistence/concurrency, not local field editing or role grant state. */
export function useNavigationVersions(api: VersionClient, editor: NavigationEditor,
  feedback: NavigationFeedback, confirm: (message: string) => boolean) {
  const { getNavigationAdmin, getNavigationVersion, createNavigationDraft, saveNavigationDraft,
    validateNavigationVersion, publishNavigationVersion } = api
  const { version, dirty, selected, selectNode, applyJson } = editor
  const { run, message, error } = feedback
  const admin = ref<AdminNavigation>({ publishedVersionId: null, versions: [] })
  const published = ref<NavigationVersion | null>(null)
  async function loadIndex() {
    admin.value = await getNavigationAdmin()
    published.value = admin.value.publishedVersionId === null ? null : await getNavigationVersion(admin.value.publishedVersionId)
  }
  async function selectVersion(id: string) {
    if (dirty.value && !confirm('当前修改尚未保存，是否放弃？')) return
    await run(async () => {
      version.value = await getNavigationVersion(id)
      dirty.value = false
      selectNode(version.value.nodes[0]?.id ?? '')
    })
  }
  async function newDraft() {
    if (dirty.value && !confirm('当前修改未保存，仍要创建新草稿？')) return
    await run(async () => {
      version.value = await createNavigationDraft(version.value?.id ?? null)
      dirty.value = false
      selectNode(version.value.nodes[0]?.id ?? '')
      await loadIndex()
      message.value = '已创建草稿；普通用户仍使用当前发布版本。'
    })
  }
  async function save() {
    await run(async () => {
      if (version.value === null) return
      applyJson()
      const code = selected.value?.code
      version.value = await saveNavigationDraft(version.value.id, {
        expectedEditRevision: version.value.editRevision, authEntryCode: version.value.authEntryCode,
        homeCode: version.value.homeCode, nodes: version.value.nodes,
      })
      dirty.value = false
      selectNode(version.value.nodes.find((node) => node.code === code)?.id ?? '')
      await loadIndex()
      message.value = '草稿已保存并通过校验，尚未发布。'
    })
  }
  async function validate() {
    await run(async () => {
      if (version.value === null) return
      const result = await validateNavigationVersion(version.value.id)
      if (result.issues.length > 0) error.value = result.issues.map((issue) => issue.message).join('\n')
      else message.value = '已保存版本校验通过。'
    })
  }
  async function publish(rollback: boolean) {
    if (version.value === null || dirty.value) return
    if (!confirm(rollback ? '将线上导航切换到所选历史版本？角色授权不会回滚。' : '发布此草稿，替换当前线上导航？')) return
    await run(async () => {
      if (version.value === null) return
      version.value = await publishNavigationVersion(version.value.id, {
        expectedEditRevision: version.value.editRevision, expectedPublishedVersionId: admin.value.publishedVersionId,
      }, rollback)
      await loadIndex()
      message.value = '导航已生效。重新进入工作区可加载新的菜单与路径。'
    })
  }
  return { admin, published, loadIndex, selectVersion, newDraft, save, validate, publish }
}
