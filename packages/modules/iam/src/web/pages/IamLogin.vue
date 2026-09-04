<script setup lang="ts">
import { JwButton } from '@jingwei/ui'

import { useSignIn } from '../composables/use-sign-in.js'

const { tenantCode, username, password, errorMessage, submitting, submit } = useSignIn()
</script>

<template>
  <main class="login-page">
    <section class="login-card">
      <p class="eyebrow">JINGWEI</p>
      <h1>经纬企业平台</h1>
      <p class="intro">使用租户账号进入工作空间。</p>
      <form @submit.prevent="submit">
        <label>租户代码<input v-model="tenantCode" autocomplete="organization" /></label>
        <label>账号<input v-model="username" autocomplete="username" /></label>
        <label
          >密码<input v-model="password" type="password" autocomplete="current-password"
        /></label>
        <p v-if="errorMessage" class="error">
          {{ errorMessage }}
        </p>
        <JwButton type="submit" :disabled="submitting">
          {{ submitting ? '正在登录…' : '登录' }}
        </JwButton>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 1rem;
  background: radial-gradient(circle at 20% 10%, #e7edff, transparent 35%), var(--jw-color-canvas);
}
.login-card {
  width: min(26rem, calc(100vw - 2rem));
  padding: 2rem;
  border: 1px solid var(--jw-color-border);
  border-radius: 1rem;
  background: white;
  box-shadow: 0 1.5rem 4rem rgb(25 45 90 / 10%);
}
.eyebrow {
  color: var(--jw-color-brand);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
}
h1 {
  margin: 0.5rem 0;
}
.intro {
  margin: 0 0 1.5rem;
  color: var(--jw-color-muted);
}
form,
label {
  display: grid;
  gap: 0.5rem;
}
form {
  gap: 1rem;
}
label {
  font-size: 0.875rem;
  font-weight: 600;
}
input {
  min-height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid var(--jw-color-border);
  border-radius: 0.625rem;
  font: inherit;
}
.error {
  margin: 0;
  color: #b42318;
}
</style>
