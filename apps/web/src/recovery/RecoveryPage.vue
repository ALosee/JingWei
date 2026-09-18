<template>
  <main class="recovery">
    <section class="grid gap-4 rounded-xl border border-border bg-card p-8 shadow-sm">
      <header>
        <h1 class="m-0 text-xl text-foreground font-700">恢复入口</h1>
        <p class="mb-0 mt-2 text-sm text-muted-foreground">
          动态导航不可用时保留的最小静态安全层。
        </p>
      </header>
      <p class="m-0 text-sm text-foreground">
        请检查 Navigation 发布版本、Edition 页面注册表以及服务端连接状态。
      </p>
      <div>
        <a
          href="/"
          class="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm text-foreground no-underline hover:bg-accent"
        >
          重新加载
        </a>
      </div>
    </section>
  </main>
</template>

<style scoped>
.recovery {
  width: min(44rem, calc(100% - 2rem));
  margin: 4rem auto;
}
</style>
