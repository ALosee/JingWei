<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="grid gap-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="m-0 text-2xl font-semibold text-foreground">{{ title }}</h1>
        <p v-if="description" class="mb-0 mt-2 text-muted-foreground">
          {{ description }}
        </p>
      </div>
      <div>
        <slot name="actions" />
      </div>
    </header>
    <div class="rounded-lg border border-border bg-card p-6 text-card-foreground">
      <slot />
    </div>
  </section>
</template>
