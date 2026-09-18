<script setup lang="ts">
import { computed } from 'vue'

import { resolveHorizontalBrandMode } from '@jingwei/module-branding/shared'
import {
  BrandLogoAsset,
  DefaultBrandMark,
  DefaultBrandWordmark,
  useActiveBrand,
} from '@jingwei/module-branding/web'

import { resolveHomeTarget } from '../../../../navigation/workspace-targets.js'
import { useShellStore } from '../../../../stores/shell.js'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const shell = useShellStore()
const brand = useActiveBrand()
const homePath = computed(() => resolveHomeTarget(shell.navigation))
const horizontalMode = computed(() =>
  resolveHorizontalBrandMode(brand.value.horizontalBrandMode, brand.value.logoUrl),
)
</script>

<template>
  <RouterLink
    :to="homePath"
    class="group/brand inline-flex min-w-0 items-center gap-5 rounded-md text-foreground decoration-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-3"
    :aria-label="`${brand.systemName}首页`"
  >
    <span
      aria-hidden="true"
      class="size-8 grid shrink-0 place-items-center overflow-hidden rounded-[calc(var(--radius)+3px)] bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover/brand:scale-105"
    >
      <img v-if="brand.markUrl" :src="brand.markUrl" alt="" class="size-full object-contain" />
      <DefaultBrandMark v-else class="size-7" />
    </span>
    <BrandLogoAsset
      v-if="!compact && horizontalMode === 'CUSTOM_LOGO' && brand.logoUrl"
      :src="brand.logoUrl"
      :color-mode="brand.logoColorMode"
      data-global-brand-wordmark
      class="h-7 w-40 shrink-0 object-contain"
    />
    <DefaultBrandWordmark
      v-else-if="!compact && horizontalMode === 'PLATFORM_WORDMARK'"
      data-global-brand-wordmark
      class="h-[1.125rem] w-[6.625rem] shrink-0 overflow-visible text-primary"
    />
    <span
      v-else-if="!compact"
      data-global-brand-wordmark
      class="max-w-44 truncate text-lg text-primary font-700 tracking-wide"
    >
      {{ brand.shortName }}
    </span>
  </RouterLink>
</template>
