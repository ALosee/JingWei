<script setup lang="ts">
import { useShellStore } from '../stores/shell.js'
import NavigationTree from './NavigationTree.vue'
const shell = useShellStore()
</script>
<template>
  <div class="base-layout">
    <header>
      <RouterLink
        to="/"
        class="brand"
      >
        <span>经纬</span><small>JINGWEI</small>
      </RouterLink>
      <span class="edition">企业平台 · 导航版本 {{ shell.navigation?.publishedRevision }}</span>
    </header>
    <div class="workspace">
      <aside aria-label="主导航">
        <NavigationTree
          :nodes="shell.navigation?.nodes ?? []"
          :parent-id="null"
        />
      </aside>
      <main><RouterView /></main>
    </div>
  </div>
</template>
<style scoped>
.base-layout { min-height: 100vh; }
header { display: flex; align-items: center; justify-content: space-between; min-height: 4rem; padding: 0 1.5rem; border-bottom: 1px solid var(--jw-color-border); background: white; }
.brand { display: flex; gap: .65rem; align-items: baseline; color: var(--jw-color-text); text-decoration: none; font-weight: 750; }
.brand small { color: var(--jw-color-brand); font-size: .65rem; letter-spacing: .16em; }
.edition { color: var(--jw-color-muted); font-size: .8rem; }
.workspace { display: grid; grid-template-columns: 15rem minmax(0, 1fr); min-height: calc(100vh - 4rem); }
aside { border-right: 1px solid var(--jw-color-border); padding: .65rem; background: #fafbfe; }
main { min-width: 0; padding: 1.5rem; }
@media (max-width: 760px) { .workspace { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid var(--jw-color-border); } }
</style>
