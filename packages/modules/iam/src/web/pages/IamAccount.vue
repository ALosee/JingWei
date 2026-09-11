<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Button, ButtonLoading, Icon, Input, dialog, toast } from '@jingwei/ui'

import { useAccountProfile } from '../composables/use-account-profile.js'
import { useChangePassword } from '../composables/use-change-password.js'

const route = useRoute()
const router = useRouter()

const account = useAccountProfile()
const password = useChangePassword()

const sections = [
  { value: 'profile' as const, label: '基本资料', icon: 'lucide:user-round' },
  { value: 'security' as const, label: '安全设置', icon: 'lucide:shield-check' },
  { value: 'roles' as const, label: '我的角色', icon: 'lucide:badge-check' },
]

type AccountSection = (typeof sections)[number]['value']

const activeSection = ref<AccountSection>('profile')
const rolesLoaded = ref(false)
const avatarFailed = ref(false)

const profile = computed(() => account.profile.value)
const displayName = computed(() => profile.value?.displayName ?? '当前用户')
const initial = computed(() => displayName.value.trim().charAt(0).toLocaleUpperCase() || '用')
const avatarUrl = computed(() => {
  const value = account.draftAvatarUrl.value.trim() || profile.value?.avatarUrl
  if (!value || typeof window === 'undefined') return null
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
})
const statusMeta = computed(() => {
  const map = {
    INVITED: { label: '待激活', className: 'bg-warning/12 text-warning' },
    ACTIVE: { label: '正常', className: 'bg-success/12 text-success' },
    DISABLED: { label: '已禁用', className: 'bg-destructive/12 text-destructive' },
    LOCKED: { label: '已锁定', className: 'bg-destructive/12 text-destructive' },
  } as const
  const status = profile.value?.status
  return status === undefined ? null : map[status]
})
const passwordDirty = computed(
  () =>
    password.currentPassword.value.length > 0 ||
    password.newPassword.value.length > 0 ||
    password.confirmPassword.value.length > 0,
)

function formatDateTime(value: string | null): string {
  if (value === null) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false })
}

function resolveSection(value: unknown): AccountSection {
  return value === 'security' || value === 'roles' ? value : 'profile'
}

function ensureRolesLoaded(section: AccountSection): void {
  if (section !== 'roles' || rolesLoaded.value) return
  rolesLoaded.value = true
  void account.loadRoles()
}

watch(avatarUrl, () => {
  avatarFailed.value = false
})

watch(
  () => route.query.tab,
  (value) => {
    const next = resolveSection(Array.isArray(value) ? value[0] : value)
    if (activeSection.value === next) return
    activeSection.value = next
    ensureRolesLoaded(next)
  },
  { immediate: true },
)

watch(activeSection, (value) => {
  const current = Array.isArray(route.query.tab) ? route.query.tab[0] : route.query.tab
  if (current !== value) void router.replace({ query: { ...route.query, tab: value } })
  ensureRolesLoaded(value)
})

async function saveProfile(): Promise<void> {
  await account.save()
  if (account.errorMessage.value === '') toast.success('资料已保存')
}

function requestPasswordChange(): void {
  dialog.warning('更新密码', {
    description: '成功后，当前及其他设备上的登录状态都会失效，需要重新登录。',
    confirmText: '确认更新',
    cancelText: '取消',
    onConfirm: () => {
      void password.submit()
    },
  })
}

onMounted(() => {
  void account.load()
  ensureRolesLoaded(activeSection.value)
})
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-1 py-2">
    <!-- Identity -->
    <header class="flex flex-wrap items-center gap-4 border-b border-border pb-6">
      <div
        class="size-16 shrink-0 overflow-hidden rounded-full bg-primary/10 grid place-items-center text-primary text-xl font-700"
      >
        <img
          v-if="avatarUrl && !avatarFailed"
          :src="avatarUrl"
          alt=""
          class="size-full object-cover"
          referrerpolicy="no-referrer"
          @error="avatarFailed = true"
        />
        <span v-else aria-hidden="true">{{ initial }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="m-0 truncate text-xl text-foreground font-700">{{ displayName }}</h1>
          <span
            v-if="statusMeta"
            class="rounded-full px-2 py-0.5 text-xs font-500"
            :class="statusMeta.className"
          >
            {{ statusMeta.label }}
          </span>
        </div>
        <p class="m-0 mt-1 truncate text-sm text-muted-foreground">
          {{ profile?.username ?? '—' }}
          <span v-if="profile?.email"> · {{ profile.email }}</span>
        </p>
      </div>
    </header>

    <!-- Settings body -->
    <div class="mt-6 grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <nav class="lg:sticky lg:top-4 lg:self-start" aria-label="账号设置分区">
        <ul
          class="m-0 flex gap-1 overflow-x-auto p-0 list-none lg:grid lg:gap-1 lg:overflow-visible"
        >
          <li v-for="section in sections" :key="section.value" class="shrink-0">
            <button
              type="button"
              class="w-full flex items-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm text-left whitespace-nowrap transition-colors-150 cursor-pointer"
              :class="
                activeSection === section.value
                  ? 'bg-accent text-accent-foreground font-600'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              "
              :aria-current="activeSection === section.value ? 'page' : undefined"
              @click="activeSection = section.value"
            >
              <Icon :icon="section.icon" class="size-4 shrink-0" />
              {{ section.label }}
            </button>
          </li>
        </ul>
      </nav>

      <main class="min-w-0 grid gap-6">
        <p
          v-if="account.errorMessage.value"
          class="m-0 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {{ account.errorMessage.value }}
        </p>
        <p v-if="password.errorMessage.value" class="m-0 text-sm text-destructive" role="alert">
          {{ password.errorMessage.value }}
        </p>

        <!-- Profile -->
        <template v-if="activeSection === 'profile'">
          <p v-if="account.loading.value" class="m-0 text-sm text-muted-foreground">
            正在加载账号资料…
          </p>

          <template v-else-if="profile">
            <section class="rounded-lg border border-border bg-card">
              <header class="border-b border-border px-5 py-4">
                <h2 class="m-0 text-base text-foreground font-650">公开资料</h2>
                <p class="m-0 mt-1 text-sm text-muted-foreground">
                  这些信息会展示在工作区顶栏与协作场景中。
                </p>
              </header>
              <form class="grid gap-5 px-5 py-5" @submit.prevent="saveProfile">
                <div class="grid max-w-md gap-4">
                  <label class="grid gap-1.5">
                    <span class="text-sm text-foreground font-500">显示名</span>
                    <Input
                      v-model="account.draftDisplayName.value"
                      autocomplete="name"
                      :maxlength="160"
                      placeholder="在工作区中显示的名称"
                    />
                  </label>
                  <label class="grid gap-1.5">
                    <span class="text-sm text-foreground font-500">头像 URL</span>
                    <Input
                      v-model="account.draftAvatarUrl.value"
                      type="url"
                      :maxlength="512"
                      placeholder="https://…"
                    />
                    <span class="text-xs text-muted-foreground">
                      留空则使用显示名首字母头像；仅允许同源或 HTTPS 地址。
                    </span>
                  </label>
                </div>
                <div
                  v-if="account.dirty.value"
                  class="flex flex-wrap items-center gap-2 border-t border-border pt-4"
                >
                  <ButtonLoading type="submit" :loading="account.saving.value">保存</ButtonLoading>
                  <Button variant="ghost" type="button" @click="account.resetDraft">放弃</Button>
                  <span class="text-xs text-muted-foreground">有未保存的修改</span>
                </div>
              </form>
            </section>

            <section class="rounded-lg border border-border bg-card">
              <header class="border-b border-border px-5 py-4">
                <h2 class="m-0 text-base text-foreground font-650">账号信息</h2>
                <p class="m-0 mt-1 text-sm text-muted-foreground">由系统维护，当前不可自行修改。</p>
              </header>
              <dl class="m-0 grid gap-0 px-5 py-1">
                <div
                  v-for="row in [
                    { label: '用户名', value: profile.username },
                    { label: '邮箱', value: profile.email ?? '—' },
                    { label: '手机', value: profile.phone ?? '—' },
                    { label: '最近登录', value: formatDateTime(profile.lastLoginAt) },
                    { label: '创建时间', value: formatDateTime(profile.createdAt) },
                  ]"
                  :key="row.label"
                  class="flex flex-wrap items-baseline justify-between gap-3 border-b border-border/70 py-3 last:border-b-0"
                >
                  <dt class="text-sm text-muted-foreground">{{ row.label }}</dt>
                  <dd class="m-0 text-sm text-foreground">{{ row.value }}</dd>
                </div>
              </dl>
            </section>
          </template>
        </template>

        <!-- Security -->
        <template v-else-if="activeSection === 'security'">
          <section class="rounded-lg border border-border bg-card">
            <header class="border-b border-border px-5 py-4">
              <h2 class="m-0 text-base text-foreground font-650">登录密码</h2>
              <p class="m-0 mt-1 text-sm text-muted-foreground">
                定期更新密码有助于保护账号安全。更新后所有设备需重新登录。
              </p>
            </header>
            <form class="grid gap-5 px-5 py-5" @submit.prevent="requestPasswordChange">
              <div class="grid max-w-md gap-4">
                <label class="grid gap-1.5">
                  <span class="text-sm text-foreground font-500">当前密码</span>
                  <Input
                    v-model="password.currentPassword.value"
                    type="password"
                    autocomplete="current-password"
                    :maxlength="1024"
                    required
                  />
                </label>
                <label class="grid gap-1.5">
                  <span class="text-sm text-foreground font-500">新密码</span>
                  <Input
                    v-model="password.newPassword.value"
                    type="password"
                    autocomplete="new-password"
                    :maxlength="1024"
                    required
                  />
                  <span class="text-xs text-muted-foreground">至少 8 位</span>
                </label>
                <label class="grid gap-1.5">
                  <span class="text-sm text-foreground font-500">确认新密码</span>
                  <Input
                    v-model="password.confirmPassword.value"
                    type="password"
                    autocomplete="new-password"
                    :maxlength="1024"
                    required
                  />
                </label>
              </div>
              <div class="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <ButtonLoading
                  type="submit"
                  color="destructive"
                  variant="outline"
                  :loading="password.submitting.value"
                  :disabled="!password.canSubmit.value"
                >
                  更新密码
                </ButtonLoading>
                <Button v-if="passwordDirty" variant="ghost" type="button" @click="password.reset">
                  清空
                </Button>
              </div>
            </form>
          </section>

          <section class="rounded-lg border border-border bg-card">
            <header class="border-b border-border px-5 py-4">
              <h2 class="m-0 text-base text-foreground font-650">密码状态</h2>
            </header>
            <dl class="m-0 px-5 py-1">
              <div class="flex flex-wrap items-baseline justify-between gap-3 py-3">
                <dt class="text-sm text-muted-foreground">最近修改</dt>
                <dd class="m-0 text-sm text-foreground">
                  {{ formatDateTime(profile?.passwordChangedAt ?? null) }}
                </dd>
              </div>
            </dl>
          </section>
        </template>

        <!-- Roles -->
        <template v-else>
          <section class="rounded-lg border border-border bg-card">
            <header class="border-b border-border px-5 py-4">
              <h2 class="m-0 text-base text-foreground font-650">已分配角色</h2>
              <p class="m-0 mt-1 text-sm text-muted-foreground">
                角色决定你在工作区中的功能权限。如需调整，请联系管理员。
              </p>
            </header>
            <div class="px-5 py-4">
              <p v-if="account.rolesLoading.value" class="m-0 text-sm text-muted-foreground">
                正在加载角色…
              </p>
              <div
                v-else-if="account.roles.value.length === 0"
                class="flex flex-col items-center gap-2 py-10 text-center"
              >
                <Icon icon="lucide:badge-check" class="size-8 text-muted-foreground/60" />
                <p class="m-0 text-sm text-muted-foreground">当前账号暂无活跃角色</p>
              </div>
              <ul v-else class="m-0 grid gap-2 p-0 list-none">
                <li
                  v-for="role in account.roles.value"
                  :key="role.code"
                  class="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
                >
                  <div class="min-w-0 grid gap-0.5">
                    <span class="truncate text-sm text-foreground font-600">{{ role.name }}</span>
                    <span class="truncate font-mono text-xs text-muted-foreground">{{
                      role.code
                    }}</span>
                  </div>
                  <span
                    class="shrink-0 rounded-full bg-success/12 px-2 py-0.5 text-xs text-success font-500"
                  >
                    活跃
                  </span>
                </li>
              </ul>
            </div>
          </section>
        </template>
      </main>
    </div>
  </div>
</template>
