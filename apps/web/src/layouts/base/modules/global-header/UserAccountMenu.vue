<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { iamSessionUser, setIamSessionUser } from '@jingwei/module-iam/web'
import { navigationTarget } from '@jingwei/module-navigation/shared'
import { DropdownMenu, dialog, type MenuOptionData } from '@jingwei/ui'

import { useSignOut } from '../../../../composables/use-sign-out.js'
import { useShellStore } from '../../../../stores/shell.js'

type AccountMenuValue = 'account' | 'logout'

const shell = useShellStore()
const avatarFailed = ref(false)
const { signingOut, signOut } = useSignOut()

// Seed from shell bootstrap once; later profile edits own the live projection.
watch(
  () => shell.currentUser,
  (user) => {
    if (user === null) setIamSessionUser(null)
    else if (iamSessionUser.value === null) setIamSessionUser(user)
  },
  { immediate: true },
)

const accountTarget = computed(() => {
  const account = shell.navigation?.nodes.find((node) => node.routeKey === 'iam.account')
  return account === undefined ? null : navigationTarget(account)
})
const avatarUrl = computed(() => {
  const value = iamSessionUser.value?.avatarUrl
  if (value === null || value === undefined || typeof window === 'undefined') return null
  try {
    const url = new URL(value, window.location.origin)
    return url.origin === window.location.origin || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
})
const initial = computed(() => {
  const value = iamSessionUser.value?.displayName.trim().charAt(0).toLocaleUpperCase()
  return value === undefined || value === '' ? '用' : value
})
const displayName = computed(() => iamSessionUser.value?.displayName ?? '当前用户')
const items = computed<MenuOptionData<AccountMenuValue>[]>(() => {
  const list: MenuOptionData<AccountMenuValue>[] = []
  if (accountTarget.value !== null) {
    list.push({
      value: 'account',
      label: '个人账号',
      icon: 'lucide:user',
      to: accountTarget.value,
    })
  }
  list.push({ value: 'logout', label: '退出登录', icon: 'lucide:log-out' })
  return list
})

watch(avatarUrl, () => {
  avatarFailed.value = false
})

function confirmSignOut(): void {
  dialog.warning('退出登录', {
    description: '退出后需要重新登录才能继续使用工作区。',
    confirmText: '退出登录',
    cancelText: '取消',
    onConfirm: () => {
      void signOut()
    },
  })
}

function onSelect(item: MenuOptionData<AccountMenuValue>): void {
  if (item.value === 'logout') confirmSignOut()
}
</script>

<template>
  <DropdownMenu
    :items="items"
    placement="bottom-end"
    :modal="false"
    :disabled="signingOut"
    :popup-props="{ 'aria-label': '用户菜单' }"
    class="min-w-44"
    :show-arrow="false"
    @select="onSelect"
  >
    <template #trigger>
      <button
        type="button"
        class="ms-1 inline-flex min-w-0 items-center gap-2 rounded-md border-none bg-transparent px-2 py-1 text-foreground cursor-pointer hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
        :aria-label="`用户菜单：${displayName}`"
        :disabled="signingOut"
      >
        <img
          v-if="avatarUrl && !avatarFailed"
          :src="avatarUrl"
          alt=""
          class="size-8 shrink-0 rounded-full object-cover"
          referrerpolicy="no-referrer"
          @error="avatarFailed = true"
        />
        <span
          v-else
          aria-hidden="true"
          class="size-8 grid shrink-0 place-items-center rounded-full bg-primary/12 text-primary font-700"
        >
          {{ initial }}
        </span>
        <span class="max-w-36 truncate text-sm lt-sm:hidden">
          {{ displayName }}
        </span>
      </button>
    </template>
  </DropdownMenu>
</template>
