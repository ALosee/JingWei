<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { Button, ButtonLoading, Input, dialog } from '@jingwei/ui'

import { usePlatformTenantDetail } from './composables/use-platform-tenant-detail.js'

const route = useRoute()
const tenantId = computed(() => String(route.params.tenantId ?? ''))
const { tenant, retryInput, errorMessage, loading, mutating, load, retry, transition } =
  usePlatformTenantDetail(tenantId.value)

onMounted(() => void load())

const statusLabel = computed(() => {
  switch (tenant.value?.status) {
    case 'ACTIVE':
      return '正常'
    case 'SUSPENDED':
      return '已暂停'
    case 'DISABLED':
      return '已停用'
    default:
      return '初始化中'
  }
})

function requestTransition(action: 'suspend' | 'resume' | 'disable') {
  if (tenant.value === null) return
  if (action === 'resume') {
    void transition(action)
    return
  }
  const disabling = action === 'disable'
  dialog.warning(disabling ? '停用租户' : '暂停租户', {
    description: disabling
      ? `确认永久停用租户「${tenant.value.name}」？停用后不能从管理页面恢复。`
      : `确认暂停租户「${tenant.value.name}」？暂停期间该租户用户无法登录。`,
    confirmText: disabling ? '确认停用' : '确认暂停',
    cancelText: '取消',
    onConfirm: () => {
      void transition(action)
    },
  })
}
</script>

<template>
  <section>
    <RouterLink
      class="mb-5 inline-flex text-sm text-muted-foreground no-underline hover:text-primary"
      to="/platform/tenants"
    >
      ← 返回租户列表
    </RouterLink>

    <div
      v-if="loading"
      class="rounded-2xl border border-border bg-background p-12 text-center text-muted-foreground"
    >
      正在加载租户…
    </div>

    <template v-else-if="tenant">
      <header class="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="mb-2 flex items-center gap-3">
            <p class="m-0 font-mono text-xs text-primary font-650">{{ tenant.code }}</p>
            <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground font-650">
              {{ statusLabel }}
            </span>
          </div>
          <h1 class="m-0 text-3xl font-740 tracking-[-0.035em]">{{ tenant.name }}</h1>
          <p class="mb-0 mt-2 font-mono text-xs text-muted-foreground">{{ tenant.id }}</p>
        </div>
        <div class="flex gap-2">
          <Button
            v-if="tenant.status === 'ACTIVE'"
            variant="outline"
            :disabled="mutating"
            @click="requestTransition('suspend')"
          >
            暂停租户
          </Button>
          <Button
            v-if="tenant.status === 'SUSPENDED'"
            :disabled="mutating"
            @click="requestTransition('resume')"
          >
            恢复租户
          </Button>
          <Button
            v-if="tenant.status === 'SUSPENDED' || tenant.status === 'PROVISIONING'"
            variant="ghost"
            :disabled="mutating"
            @click="requestTransition('disable')"
          >
            停用租户
          </Button>
        </div>
      </header>

      <p
        v-if="errorMessage"
        class="mb-5 rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <div class="grid gap-5 lg:grid-cols-2">
        <article class="rounded-2xl border border-border bg-background p-6 shadow-sm">
          <h2 class="m-0 mb-5 text-base font-700">基础信息</h2>
          <dl class="m-0 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-4 text-sm">
            <dt class="text-muted-foreground">默认语言</dt>
            <dd class="m-0">{{ tenant.defaultLocale }}</dd>
            <dt class="text-muted-foreground">默认时区</dt>
            <dd class="m-0">{{ tenant.defaultTimezone }}</dd>
            <dt class="text-muted-foreground">默认币种</dt>
            <dd class="m-0">{{ tenant.defaultCurrency }}</dd>
            <dt class="text-muted-foreground">配置版本</dt>
            <dd class="m-0">{{ tenant.version }}</dd>
            <dt class="text-muted-foreground">创建时间</dt>
            <dd class="m-0">{{ new Date(tenant.createdAt).toLocaleString('zh-CN') }}</dd>
            <dt class="text-muted-foreground">更新时间</dt>
            <dd class="m-0">{{ new Date(tenant.updatedAt).toLocaleString('zh-CN') }}</dd>
          </dl>
        </article>

        <article class="rounded-2xl border border-border bg-background p-6 shadow-sm">
          <h2 class="m-0 mb-5 text-base font-700">初始化状态</h2>
          <dl class="m-0 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-4 text-sm">
            <dt class="text-muted-foreground">当前步骤</dt>
            <dd class="m-0 font-mono text-xs">{{ tenant.provisioningStep }}</dd>
            <dt class="text-muted-foreground">错误代码</dt>
            <dd
              class="m-0 break-all"
              :class="tenant.provisioningErrorCode ? 'text-destructive' : ''"
            >
              {{ tenant.provisioningErrorCode ?? '无' }}
            </dd>
          </dl>
        </article>
      </div>

      <form
        v-if="tenant.status === 'PROVISIONING' && tenant.provisioningErrorCode"
        class="mt-5 grid gap-5 rounded-2xl border border-warning/35 bg-warning/5 p-6"
        @submit.prevent="retry"
      >
        <div>
          <h2 class="m-0 text-base font-700">重试初始化</h2>
          <p class="mb-0 mt-1 text-xs text-muted-foreground">
            初始化流程可安全重试；请输入首位租户管理员信息继续未完成步骤。
          </p>
        </div>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label class="grid gap-2 text-sm font-620">
            管理员账号
            <Input v-model="retryInput.adminLogin" required :maxlength="120" autocomplete="off" />
          </label>
          <label class="grid gap-2 text-sm font-620">
            显示名称
            <Input v-model="retryInput.adminName" required :maxlength="160" autocomplete="off" />
          </label>
          <label class="grid gap-2 text-sm font-620">
            邮箱（可选）
            <Input
              v-model="retryInput.adminEmail"
              type="email"
              :maxlength="320"
              autocomplete="off"
            />
          </label>
          <label class="grid gap-2 text-sm font-620">
            初始密码
            <Input
              v-model="retryInput.initialPassword"
              type="password"
              required
              :minlength="12"
              :maxlength="1024"
              autocomplete="new-password"
            />
          </label>
        </div>
        <div class="flex justify-end">
          <ButtonLoading type="submit" :loading="mutating" loading-text="正在重试">
            重试初始化
          </ButtonLoading>
        </div>
      </form>
    </template>

    <p
      v-else-if="errorMessage"
      class="rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive"
    >
      {{ errorMessage }}
    </p>
  </section>
</template>
