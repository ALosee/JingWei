<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
</script>

<template>
  <RouterLink
    to="/"
    class="group/brand inline-flex min-w-0 items-center gap-5 rounded-md text-foreground decoration-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-3"
    aria-label="经纬企业平台首页"
  >
    <span
      aria-hidden="true"
      class="size-8 grid shrink-0 place-items-center overflow-hidden rounded-[calc(var(--radius)+3px)] bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover/brand:scale-105"
    >
      <svg class="size-7" viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="10.25" stroke="currentColor" stroke-width="1.7" />
        <path
          d="M8.25 18h19.5M10.45 13.25h15.1M10.45 22.75h15.1"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="1.45"
          opacity="0.72"
        />
        <path
          d="M18 7.75c3.15 2.8 4.75 6.2 4.75 10.25S21.15 25.45 18 28.25M18 7.75c-3.15 2.8-4.75 6.2-4.75 10.25s1.6 7.45 4.75 10.25"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="1.7"
        />
        <circle cx="24.2" cy="12.1" r="2" fill="currentColor" />
      </svg>
    </span>
    <svg
      v-if="!compact"
      data-global-brand-wordmark
      aria-hidden="true"
      class="h-[1.125rem] w-[6.625rem] shrink-0 overflow-visible text-primary"
      viewBox="0 0 140 24"
      fill="none"
    >
      <g fill="currentColor">
        <path
          d="M1 2h14v12.7c0 4.8-2.9 7.3-7.5 7.3-3.8 0-6.1-1.8-7.5-4.8l3.3-1.7c.8 1.8 2.1 2.8 4.2 2.8 2.3 0 3.5-1.2 3.5-3.8V5.7H1V2Z"
        />
        <path d="M19 2h12v3.7h-4v12.6h4V22H19v-3.7h4V5.7h-4V2Z" />
        <path d="M35 2h4l9 12.5V2h4v20h-3.8L39 9.3V22h-4V2Z" />
        <path
          d="M65.5 2c-6.4 0-10.5 4.3-10.5 10s4.1 10 10.6 10c3.5 0 6.2-1.1 8.2-3.1v-8.3h-9.2v3.6h5.2v2.5c-1.1 1-2.5 1.5-4.2 1.5-3.9 0-6.4-2.4-6.4-6.2s2.4-6.2 6.2-6.2c2.4 0 4.1.8 5.6 2.4l2.7-2.7C71.6 3.3 68.9 2 65.5 2Z"
        />
        <path
          d="M78 2h4.4l3.3 13.2L88.5 6h3.2l3.8 9.2L98.8 2h4.4l-5.4 20h-3.7l-4-9.7-4 9.7h-3.7L78 2Z"
        />
        <path d="M107 2h16v3.7h-11.8v4.2h10.2v3.6h-10.2v4.8H123V22h-16V2Z" />
        <path d="M127 2h13v3.7h-4.4v12.6h4.4V22h-13v-3.7h4.4V5.7H127V2Z" />
      </g>
      <circle
        cx="90.1"
        cy="8.8"
        r="2.5"
        class="fill-primary-foreground stroke-primary"
        stroke-width="1.2"
      />
    </svg>
  </RouterLink>
</template>
