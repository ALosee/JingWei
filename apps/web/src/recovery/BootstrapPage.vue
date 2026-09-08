<template>
  <main class="bootstrap">
    <span class="mark">经纬</span>
    <p>正在加载当前 Edition 的公共导航…</p>
  </main>
</template>

<style scoped>
.bootstrap {
  display: grid;
  min-height: 100vh;
  place-content: center;
  text-align: center;
  color: hsl(var(--muted-foreground));
}
.mark {
  color: hsl(var(--foreground));
  font-size: 1.75rem;
  font-weight: 750;
}
</style>
