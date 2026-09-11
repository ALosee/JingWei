<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <RouterLink
    to="/"
    class="inline-flex min-w-0 items-center gap-2.5 text-foreground decoration-none"
    aria-label="经纬企业平台首页"
  >
    <span
      aria-hidden="true"
      class="size-8 grid shrink-0 place-items-center rounded-[calc(var(--radius)+2px)] bg-primary text-primary-foreground font-750"
    >
      经
    </span>
    <span v-if="!compact" class="grid leading-none">
      <strong class="text-base tracking-[0.08em]">经纬</strong>
      <small class="mt-1 text-[0.6rem] text-primary tracking-[0.16em]">JINGWEI</small>
    </span>
  </RouterLink>
</template>
