<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { SButtonIcon } from '../../components/button/index.js'
import { SIcon } from '../../components/icon/index.js'
import { SInput } from '../../components/input/index.js'
import type { ManagementListToolbarEmits, ManagementListToolbarProps } from './types'

const props = withDefaults(defineProps<ManagementListToolbarProps>(), {
  closeSearchLabel: '关闭搜索',
  createLabel: '',
  canCreate: false,
  busy: false,
})

const emit = defineEmits<ManagementListToolbarEmits>()

const searchOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const toolbar = ref<HTMLElement | null>(null)

function setSearchInput(element: HTMLInputElement) {
  searchInput.value = element
}

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

async function closeSearch() {
  searchOpen.value = false
  await nextTick()
  toolbar.value?.querySelector<HTMLButtonElement>('[data-search-trigger]')?.focus()
}
</script>

<template>
  <header
    ref="toolbar"
    class="relative flex h-16 shrink-0 items-center overflow-hidden border-b border-border px-4"
  >
    <div
      class="min-w-0 flex-1 transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none"
      :class="searchOpen ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'"
      :aria-hidden="searchOpen"
    >
      <h2 class="m-0 truncate text-sm font-semibold text-foreground">{{ props.title }}</h2>
      <p class="m-0 mt-0.5 truncate text-xs text-muted-foreground">{{ props.summary }}</p>
    </div>

    <div
      class="flex shrink-0 items-center gap-1 transition-[transform,opacity] duration-300 ease-in-out motion-reduce:transition-none"
      :class="searchOpen ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'"
      :aria-hidden="searchOpen"
      :inert="searchOpen"
    >
      <slot name="tools" />
      <span class="size-8 shrink-0" aria-hidden="true" />
      <SButtonIcon
        v-if="props.canCreate"
        icon="lucide:plus"
        color="primary"
        variant="soft"
        size="md"
        :fit-content="false"
        :aria-label="props.createLabel"
        :title="props.createLabel"
        :disabled="props.busy"
        @click="emit('create')"
      />
    </div>

    <div
      class="absolute top-1/2 z-10 h-8 -translate-y-1/2 overflow-hidden transition-[right,width] duration-300 ease-in-out motion-reduce:transition-none"
      :class="[
        searchOpen ? 'right-4 w-[calc(100%-1.5rem)]' : 'w-8',
        !searchOpen && props.canCreate ? 'right-[3.25rem]' : '',
        !searchOpen && !props.canCreate ? 'right-4' : '',
      ]"
    >
      <SButtonIcon
        v-if="!searchOpen"
        data-search-trigger
        icon="lucide:search"
        variant="ghost"
        size="md"
        :fit-content="false"
        :aria-label="props.searchLabel"
        :title="props.searchLabel"
        @click="openSearch"
      />
      <SInput
        v-else
        :input-ref="setSearchInput"
        :ui="{ root: 'focus-within:ring-0!' }"
        type="search"
        :control-props="{ 'aria-label': props.searchLabel }"
        :placeholder="props.searchPlaceholder"
        :model-value="props.modelValue"
        autocomplete="off"
        clearable
        @update:model-value="emit('update:modelValue', $event)"
        @keydown.esc="closeSearch"
      >
        <template #leading>
          <SIcon
            icon="lucide:search"
            class="size-4 shrink-0 text-muted-foreground"
            :aria-hidden="true"
          />
        </template>
        <template #trailing>
          <SButtonIcon
            icon="lucide:x"
            variant="ghost"
            size="xs"
            :fit-content="false"
            :aria-label="props.closeSearchLabel"
            @click="closeSearch"
          />
        </template>
      </SInput>
    </div>
  </header>
</template>

<style scoped>
:deep(input[type='search']::-webkit-search-cancel-button) {
  display: none;
}
</style>
