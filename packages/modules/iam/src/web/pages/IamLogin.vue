<script setup lang="ts">
import LoginBrandPanel from '../components/login-brand-panel.vue'
import LoginFormPanel from '../components/login-form-panel.vue'
</script>

<template>
  <main class="login-page min-h-[100dvh] p-[clamp(0.75rem,2vw,1.5rem)] text-foreground lt-sm:p-0">
    <div
      class="min-h-[calc(100dvh-clamp(1.5rem,4vw,3rem))] grid overflow-hidden border border-border/80 rounded-[calc(var(--radius)*2.25)] bg-card shadow-xl shadow-foreground/8 lg:grid-cols-[minmax(28rem,1.08fr)_minmax(27rem,0.92fr)] lt-sm:min-h-[100dvh] lt-sm:border-0 lt-sm:rounded-0 lt-sm:shadow-none"
    >
      <LoginBrandPanel />
      <LoginFormPanel />
    </div>
  </main>
</template>

<style scoped>
.login-page {
  --auth-brand-canvas-start: color-mix(in oklch, hsl(var(--primary)) 18%, #0b0f17);
  --auth-brand-canvas-end: color-mix(in oklch, hsl(var(--primary)) 30%, #171b22);
  --auth-brand-foreground: hsl(210 40% 98%);

  background:
    radial-gradient(circle at 82% 12%, hsl(var(--primary) / 0.1), transparent 24rem),
    hsl(var(--background));
}

@media (max-width: 639.9px) {
  .login-page {
    background: hsl(var(--card));
  }
}
</style>
