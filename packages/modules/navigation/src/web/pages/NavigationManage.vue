<script setup lang="ts">
import { Button, PageContainer } from '@jingwei/ui'

import { isContainer, isInternal, navigationNodeTypes } from '../../shared/index.js'
import { useNavigationManagement } from '../composables/use-navigation-management.js'

const { catalog, feedback, editor, versions, roles } = useNavigationManagement()
const { busy, message, error } = feedback
const {
  version,
  selectedId,
  selected,
  dirty,
  paramsText,
  queryText,
  readOnly,
  selectNode,
  changeType,
  changeRoute,
  addNode,
  removeNode,
} = editor
const { admin, selectVersion, newDraft, save, validate, publish } = versions
const { roleId, loadedRoleId, grants, assignable, retiredCodes, loadRole, saveGrants } = roles
</script>

<template>
  <PageContainer title="导航管理" description="统一节点 · 版本发布 · 按 navigation code 授权">
    <p v-if="error" role="alert" class="notice error">
      {{ error }}
    </p>
    <p v-if="message" role="status" class="notice">
      {{ message }}
    </p>
    <div class="toolbar">
      <label
        >查看版本
        <select
          :value="version?.id ?? ''"
          :disabled="busy"
          @change="selectVersion(($event.target as HTMLSelectElement).value)"
        >
          <option v-if="admin.versions.length === 0" value="">尚无版本</option>
          <option v-for="item in admin.versions" :key="item.id" :value="item.id">
            V{{ item.revision }} · {{ item.status === 'DRAFT' ? '草稿' : '已发布快照'
            }}{{ item.id === admin.publishedVersionId ? ' · 当前使用' : '' }}
          </option>
        </select>
      </label>
      <Button :disabled="busy" variant="outline" @click="newDraft"> 基于所选版本创建草稿 </Button>
      <a href="/">重新进入工作区</a>
    </div>
    <section v-if="version" class="panel">
      <div class="toolbar">
        <strong
          >V{{ version.revision }} / 编辑修订 {{ version.editRevision
          }}{{ dirty ? ' · 未保存' : '' }}</strong
        >
        <Button :disabled="readOnly" @click="save">保存草稿</Button>
        <Button :disabled="busy || dirty" variant="outline" @click="validate">
          校验已保存版本
        </Button>
        <Button :disabled="readOnly || dirty" @click="publish(false)">发布</Button>
        <Button
          :disabled="
            busy || version.status !== 'PUBLISHED' || version.id === admin.publishedVersionId
          "
          variant="danger"
          @click="publish(true)"
        >
          回滚到此版本
        </Button>
      </div>
      <fieldset :disabled="readOnly" class="entries" @input="dirty = true" @change="dirty = true">
        <label>登录入口 code<input v-model="version.authEntryCode" /></label>
        <label
          >默认首页
          <select v-model="version.homeCode">
            <option :value="null">首个可见菜单</option>
            <option
              v-for="node in version.nodes.filter(isInternal)"
              :key="node.id"
              :value="node.code"
            >
              {{ node.name }} · {{ node.code }}
            </option>
          </select>
        </label>
      </fieldset>
      <div class="editor">
        <div>
          <div class="toolbar">
            <Button :disabled="readOnly" variant="outline" @click="addNode">新增节点</Button>
            <Button :disabled="readOnly || !selected" variant="danger" @click="removeNode">
              删除节点
            </Button>
          </div>
          <div class="node-list">
            <Button
              v-for="node in version.nodes"
              :key="node.id"
              class="node"
              :class="{ selected: node.id === selectedId }"
              size="sm"
              variant="ghost"
              @click="selectNode(node.id)"
            >
              <strong>{{ node.name }}</strong
              ><small>{{ node.type }} · {{ node.code }} · {{ node.status }}</small>
            </Button>
          </div>
        </div>
        <fieldset
          v-if="selected"
          :disabled="readOnly"
          class="fields"
          @input="dirty = true"
          @change="dirty = true"
        >
          <label>名称<input v-model="selected.name" /></label>
          <label>稳定 code<input v-model="selected.code" /></label>
          <label
            >类型<select v-model="selected.type" @change="changeType">
              <option v-for="type in navigationNodeTypes" :key="type">{{ type }}</option>
            </select></label
          >
          <label
            >状态<select v-model="selected.status">
              <option>ENABLED</option>
              <option>DISABLED</option>
            </select></label
          >
          <label
            >父节点<select v-model="selected.parentId">
              <option :value="null">根节点</option>
              <option
                v-for="node in version.nodes.filter(
                  (n) =>
                    n.id !== selected?.id &&
                    (isContainer(n) || (selected?.type === 'PAGE' && isInternal(n))),
                )"
                :key="node.id"
                :value="node.id"
              >
                {{ node.name }} · {{ node.code }}
              </option>
            </select></label
          >
          <label>同级排序<input v-model.number="selected.sortOrder" type="number" /></label>
          <label
            >图标 key<input
              v-model="selected.icon"
              placeholder="settings / user / grid / folder / link / book"
          /></label>
          <label v-if="!isContainer(selected)"
            >访问模式<select v-model="selected.accessMode">
              <option>PUBLIC</option>
              <option>AUTHENTICATED</option>
              <option>PERMISSION</option>
            </select></label
          >
          <template v-if="isInternal(selected)">
            <label
              >routeKey<select v-model="selected.routeKey" @change="changeRoute">
                <option :value="null">选择页面</option>
                <option v-for="route in catalog.routes" :key="route.key" :value="route.key">
                  {{ route.key }}
                </option>
              </select></label
            >
            <label
              >布局<select v-model="selected.layout">
                <option
                  v-for="layout in catalog.routes.find((r) => r.key === selected?.routeKey)
                    ?.allowedLayouts ?? ['base', 'blank']"
                  :key="layout"
                >
                  {{ layout }}
                </option>
              </select></label
            >
            <label class="wide"
              >路径模式<input v-model="selected.path" placeholder="/example/:id"
            /></label>
            <label
              >默认 params（JSON）<textarea v-model="paramsText" rows="4" spellcheck="false" />
            </label>
            <label
              >默认 query（JSON）<textarea v-model="queryText" rows="4" spellcheck="false" />
            </label>
          </template>
          <template v-if="selected.type === 'EXTERNAL_LINK'">
            <label class="wide">HTTPS 外链<input v-model="selected.href" type="url" /></label>
            <label
              >打开方式<select v-model="selected.externalTarget">
                <option>BLANK</option>
                <option>SELF</option>
              </select></label
            >
          </template>
        </fieldset>
        <p v-else>选择一个节点编辑。</p>
      </div>
    </section>
    <section class="panel">
      <h2>角色导航授权</h2>
      <p>
        只控制导航可见性。目录/分组自动保留；业务 API 权限仍独立鉴权。授权使用当前发布版本的稳定
        code。
      </p>
      <div class="toolbar">
        <label
          >角色<select v-model="roleId" :disabled="busy" @change="loadRole">
            <option value="">选择角色</option>
            <option v-for="role in catalog.roles" :key="role.id" :value="role.id">
              {{ role.name }} · {{ role.code }}
            </option>
          </select></label
        >
        <Button :disabled="busy || !roleId || loadedRoleId !== roleId" @click="saveGrants">
          保存角色导航授权
        </Button>
      </div>
      <div v-if="roleId && loadedRoleId === roleId" class="grants">
        <label v-for="node in assignable" :key="node.code"
          ><input v-model="grants" type="checkbox" :value="node.code" :disabled="busy" />{{
            node.name
          }}
          <code>{{ node.code }}</code></label
        >
        <label v-for="code in retiredCodes" :key="code" class="error"
          ><input
            v-model="grants"
            type="checkbox"
            :value="code"
          />已不在当前可授权节点中，请取消：{{ code }}</label
        >
      </div>
    </section>
  </PageContainer>
</template>

<style scoped>
.panel {
  border: 1px solid var(--jw-color-border);
  border-radius: 0.65rem;
  padding: 1rem;
  background: white;
  margin-top: 1rem;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  align-items: end;
  margin-bottom: 0.9rem;
}
.toolbar strong {
  margin-right: auto;
  align-self: center;
}
label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.82rem;
  color: #42516a;
}
input,
select,
textarea {
  font: inherit;
  padding: 0.55rem 0.65rem;
  border: 1px solid #ccd5e2;
  border-radius: 0.35rem;
  max-width: 100%;
}
fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}
.entries,
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
}
.entries {
  margin-bottom: 1rem;
}
.editor {
  display: grid;
  grid-template-columns: minmax(13rem, 1fr) minmax(0, 2fr);
  gap: 1rem;
}
.node-list {
  display: grid;
  gap: 0.35rem;
  max-height: 36rem;
  overflow: auto;
}
.node {
  display: grid;
  text-align: left;
  gap: 0.3rem;
  width: 100%;
}
.node.selected {
  background: #e8effe;
  border-color: #4b78c5;
}
small {
  font-size: 0.7rem;
  overflow-wrap: anywhere;
}
.wide {
  grid-column: 1 / -1;
}
.notice {
  white-space: pre-wrap;
  padding: 0.8rem;
  background: #eef5ff;
  border-radius: 0.4rem;
}
.error {
  color: #a52323;
}
.grants {
  display: grid;
  gap: 0.5rem;
}
.grants label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
code {
  font-size: 0.75rem;
}
h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}
p {
  font-size: 0.85rem;
  color: #65758b;
}
@media (max-width: 1050px) {
  .editor {
    grid-template-columns: 1fr;
  }
  .node-list {
    max-height: 15rem;
  }
}
@media (max-width: 600px) {
  .entries,
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
