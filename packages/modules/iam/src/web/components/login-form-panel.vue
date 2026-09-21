<script setup lang="ts">
import { computed, ref } from 'vue'

import { ButtonLoading, Icon, Input } from '@jingwei/ui'

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
              <Icon icon="lucide:building-2" class="size-4.5 text-muted-foreground" />
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
              <Icon icon="lucide:user-round" class="size-4.5 text-muted-foreground" />
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
              <Icon icon="lucide:lock" class="size-4.5 text-muted-foreground" />
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
                <Icon :icon="passwordVisible ? 'lucide:eye-off' : 'lucide:eye'" class="size-4.5" />
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
          <Icon icon="lucide:circle-alert" class="mt-0.5 size-4 shrink-0" />
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
        <Icon icon="lucide:shield-check" class="size-4.5 shrink-0 text-success" />
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
