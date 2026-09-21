<script setup lang="ts">
import { Button } from '@jingwei/ui'

import { usePlatformShell } from './composables/use-platform-shell.js'
import { platformOperator } from './state.js'

const { signingOut, signOut } = usePlatformShell()
</script>

<template>
  <div class="min-h-screen bg-muted/35 text-foreground">
    <header class="sticky top-0 z-20 border-b border-border/75 bg-background/92 backdrop-blur-xl">
      <div class="mx-auto h-16 max-w-360 flex items-center gap-6 px-4 sm:px-7">
        <RouterLink
          class="flex items-center gap-2.5 text-foreground no-underline"
          to="/platform/tenants"
        >
          <span
            class="size-8 grid place-items-center rounded-lg bg-primary text-sm text-primary-foreground font-750"
          >
            经
          </span>
          <span class="font-720 tracking-[-0.02em]">平台管理</span>
        </RouterLink>
        <nav class="flex-1" aria-label="平台管理导航">
          <RouterLink
            class="rounded-lg px-3 py-2 text-sm text-muted-foreground font-620 no-underline hover:bg-muted hover:text-foreground"
            active-class="!bg-primary/10 !text-primary"
            to="/platform/tenants"
          >
            租户管理
          </RouterLink>
        </nav>
        <div class="flex items-center gap-3">
          <div class="hidden text-right sm:block">
            <p class="m-0 text-sm font-650">{{ platformOperator?.displayName }}</p>
            <p class="m-0 mt-0.5 text-[0.7rem] text-muted-foreground">平台管理员</p>
          </div>
          <Button variant="outline" size="sm" :disabled="signingOut" @click="signOut">
            {{ signingOut ? '退出中' : '退出登录' }}
          </Button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-360 px-4 py-7 sm:px-7 sm:py-10">
      <RouterView />
    </main>
  </div>
</template>
