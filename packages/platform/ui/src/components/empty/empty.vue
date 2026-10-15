<script setup lang="ts">
import { emptyVariants } from '#ui/styles/empty'
import { useOmitProps } from '@vean/aria/composables'
import { computed } from 'vue'

import Icon from '../icon/icon.vue'
import type { EmptyProps, EmptySlots } from './types'

defineOptions({
  name: 'SEmpty',
})

const props = defineProps<EmptyProps>()

const slots = defineSlots<EmptySlots>()

const forwardedProps = useOmitProps(props, [
  'class',
  'ui',
  'size',
  'title',
  'description',
  'icon',
  'headerProps',
  'mediaProps',
  'contentProps',
  'titleProps',
  'descriptionProps',
])

const ui = computed(() => emptyVariants({ size: props.size }, props.ui, { root: props.class }))

const showMedia = computed(() => Boolean(slots.media) || Boolean(props.icon))

const showHeader = computed(
  () =>
    showMedia.value ||
    Boolean(slots.title) ||
    Boolean(slots.description) ||
    Boolean(props.title) ||
    Boolean(props.description),
)
</script>

<template>
  <div v-bind="forwardedProps" data-vean-empty-root :class="ui.root">
    <div v-if="showHeader" v-bind="headerProps" data-vean-empty-header :class="ui.header">
      <div v-if="showMedia" v-bind="mediaProps" data-vean-empty-media :class="ui.media">
        <slot name="media">
          <Icon v-if="icon" :icon="icon" />
        </slot>
      </div>
      <h3 v-if="slots.title || title" v-bind="titleProps" data-vean-empty-title :class="ui.title">
        <slot name="title">{{ title }}</slot>
      </h3>
      <p
        v-if="slots.description || description"
        v-bind="descriptionProps"
        data-vean-empty-description
        :class="ui.description"
      >
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-bind="contentProps" data-vean-empty-content :class="ui.content">
      <slot name="content" />
    </div>
    <slot />
  </div>
</template>
