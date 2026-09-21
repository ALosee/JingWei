<script setup lang="ts">
import { onMounted } from 'vue'

import { Button, ButtonLoading, Input, dialog } from '@jingwei/ui'

import type { PlatformTenant } from '../shared/index.js'
import { usePlatformTenants } from './composables/use-platform-tenants.js'

const {
  tenants,
  errorMessage,
  creationOpen,
  creation,
  loading,
  mutating,
  load,
  create,
  transition,
} = usePlatformTenants()

onMounted(() => void load())

const statusPresentation: Record<PlatformTenant['status'], { label: string; className: string }> = {
  PROVISIONING: { label: '初始化中', className: 'bg-warning/12 text-warning' },
  ACTIVE: { label: '正常', className: 'bg-success/12 text-success' },
  SUSPENDED: { label: '已暂停', className: 'bg-muted text-muted-foreground' },
  DISABLED: { label: '已停用', className: 'bg-destructive/10 text-destructive' },
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function requestTransition(tenant: PlatformTenant, action: 'suspend' | 'resume' | 'disable') {
  if (action === 'resume') {
    void transition(tenant, action)
    return
  }
  const disabling = action === 'disable'
  dialog.warning(disabling ? '停用租户' : '暂停租户', {
    description: disabling
      ? `确认永久停用租户「${tenant.name}」？停用后不能从管理页面恢复。`
      : `确认暂停租户「${tenant.name}」？暂停期间该租户用户无法登录。`,
    confirmText: disabling ? '确认停用' : '确认暂停',
    cancelText: '取消',
    onConfirm: () => {
      void transition(tenant, action)
    },
  })
}
</script>

<template>
  <section>
    <header class="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="m-0 mb-2 text-xs text-primary font-700 tracking-[0.15em] uppercase">Tenants</p>
        <h1 class="m-0 text-3xl font-740 tracking-[-0.035em]">租户管理</h1>
        <p class="mb-0 mt-2 text-sm text-muted-foreground">
          创建租户、初始化首位管理员，并控制租户的启停状态。
        </p>
      </div>
      <Button @click="creationOpen = !creationOpen">
        {{ creationOpen ? '收起创建表单' : '创建租户' }}
      </Button>
    </header>

    <form
      v-if="creationOpen"
      class="mb-7 grid gap-5 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-7"
      @submit.prevent="create"
    >
      <div>
        <h2 class="m-0 text-lg font-700">新建租户</h2>
        <p class="mb-0 mt-1 text-xs text-muted-foreground">
          创建成功后，租户管理员使用“租户代码 + 管理员账号 + 初始密码”登录。
        </p>
      </div>
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label class="grid gap-2 text-sm font-620">
          租户代码
          <Input v-model="creation.code" required :maxlength="63" placeholder="例如 hunan" />
          <span class="text-xs text-muted-foreground font-400"
            >登录时使用，建议使用小写英文和数字</span
          >
        </label>
        <label class="grid gap-2 text-sm font-620">
          租户名称
          <Input v-model="creation.name" required :maxlength="200" placeholder="例如 湖南中航" />
        </label>
        <label class="grid gap-2 text-sm font-620">
          默认语言
          <Input v-model="creation.defaultLocale" required :maxlength="20" />
        </label>
        <label class="grid gap-2 text-sm font-620">
          默认时区
          <Input v-model="creation.defaultTimezone" required :maxlength="80" />
        </label>
        <label class="grid gap-2 text-sm font-620">
          默认币种
          <Input v-model="creation.defaultCurrency" required :maxlength="3" />
        </label>
      </div>

      <div class="border-t border-border pt-5">
        <h3 class="m-0 mb-4 text-sm font-700">首位租户管理员</h3>
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label class="grid gap-2 text-sm font-620">
            管理员账号
            <Input v-model="creation.adminLogin" required :maxlength="120" autocomplete="off" />
          </label>
          <label class="grid gap-2 text-sm font-620">
            显示名称
            <Input v-model="creation.adminName" required :maxlength="160" autocomplete="off" />
          </label>
          <label class="grid gap-2 text-sm font-620">
            邮箱（可选）
            <Input v-model="creation.adminEmail" type="email" :maxlength="320" autocomplete="off" />
          </label>
          <label class="grid gap-2 text-sm font-620">
            初始密码
            <Input
              v-model="creation.initialPassword"
              type="password"
              required
              :minlength="12"
              :maxlength="1024"
              autocomplete="new-password"
              placeholder="至少 12 位"
            />
          </label>
        </div>
      </div>

      <div class="flex justify-end gap-3">
        <Button type="button" variant="ghost" :disabled="mutating" @click="creationOpen = false">
          取消
        </Button>
        <ButtonLoading type="submit" :loading="mutating" loading-text="正在创建">
          创建并初始化
        </ButtonLoading>
      </div>
    </form>

    <p
      v-if="errorMessage"
      class="mb-5 rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive"
      role="alert"
    >
      {{ errorMessage }}
    </p>

    <div class="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div v-if="loading" class="p-12 text-center text-sm text-muted-foreground">正在加载租户…</div>
      <div v-else-if="tenants.length === 0" class="p-12 text-center">
        <p class="m-0 font-650">还没有租户</p>
        <p class="mb-0 mt-2 text-sm text-muted-foreground">
          点击“创建租户”开始初始化第一个工作空间。
        </p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-220 border-collapse text-left text-sm">
          <thead class="bg-muted/55 text-xs text-muted-foreground">
            <tr>
              <th class="px-5 py-3.5 font-650">租户</th>
              <th class="px-5 py-3.5 font-650">状态</th>
              <th class="px-5 py-3.5 font-650">默认设置</th>
              <th class="px-5 py-3.5 font-650">更新时间</th>
              <th class="px-5 py-3.5 text-right font-650">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="tenant in tenants" :key="tenant.id" class="border-t border-border/75">
              <td class="px-5 py-4">
                <RouterLink
                  class="font-680 text-foreground no-underline hover:text-primary hover:underline"
                  :to="`/platform/tenants/${tenant.id}`"
                >
                  {{ tenant.name }}
                </RouterLink>
                <p class="mb-0 mt-1 font-mono text-xs text-muted-foreground">{{ tenant.code }}</p>
              </td>
              <td class="px-5 py-4">
                <span
                  class="inline-flex rounded-full px-2.5 py-1 text-xs font-650"
                  :class="statusPresentation[tenant.status].className"
                >
                  {{ statusPresentation[tenant.status].label }}
                </span>
                <p
                  v-if="tenant.provisioningErrorCode"
                  class="mb-0 mt-1 max-w-64 truncate text-xs text-destructive"
                  :title="tenant.provisioningErrorCode"
                >
                  {{ tenant.provisioningErrorCode }}
                </p>
              </td>
              <td class="px-5 py-4 text-xs text-muted-foreground">
                {{ tenant.defaultLocale }} · {{ tenant.defaultTimezone }} ·
                {{ tenant.defaultCurrency }}
              </td>
              <td class="px-5 py-4 text-xs text-muted-foreground">
                {{ formatTime(tenant.updatedAt) }}
              </td>
              <td class="px-5 py-4">
                <div class="flex justify-end gap-1.5">
                  <Button
                    v-if="tenant.status === 'ACTIVE'"
                    size="sm"
                    variant="outline"
                    :disabled="mutating"
                    @click="requestTransition(tenant, 'suspend')"
                  >
                    暂停
                  </Button>
                  <Button
                    v-if="tenant.status === 'SUSPENDED'"
                    size="sm"
                    variant="soft"
                    :disabled="mutating"
                    @click="requestTransition(tenant, 'resume')"
                  >
                    恢复
                  </Button>
                  <Button
                    v-if="tenant.status === 'SUSPENDED' || tenant.status === 'PROVISIONING'"
                    size="sm"
                    variant="ghost"
                    :disabled="mutating"
                    @click="requestTransition(tenant, 'disable')"
                  >
                    停用
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
