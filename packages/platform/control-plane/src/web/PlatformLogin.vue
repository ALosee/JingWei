<script setup lang="ts">
import { computed, ref } from 'vue'

import { ButtonLoading, Input } from '@jingwei/ui'

import { usePlatformLogin } from './composables/use-platform-login.js'

const { login, password, errorMessage, submitting, submit } = usePlatformLogin()
const passwordVisible = ref(false)
const passwordType = computed(() => (passwordVisible.value ? 'text' : 'password'))
</script>

<template>
  <main
    class="min-h-screen grid bg-muted/35 lg:grid-cols-[minmax(22rem,0.8fr)_minmax(32rem,1.2fr)]"
  >
    <section
      class="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between"
    >
      <div
        class="absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_15%,hsl(var(--primary)/0.55),transparent_36%),radial-gradient(circle_at_80%_80%,#0ea5e9_0,transparent_38%)]"
        aria-hidden="true"
      />
      <div class="relative flex items-center gap-3">
        <span class="size-10 grid place-items-center rounded-xl bg-white/12 text-lg font-750"
          >经</span
        >
        <div>
          <p class="m-0 text-lg font-720 tracking-wide">经纬平台管理</p>
          <p class="m-0 mt-0.5 text-xs text-white/55 tracking-[0.12em] uppercase">
            Platform Control Plane
          </p>
        </div>
      </div>
      <div class="relative max-w-110">
        <p class="m-0 text-xs text-sky-300 font-700 tracking-[0.18em] uppercase">平台控制面</p>
        <h1
          class="mb-5 mt-4 text-[clamp(2.2rem,4vw,3.5rem)] font-760 leading-[1.1] tracking-[-0.04em]"
        >
          管理租户生命周期，保持业务空间彼此隔离。
        </h1>
        <p class="m-0 text-sm text-white/60 leading-7">
          此入口仅供平台运营人员使用。租户用户仍从普通登录页进入自己的工作空间。
        </p>
      </div>
      <p class="relative m-0 text-xs text-white/40">独立身份、独立会话、独立管理边界</p>
    </section>

    <section class="flex items-center justify-center px-5 py-10 sm:px-10">
      <article
        class="w-full max-w-112 rounded-3xl bg-background p-7 shadow-xl shadow-black/6 sm:p-10"
      >
        <header class="mb-8">
          <p class="m-0 mb-3 text-xs text-primary font-700 tracking-[0.16em] uppercase">
            Platform Access
          </p>
          <h2 class="m-0 text-3xl font-740 tracking-[-0.03em]">登录平台管理后台</h2>
          <p class="mb-0 mt-3 text-sm text-muted-foreground leading-6">
            使用平台管理员账号登录。这里不会读取租户代码，也不会套用任何租户主题。
          </p>
        </header>

        <form class="grid gap-5" @submit.prevent="submit">
          <label class="grid gap-2 text-sm font-650">
            平台管理员账号
            <Input
              v-model="login"
              size="xl"
              autocomplete="username"
              autofocus
              required
              :maxlength="120"
              :disabled="submitting"
              placeholder="输入平台管理员账号"
            />
          </label>

          <label class="grid gap-2 text-sm font-650">
            密码
            <Input
              v-model="password"
              size="xl"
              :type="passwordType"
              autocomplete="current-password"
              required
              :maxlength="1024"
              :disabled="submitting"
              placeholder="输入登录密码"
            >
              <template #trailing>
                <button
                  type="button"
                  class="cursor-pointer border-0 bg-transparent px-1 text-xs text-muted-foreground hover:text-foreground"
                  :disabled="submitting"
                  @click="passwordVisible = !passwordVisible"
                >
                  {{ passwordVisible ? '隐藏' : '显示' }}
                </button>
              </template>
            </Input>
          </label>

          <p
            v-if="errorMessage"
            class="m-0 rounded-xl bg-destructive/8 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <ButtonLoading
            class="mt-1 min-h-12 w-full"
            type="submit"
            size="xl"
            :loading="submitting"
            loading-text="正在验证"
          >
            登录平台后台
          </ButtonLoading>
        </form>

        <p class="mb-0 mt-7 text-center text-xs text-muted-foreground">
          需要进入租户工作空间？
          <a class="text-primary font-650 no-underline hover:underline" href="/signin"
            >前往租户登录</a
          >
        </p>
      </article>
    </section>
  </main>
</template>
