<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { Button } from '@jingwei/ui'

import {
  defaultLayoutPreferences,
  useLayoutStore,
  type BrandPlacement,
  type LayoutMode,
} from '../../../../stores/layout.js'

const layout = useLayoutStore()
const { preferences } = storeToRefs(layout)

function updateMode(event: Event): void {
  layout.patch({ mode: (event.target as HTMLSelectElement).value as LayoutMode })
}

function updateBrandPlacement(event: Event): void {
  layout.patch({ brandPlacement: (event.target as HTMLSelectElement).value as BrandPlacement })
}

function updateHeaderHeight(event: Event): void {
  layout.patch({ headerHeight: Number((event.target as HTMLInputElement).value) })
}

function updateSiderWidth(event: Event): void {
  layout.patch({ siderWidth: Number((event.target as HTMLInputElement).value) })
}

function updateTabs(event: Event): void {
  layout.patch({ showTabs: (event.target as HTMLInputElement).checked })
}
</script>

<template>
  <form class="grid gap-5" @submit.prevent>
    <label class="grid gap-2 text-sm text-foreground font-600">
      布局模式
      <select
        :value="preferences.mode"
        class="min-h-10 border border-input rounded-md bg-background px-3 text-foreground font-[inherit]"
        @change="updateMode"
      >
        <option value="left">左侧菜单模式</option>
        <option value="top">顶部菜单模式</option>
      </select>
    </label>

    <label class="grid gap-2 text-sm text-foreground font-600">
      品牌位置
      <select
        :value="preferences.brandPlacement"
        class="min-h-10 border border-input rounded-md bg-background px-3 text-foreground font-[inherit]"
        @change="updateBrandPlacement"
      >
        <option value="header">Header</option>
        <option value="sider">Sider</option>
      </select>
      <small v-if="preferences.mode === 'top'" class="text-muted-foreground font-400">
        顶部菜单模式没有 Sider，品牌固定显示在 Header。
      </small>
    </label>

    <label class="grid gap-2 text-sm text-foreground font-600">
      <span class="flex justify-between gap-4">
        Header 高度
        <output class="text-muted-foreground font-400">{{ preferences.headerHeight }}px</output>
      </span>
      <input
        :value="preferences.headerHeight"
        type="range"
        class="w-full accent-primary"
        aria-label="Header 高度"
        min="48"
        max="96"
        step="4"
        @input="updateHeaderHeight"
      />
    </label>

    <label class="grid gap-2 text-sm text-foreground font-600">
      <span class="flex justify-between gap-4">
        Sider 宽度
        <output class="text-muted-foreground font-400">{{ preferences.siderWidth }}px</output>
      </span>
      <input
        :value="preferences.siderWidth"
        type="range"
        class="w-full accent-primary"
        aria-label="Sider 宽度"
        min="192"
        max="360"
        step="8"
        @input="updateSiderWidth"
      />
    </label>

    <label class="flex items-center justify-between gap-4 border border-border rounded-md p-3">
      <span class="grid gap-1">
        <strong class="text-sm text-foreground">显示页面标签</strong>
        <small class="text-xs text-muted-foreground">在 Header 下方显示当前访问过的页面。</small>
      </span>
      <input
        :checked="preferences.showTabs"
        type="checkbox"
        class="size-4.5 accent-primary"
        @change="updateTabs"
      />
    </label>

    <div class="flex items-center justify-between gap-4 border-t border-border pt-4">
      <Button type="button" variant="outline" @click="layout.reset">恢复默认布局</Button>
      <small class="text-right text-xs text-muted-foreground">
        默认 {{ defaultLayoutPreferences.headerHeight }}px Header ·
        {{ defaultLayoutPreferences.siderWidth }}px Sider
      </small>
    </div>
  </form>
</template>
