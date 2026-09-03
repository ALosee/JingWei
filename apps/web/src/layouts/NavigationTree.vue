<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { navigationTarget, type NavigationNode } from '@jingwei/module-navigation/shared'
const props = defineProps<{ nodes: NavigationNode[]; parentId: string | null }>()
const route = useRoute()
const items = computed(() => props.nodes.filter((node) => node.parentId === props.parentId && node.type !== 'PAGE'))
const icons: Readonly<Record<string, string>> = { settings: '⚙', user: '○', grid: '▦', folder: '▸', link: '↗', book: '▤' }
</script>

<template>
  <ul class="nav-tree">
    <li
      v-for="item in items"
      :key="item.id"
    >
      <template v-if="item.type === 'GROUP'">
        <p class="group-label">
          {{ item.name }}
        </p>
        <NavigationTree
          :nodes="nodes"
          :parent-id="item.id"
        />
      </template>
      <details
        v-else-if="item.type === 'DIRECTORY'"
        open
      >
        <summary><span aria-hidden="true">{{ icons[item.icon ?? 'folder'] ?? '▸' }}</span>{{ item.name }}</summary>
        <NavigationTree
          :nodes="nodes"
          :parent-id="item.id"
        />
      </details>
      <RouterLink
        v-else-if="item.type === 'MENU'"
        :to="navigationTarget(item) ?? '/__recovery'"
        :class="{ active: route.meta.navigationCode === item.code }"
      >
        <span aria-hidden="true">{{ icons[item.icon ?? 'grid'] ?? '·' }}</span>{{ item.name }}
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
.nav-tree { list-style: none; margin: 0; padding: 0; display: grid; gap: .2rem; }
a, summary { display: flex; align-items: center; gap: .6rem; padding: .7rem .85rem; color: inherit; text-decoration: none; border-radius: .4rem; cursor: pointer; font-size: .9rem; }
a:hover, summary:hover { background: #edf1f8; }
a.active { color: #234fa4; background: #e8effe; font-weight: 650; }
.group-label { padding: 1rem .85rem .35rem; margin: 0; font-size: .75rem; color: #69768a; font-weight: 650; }
details > .nav-tree { padding-left: .85rem; }
span { width: 1rem; text-align: center; }
</style>
