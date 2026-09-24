<script setup lang="ts">
import {
  SSplitterGroup,
  SSplitterPanel,
  SSplitterResizeHandle,
} from '../../components/splitter/index.js'
import type { ManagementWorkspaceEmits, ManagementWorkspaceProps } from './types'

const props = withDefaults(defineProps<ManagementWorkspaceProps>(), {
  mobileDetailOpen: false,
  backLabel: '返回列表',
  resizeHandleLabel: '调整列表与详情宽度',
  detailLabel: '详情工作区',
})

const emit = defineEmits<ManagementWorkspaceEmits>()
</script>

<template>
  <div class="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
    <h1 class="sr-only">{{ props.title }}</h1>

    <slot name="notice" />

    <SSplitterGroup
      direction="horizontal"
      :default-layout="[24, 76]"
      :keyboard-resize-by="5"
      size="2xl"
      class="flex w-full min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      <SSplitterPanel
        as="aside"
        :default-size="24"
        :min-size="18"
        :max-size="45"
        class="min-h-0 min-w-0"
        :class="props.mobileDetailOpen ? '!hidden xl:!block' : ''"
      >
        <slot name="list" />
      </SSplitterPanel>
      <SSplitterResizeHandle
        class="hidden shrink-0 touch-none xl:flex focus-visible:outline-2 focus-visible:outline-primary"
        :aria-label="props.resizeHandleLabel"
      />
      <SSplitterPanel
        as="section"
        :default-size="76"
        :min-size="55"
        class="min-h-0 min-w-0 flex flex-col"
        :class="props.mobileDetailOpen ? '' : '!hidden xl:!flex'"
        :aria-label="props.detailLabel"
      >
        <button
          type="button"
          class="flex w-full items-center gap-1.5 border-b border-border bg-transparent px-4 py-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary xl:hidden"
          @click="emit('back')"
        >
          <span aria-hidden="true">←</span>
          {{ props.backLabel }}
        </button>
        <slot name="detail" />
      </SSplitterPanel>
    </SSplitterGroup>
  </div>
</template>
