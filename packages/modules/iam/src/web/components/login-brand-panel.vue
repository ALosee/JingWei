<script setup lang="ts">
import { Icon } from '@jingwei/ui'

import { useAuthBrandPresentation } from '../auth-brand-presentation.js'
import LoginBrandIdentity from './login-brand-identity.vue'

const brand = useAuthBrandPresentation()
</script>

<template>
  <section
    class="auth-brand-canvas relative hidden min-w-0 overflow-hidden p-[clamp(2rem,4vw,4.5rem)] text-[var(--auth-brand-foreground)] isolate lg:flex lg:flex-col"
    aria-labelledby="platform-title"
    data-login-brand-panel="true"
  >
    <div class="auth-brand-glow auth-brand-glow--primary" />
    <div class="auth-brand-glow auth-brand-glow--secondary" />

    <header>
      <LoginBrandIdentity surface="canvas" />
    </header>

    <div class="mt-auto max-w-140 self-center">
      <p class="m-0 mb-3.5 text-xs font-700 tracking-[0.16em] uppercase opacity-88">
        Enterprise workspace
      </p>
      <h1
        id="platform-title"
        class="m-0 max-w-8em text-[clamp(2.5rem,4vw,4.75rem)] font-720 leading-[1.04] tracking-[-0.055em]"
      >
        {{ brand.loginTitle }}
      </h1>
      <p class="mb-0 mt-6 max-w-120 text-[clamp(1rem,1.25vw,1.15rem)] leading-[1.8] opacity-72">
        {{ brand.loginTagline }}
      </p>
    </div>

    <ul class="m-0 mt-auto grid list-none gap-3 p-0" aria-label="平台安全能力">
      <li class="auth-brand-principle flex max-w-116 items-center gap-3.5 px-4 py-3.5">
        <span
          class="size-9 grid shrink-0 place-items-center rounded-[0.7rem] bg-white/12 text-[var(--auth-brand-foreground)]"
          aria-hidden="true"
        >
          <Icon icon="lucide:lock" class="size-4.5" />
        </span>
        <span>
          <strong class="mb-0.5 block text-sm font-650">安全会话</strong>
          <small class="block text-xs opacity-58">凭据只由浏览器与服务端处理</small>
        </span>
      </li>
      <li class="auth-brand-principle flex max-w-116 items-center gap-3.5 px-4 py-3.5">
        <span
          class="size-9 grid shrink-0 place-items-center rounded-[0.7rem] bg-white/12 text-[var(--auth-brand-foreground)]"
          aria-hidden="true"
        >
          <Icon icon="lucide:shield-check" class="size-4.5" />
        </span>
        <span>
          <strong class="mb-0.5 block text-sm font-650">租户隔离</strong>
          <small class="block text-xs opacity-58">身份与数据始终保留明确边界</small>
        </span>
      </li>
      <li class="auth-brand-principle flex max-w-116 items-center gap-3.5 px-4 py-3.5">
        <span
          class="size-9 grid shrink-0 place-items-center rounded-[0.7rem] bg-white/12 text-[var(--auth-brand-foreground)]"
          aria-hidden="true"
        >
          <Icon icon="lucide:users" class="size-4.5" />
        </span>
        <span>
          <strong class="mb-0.5 block text-sm font-650">实时授权</strong>
          <small class="block text-xs opacity-58">权限变化即时作用于访问决策</small>
        </span>
      </li>
    </ul>

    <footer
      class="mt-6 flex items-center gap-2.5 text-[0.7rem] tracking-[0.08em] uppercase opacity-42"
    >
      <span>Platform Foundation</span>
      <span aria-hidden="true">·</span>
      <span>Secure by design</span>
    </footer>
  </section>
</template>

<style scoped>
.auth-brand-canvas {
  background: linear-gradient(145deg, var(--auth-brand-canvas-start), var(--auth-brand-canvas-end));
}

.auth-brand-canvas::before,
.auth-brand-canvas::after {
  position: absolute;
  z-index: -1;
  border: 1px solid color-mix(in srgb, var(--auth-brand-foreground) 12%, transparent);
  border-radius: 50%;
  content: '';
}

.auth-brand-canvas::before {
  top: 21%;
  left: 58%;
  width: min(32vw, 31rem);
  aspect-ratio: 1;
}

.auth-brand-canvas::after {
  top: 30%;
  left: 68%;
  width: min(19vw, 18rem);
  aspect-ratio: 1;
}

.auth-brand-glow {
  position: absolute;
  z-index: -2;
  border-radius: 999px;
  filter: blur(1px);
}

.auth-brand-glow--primary {
  top: -12rem;
  right: -11rem;
  width: 28rem;
  height: 28rem;
  background: color-mix(in srgb, hsl(var(--primary)) 34%, transparent);
}

.auth-brand-glow--secondary {
  bottom: -16rem;
  left: -10rem;
  width: 31rem;
  height: 31rem;
  background: color-mix(in srgb, hsl(var(--primary)) 22%, transparent);
}

.auth-brand-principle {
  border: 1px solid color-mix(in srgb, var(--auth-brand-foreground) 10%, transparent);
  border-radius: calc(var(--radius) * 1.25);
  background: color-mix(in srgb, var(--auth-brand-canvas-start) 64%, transparent);
  backdrop-filter: blur(12px);
}
</style>
