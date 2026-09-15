<script setup lang="ts">
import { Button, Icon } from '@jingwei/ui'

import type { NavigationIssue } from '../composables/use-navigation-versions.js'

defineProps<{
  issues: NavigationIssue[]
}>()

const emit = defineEmits<{
  locate: [nodeId: string]
}>()
</script>

<template>
  <section class="flex flex-col gap-3">
    <header class="flex items-center gap-2">
      <h2 class="m-0 flex-1 text-sm font-semibold text-foreground">校验结果</h2>
      <span
        v-if="issues.length === 0"
        class="rounded-full bg-success/12 px-2 py-0.5 text-xs text-success"
      >
        通过
      </span>
      <span v-else class="rounded-full bg-destructive/12 px-2 py-0.5 text-xs text-destructive">
        {{ issues.length }} 项
      </span>
    </header>

    <p v-if="issues.length === 0" class="m-0 text-sm text-muted-foreground">
      点击顶栏「校验」检查已保存版本与当前 Edition 的兼容性。
    </p>

    <ul v-else class="m-0 grid gap-2 list-none p-0">
      <li
        v-for="(issue, index) in issues"
        :key="`${issue.code}-${index}`"
        class="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2"
      >
        <p class="m-0 text-sm text-foreground">{{ issue.message }}</p>
        <div class="mt-1 flex flex-wrap items-center gap-2">
          <code class="text-[0.7rem] text-muted-foreground">{{ issue.code }}</code>
          <Button
            v-if="issue.nodeId"
            size="sm"
            variant="ghost"
            class="h-6 px-2 text-xs"
            @click="emit('locate', issue.nodeId)"
          >
            <Icon icon="lucide:locate-fixed" class="me-1 size-3" />
            定位节点
          </Button>
        </div>
      </li>
    </ul>
  </section>
</template>
