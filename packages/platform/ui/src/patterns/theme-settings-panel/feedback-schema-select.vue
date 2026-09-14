<script setup lang="ts">
import { computed } from 'vue';
import { getRegistry, resolveColorValue } from '@soybeanjs/theme';
import type { ColorValue, PaletteColorLevel, FeedbackSchemeKey } from '@soybeanjs/theme';
import SSelect from '../../components/select/select.vue';
import type { SelectOptionData } from '../../components/select/types';
import ColorDecorator from './color-decorator.vue';
import { useThemeCustomizerLocale } from './use-locale';

const palette = defineModel<FeedbackSchemeKey>({
  required: true
});

const { resolveOption } = useThemeCustomizerLocale();

const feedbackRegistry = getRegistry().feedback;

const currentColors = computed(() => {
  const entry = feedbackRegistry[palette.value];

  return entry ? createColors(entry.light) : {};
});

const colorLevels: PaletteColorLevel[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const decorateLevels: PaletteColorLevel[] = [];

const allColors = Object.entries(feedbackRegistry)
  .map(([key, value]) => ({
    key,
    colors: createColors(value.light)
  }))
  .reduce(
    (prev, cur) => ({ ...prev, [cur.key]: cur.colors }),
    {} as Record<FeedbackSchemeKey, Record<PaletteColorLevel, string>>
  );

function createColors(value: Record<string, ColorValue>) {
  const colors: Partial<Record<PaletteColorLevel, string>> = {};

  Object.values(value).forEach((color, index) => {
    const level = colorLevels[index];

    if (level === undefined) {
      return;
    }

    colors[level] = resolveColorValue(color, 'hsl');

    if (!decorateLevels.includes(level)) {
      decorateLevels.push(level);
    }
  });

  return colors;
}

const items = computed<SelectOptionData<FeedbackSchemeKey>[]>(() =>
  Object.keys(feedbackRegistry).map(key => ({
    label: resolveOption('feedback', key),
    value: key
  }))
);
</script>

<template>
  <SSelect v-model="palette" :items="items">
    <template #trigger-leading>
      <ColorDecorator :colors="currentColors" :levels="decorateLevels" />
    </template>
    <template #item-leading="{ item }">
      <ColorDecorator :colors="allColors[item.value] ?? {}" :levels="decorateLevels" />
    </template>
  </SSelect>
</template>
