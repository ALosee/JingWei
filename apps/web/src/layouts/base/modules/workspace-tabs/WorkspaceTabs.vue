<script setup lang="ts">
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { ButtonIcon, PageTabs, type PageTabsOptionData, type PageTabsProps } from '@jingwei/ui'

defineProps<{
  beforeClose: NonNullable<PageTabsProps['beforeClose']>
  menuFactory: NonNullable<PageTabsProps['menuFactory']>
  fullscreen: boolean
}>()
const emit = defineEmits<{ refresh: []; toggleFullscreen: [] }>()
const items = defineModel<PageTabsOptionData[]>('items', { required: true })
const activeValue = defineModel<string>({ required: true })
const viewport = useTemplateRef<HTMLElement>('viewport')
const scroller = computed(
  () => viewport.value?.querySelector<HTMLElement>('[data-vean-page-tabs-root]') ?? null,
)
const overflow = ref(false)
const atLeft = ref(true)
const atRight = ref(true)

function updateScroll(): void {
  const element = scroller.value
  if (!element) return
  overflow.value = element.scrollWidth > element.clientWidth + 1
  atLeft.value = element.scrollLeft <= 1
  atRight.value = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1
}

function scroll(direction: -1 | 1): void {
  const element = scroller.value
  if (!element) return
  element.scrollBy({
    left: direction * Math.max(element.clientWidth * 0.75, 120),
    behavior: 'smooth',
  })
}

useResizeObserver(viewport, updateScroll)
useEventListener(scroller, 'scroll', updateScroll)
watch(
  () => items.value.map((item) => [item.value, item.label, item.pinned]),
  async () => {
    await nextTick()
    updateScroll()
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex h-full min-w-0 flex-1 items-center" aria-label="页面标签栏">
    <ButtonIcon
      v-if="overflow"
      icon="lucide:chevron-left"
      class="shrink-0"
      :disabled="atLeft"
      aria-label="向左滚动标签"
      @click="scroll(-1)"
    />
    <div ref="viewport" class="h-full min-w-0 flex-1 overflow-hidden">
      <PageTabs
        v-model="activeValue"
        v-model:items="items"
        :before-close="beforeClose"
        :menu-factory="menuFactory"
        draggable
        middle-click-close
        :ui="{ root: 'h-full min-w-0 overflow-x-auto items-end px-2', item: 'h-8 shrink-0' }"
      />
    </div>
    <ButtonIcon
      v-if="overflow"
      icon="lucide:chevron-right"
      class="shrink-0"
      :disabled="atRight"
      aria-label="向右滚动标签"
      @click="scroll(1)"
    />
    <div class="flex h-full shrink-0 items-center gap-1 border-l border-border px-1">
      <ButtonIcon icon="lucide:rotate-cw" aria-label="刷新当前页面" @click="emit('refresh')" />
      <ButtonIcon
        :icon="fullscreen ? 'lucide:minimize' : 'lucide:maximize'"
        :aria-label="fullscreen ? '退出页面全屏' : '进入页面全屏'"
        :aria-pressed="fullscreen"
        @click="emit('toggleFullscreen')"
      />
    </div>
  </div>
</template>
