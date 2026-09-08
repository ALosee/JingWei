<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { navigationTarget, type NavigationNode } from '@jingwei/module-navigation/shared'
const props = defineProps<{ nodes: NavigationNode[]; parentId: string | null }>()
const route = useRoute()
const items = computed(() =>
  props.nodes.filter((node) => node.parentId === props.parentId && node.type !== 'PAGE'),
)
const icons: Readonly<Record<string, string>> = {
  settings: '⚙',
  user: '○',
  grid: '▦',
  folder: '▸',
  link: '↗',
  book: '▤',
}
</script>

<template>
  <ul class="nav-tree">
    <li v-for="item in items" :key="item.id">
      <template v-if="item.type === 'GROUP'">
        <p class="group-label">
          {{ item.name }}
        </p>
        <NavigationTree :nodes="nodes" :parent-id="item.id" />
      </template>
      <details v-else-if="item.type === 'DIRECTORY'" open>
        <summary>
          <span aria-hidden="true">{{ icons[item.icon ?? 'folder'] ?? '▸' }}</span
          >{{ item.name }}
        </summary>
        <NavigationTree :nodes="nodes" :parent-id="item.id" />
      </details>
      <RouterLink
        v-else-if="item.type === 'MENU'"
        :to="navigationTarget(item) ?? '/__recovery'"
        :class="{ active: route.meta.navigationCode === item.code }"
      >
        <span aria-hidden="true">{{ icons[item.icon ?? 'grid'] ?? '·' }}</span
        >{{ item.name }}
      </RouterLink>
      <a
        v-else-if="item.type === 'EXTERNAL_LINK'"
        :href="item.href ?? undefined"
        :target="item.externalTarget === 'BLANK' ? '_blank' : '_self'"
        rel="noopener noreferrer"
      >
        <span aria-hidden="true">↗</span>{{ item.name }}
      </a>
    </li>
  </ul>
</template>

<style scoped>
.nav-tree {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.2rem;
}
a,
summary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.85rem;
  color: inherit;
  text-decoration: none;
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  font-size: 0.9rem;
}
a:hover,
summary:hover {
  background: hsl(var(--sidebar-accent));
}
a.active {
  color: hsl(var(--sidebar-primary));
  background: hsl(var(--sidebar-primary) / 0.1);
  font-weight: 650;
}
.group-label {
  padding: 1rem 0.85rem 0.35rem;
  margin: 0;
  font-size: 0.75rem;
  color: hsl(var(--sidebar-foreground));
  font-weight: 650;
}
details > .nav-tree {
  padding-left: 0.85rem;
}
span {
  width: 1rem;
  text-align: center;
}
</style>
