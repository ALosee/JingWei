<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section class="jw-page">
    <header class="jw-page__header">
      <div>
        <h1>{{ title }}</h1>
        <p v-if="description">
          {{ description }}
        </p>
      </div>
      <div class="jw-page__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="jw-page__content">
      <slot />
    </div>
  </section>
</template>
