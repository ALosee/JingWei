<script setup lang="ts">
import { computed, ref } from 'vue'

import { ButtonLoading, Input } from '@jingwei/ui'

import { useAuthBrandPresentation, useAuthTenantBrandSelector } from '../auth-brand-presentation.js'
import { useSignIn } from '../composables/use-sign-in.js'
import LoginBrandIdentity from './login-brand-identity.vue'

const brand = useAuthBrandPresentation()
const tenantBrandSelector = useAuthTenantBrandSelector()
const { tenantCode, username, password, errorMessage, submitting, submit } = useSignIn()
const passwordVisible = ref(false)
const capsLockActive = ref(false)

const passwordType = computed(() => (passwordVisible.value ? 'text' : 'password'))
const passwordToggleLabel = computed(() => (passwordVisible.value ? '隐藏密码' : '显示密码'))

function updateCapsLock(event: KeyboardEvent): void {
  capsLockActive.value = event.getModifierState('CapsLock')
}

function selectTenantBrand(): void {
  const code = tenantCode.value.trim()
  if (code.length > 0) void tenantBrandSelector.select(code)
}
</script>

<template>
  <section
    class="min-w-0 flex flex-col justify-center p-[clamp(1.5rem,6vw,5.5rem)] lt-sm:justify-start lt-sm:px-5 lt-sm:pb-8 lt-sm:pt-[1.35rem]"
    aria-labelledby="signin-title"
  >
    <div class="mb-12 lg:hidden lt-sm:mb-13" aria-hidden="true">
      <LoginBrandIdentity surface="surface" compact />
    </div>

    <article class="m-auto w-full max-w-114">
      <header class="mb-8">
        <p class="m-0 mb-3.5 text-xs text-primary font-700 tracking-[0.16em] uppercase">欢迎回来</p>
        <h2
          id="signin-title"
          class="m-0 text-[clamp(1.75rem,4vw,2.25rem)] font-720 leading-[1.2] tracking-[-0.035em]"
        >
          登录工作空间
        </h2>
        <p class="mb-0 mt-3 text-[0.925rem] text-muted-foreground leading-[1.65]">
          请输入你的租户和账号信息，继续进入{{ brand.systemName }}。
        </p>
      </header>

      <form class="grid gap-5" @submit.prevent="submit">
        <div class="grid gap-2">
          <label for="tenant-code" class="text-[0.825rem] text-foreground font-650">
            租户代码
          </label>
          <Input
            id="tenant-code"
            v-model="tenantCode"
            class="login-input transition-[border-color,box-shadow,background-color] duration-[160ms] focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] motion-reduce:transition-none"
            size="xl"
            autocomplete="organization"
            :maxlength="80"
            placeholder="例如：default"
            required
            :disabled="submitting"
            @focusout="selectTenantBrand"
          >
            <template #leading>
              <svg
                class="size-4.5 shrink-0 fill-none stroke-current text-muted-foreground [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M4 20V6l8-3 8 3v14M8 9h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2M2 20h20" />
              </svg>
            </template>
          </Input>
          <p class="-mt-0.5 m-0 text-[0.725rem] text-muted-foreground">由你的系统管理员提供</p>
        </div>

        <div class="grid gap-2">
          <label for="login-account" class="text-[0.825rem] text-foreground font-650"> 账号 </label>
          <Input
            id="login-account"
            v-model="username"
            class="login-input transition-[border-color,box-shadow,background-color] duration-[160ms] focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] motion-reduce:transition-none"
            size="xl"
            autocomplete="username"
            :maxlength="320"
            placeholder="用户名或邮箱"
            required
            autofocus
            :disabled="submitting"
          >
            <template #leading>
              <svg
                class="size-4.5 shrink-0 fill-none stroke-current text-muted-foreground [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c.8-4.7 3.5-7 8-7s7.2 2.3 8 7" />
              </svg>
            </template>
          </Input>
        </div>

        <div class="grid gap-2">
          <div class="flex items-center justify-between gap-4">
            <label for="login-password" class="text-[0.825rem] text-foreground font-650">
              密码
            </label>
            <span v-if="capsLockActive" class="text-[0.725rem] text-warning">大写锁定已开启</span>
          </div>
          <Input
            id="login-password"
            v-model="password"
            class="login-input transition-[border-color,box-shadow,background-color] duration-[160ms] focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)] motion-reduce:transition-none"
            size="xl"
            :type="passwordType"
            autocomplete="current-password"
            :maxlength="1024"
            placeholder="输入登录密码"
            required
            :disabled="submitting"
            :control-props="{
              'aria-describedby': errorMessage ? 'login-error' : undefined,
              'aria-invalid': errorMessage ? true : undefined,
            }"
            @keydown="updateCapsLock"
            @keyup="updateCapsLock"
            @blur="capsLockActive = false"
          >
            <template #leading>
              <svg
                class="size-4.5 shrink-0 fill-none stroke-current text-muted-foreground [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M7 10V8a5 5 0 0 1 10 0v2M5 10h14v11H5z" />
                <circle cx="12" cy="15" r="1.5" />
              </svg>
            </template>
            <template #trailing>
              <button
                class="size-8 grid cursor-pointer place-items-center border-0 rounded-lg bg-transparent text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                type="button"
                :aria-label="passwordToggleLabel"
                :aria-pressed="passwordVisible"
                :disabled="submitting"
                @click="passwordVisible = !passwordVisible"
              >
                <svg
                  v-if="passwordVisible"
                  viewBox="0 0 24 24"
                  class="size-4.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
                  aria-hidden="true"
                >
                  <path
                    d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.5 10.5 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-2.1 3.1M6.6 6.6C4.2 8.2 3 12 3 12s3.5 7 9 7a9.8 9.8 0 0 0 3.4-.6"
                  />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  class="size-4.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
                  aria-hidden="true"
                >
                  <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </template>
          </Input>
        </div>

        <div
          v-if="errorMessage"
          id="login-error"
          class="-mt-0.5 flex items-start gap-2.5 border border-destructive/22 rounded-[var(--radius)] bg-destructive/7 px-3.5 py-3 text-[0.8rem] text-destructive leading-[1.5]"
          role="alert"
          aria-live="polite"
        >
          <svg
            viewBox="0 0 24 24"
            class="mt-0.5 size-4 shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6m0 4h.01" />
          </svg>
          <span>{{ errorMessage }}</span>
        </div>

        <ButtonLoading
          class="mt-0.5 min-h-12.5 w-full font-680 shadow-lg shadow-primary/18"
          type="submit"
          size="xl"
          :loading="submitting"
          loading-text="正在验证身份"
          loading-position="center"
        >
          登录
        </ButtonLoading>
      </form>

      <div
        class="mt-6 flex items-center gap-3 rounded-[var(--radius)] bg-muted/65 px-3.5 py-3 text-muted-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-4.5 shrink-0 fill-none stroke-current text-success [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
          aria-hidden="true"
        >
          <path d="M12 3 4.5 7v5c0 4.6 3.1 7.4 7.5 9 4.4-1.6 7.5-4.4 7.5-9V7z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <p class="m-0 grid gap-0.5 text-[0.73rem]">
          <strong class="text-[0.78rem] text-foreground font-650">安全登录</strong>
          <span>登录凭据不会暴露给页面脚本</span>
        </p>
      </div>

      <p class="mb-0 mt-6 text-center text-xs text-muted-foreground">
        无法登录？请联系所在组织的系统管理员。
      </p>
    </article>
  </section>
</template>
