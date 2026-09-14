<script setup lang="ts">
import { computed } from 'vue';
import type { ThemeModePreference } from '@soybeanjs/theme';
import { useTheme } from '../../components/config-provider/use-theme';
import SIcon from '../../components/icon/icon.vue';
import SSelect from '../../components/select/select.vue';
import type { SelectOptionData } from '../../components/select/types';
import { useThemeLocale } from './locale';
import type { ThemeModeSelectProps } from './theme-mode-select-types';

defineOptions({
  name: 'SThemeModeSelect'
});

const props = withDefaults(defineProps<ThemeModeSelectProps>(), {
  size: 'md',
  showIcon: true
});

const theme = useTheme();

if (!theme) {
  throw new Error('ThemeModeSelect must be rendered inside ConfigProvider');
}

const mode = theme.mode;

const messages = useThemeLocale();
const modeMessages = computed(() => messages.value.options.mode);

const items = computed<SelectOptionData<ThemeModePreference>[]>(() => [
  { label: modeMessages.value.auto, value: 'auto' },
  { label: modeMessages.value.light, value: 'light' },
  { label: modeMessages.value.dark, value: 'dark' }
]);

const icons: Record<ThemeModePreference, string> = {
  auto: 'lucide:monitor',
  light: 'lucide:sun',
  dark: 'lucide:moon'
};

const iconOf = (value: ThemeModePreference): string => icons[value];
</script>

<template>
  <SSelect v-model="mode" :items="items" :size="props.size">
    <template v-if="props.showIcon" #trigger-leading>
      <SIcon :icon="iconOf(mode)" />
    </template>
    <template v-if="props.showIcon" #item-leading="{ item }">
      <SIcon :icon="iconOf(item.value)" />
    </template>
  </SSelect>
</template>
