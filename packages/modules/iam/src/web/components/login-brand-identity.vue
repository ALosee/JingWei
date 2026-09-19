<script setup lang="ts">
import { computed, inject } from 'vue'

import {
  authPlatformWordmarkComponentKey,
  useAuthBrandPresentation,
} from '../auth-brand-presentation.js'

const { surface, compact } = defineProps<{
  surface: 'canvas' | 'surface'
  compact?: boolean
}>()

const brand = useAuthBrandPresentation()
const platformWordmarkComponent = inject(authPlatformWordmarkComponentKey, null)

const horizontalBrandMode = computed(() =>
  brand.value.horizontalBrandMode === 'CUSTOM_LOGO' && brand.value.logoUrl === null
    ? 'SHORT_NAME'
    : brand.value.horizontalBrandMode === 'PLATFORM_WORDMARK' && platformWordmarkComponent === null
      ? 'SHORT_NAME'
      : brand.value.horizontalBrandMode,
)
const logoMaskStyle = computed(() => {
  const value = `url("${brand.value.logoUrl ?? ''}")`
  return {
    maskImage: value,
    WebkitMaskImage: value,
  }
})
</script>

<template>
  <div
    class="flex items-center gap-3.5"
    :class="surface === 'canvas' ? 'text-[var(--auth-brand-foreground)]' : 'text-foreground'"
    data-auth-brand-identity
  >
    <span
      class="grid shrink-0 place-items-center"
      :class="[
        compact ? 'size-10' : 'size-11',
        brand.markUrl
          ? 'overflow-visible'
          : surface === 'canvas'
            ? 'auth-brand-default-mark rounded-[0.875rem]'
            : 'overflow-hidden rounded-[0.875rem] border border-primary/25 bg-primary/8 text-primary',
      ]"
      aria-hidden="true"
    >
      <img v-if="brand.markUrl" :src="brand.markUrl" alt="" class="size-full object-contain" />
      <svg
        v-else
        viewBox="0 0 48 48"
        class="size-7.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
      >
        <path d="M12 24h24M24 12v24" />
        <circle cx="24" cy="24" r="14" />
        <circle cx="24" cy="24" r="3.5" class="fill-current stroke-none" />
      </svg>
    </span>

    <img
      v-if="
        horizontalBrandMode === 'CUSTOM_LOGO' && brand.logoUrl && brand.logoColorMode === 'ORIGINAL'
      "
      :src="brand.logoUrl"
      alt=""
      class="h-8 w-40 max-w-40 object-contain object-left"
    />
    <span
      v-else-if="horizontalBrandMode === 'CUSTOM_LOGO' && brand.logoUrl"
      class="h-8 w-40 max-w-40 inline-block shrink-0 bg-current [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]"
      :class="surface === 'canvas' ? 'text-[var(--auth-brand-foreground)]' : 'text-primary'"
      :style="logoMaskStyle"
      aria-hidden="true"
    />
    <component
      :is="platformWordmarkComponent"
      v-else-if="horizontalBrandMode === 'PLATFORM_WORDMARK'"
      class="auth-brand-wordmark h-4.5 w-[6.625rem] shrink-0 overflow-visible"
      :class="surface === 'canvas' ? 'auth-brand-wordmark--canvas' : 'auth-brand-wordmark--surface'"
    />
    <span v-else class="text-sm font-750 tracking-[0.22em]">{{ brand.shortName }}</span>
  </div>
</template>

<style scoped>
.auth-brand-default-mark {
  border: 1px solid color-mix(in srgb, var(--auth-brand-foreground) 28%, transparent);
  background: color-mix(in srgb, var(--auth-brand-foreground) 10%, transparent);
  box-shadow: inset 0 1px color-mix(in srgb, var(--auth-brand-foreground) 12%, transparent);
}

.auth-brand-wordmark--canvas {
  --brand-wordmark-dot-fill: var(--auth-brand-canvas-start);
  --brand-wordmark-dot-stroke: var(--auth-brand-foreground);
}

.auth-brand-wordmark--surface {
  color: hsl(var(--primary));
  --brand-wordmark-dot-fill: hsl(var(--background));
  --brand-wordmark-dot-stroke: hsl(var(--primary));
}
</style>
