<script setup lang="ts">
import { Button } from '@jingwei/ui'

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
        <Button type="submit" :loading="submitting">
          {{ submitting ? '正在登录…' : '登录' }}
        </Button>
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
  background:
    radial-gradient(circle at 20% 10%, hsl(var(--primary) / 0.12), transparent 35%),
    hsl(var(--background));
}
.login-card {
  width: min(26rem, calc(100vw - 2rem));
  padding: 2rem;
  border: 1px solid hsl(var(--border) / var(--border-alpha, 1));
  border-radius: var(--radius);
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  box-shadow: 0 1.5rem 4rem hsl(var(--foreground) / 0.1);
}
.eyebrow {
  color: hsl(var(--primary));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
}
h1 {
  margin: 0.5rem 0;
}
.intro {
  margin: 0 0 1.5rem;
  color: hsl(var(--muted-foreground));
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
  border: 1px solid hsl(var(--input) / var(--input-alpha, 1));
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  border-radius: var(--radius);
  font: inherit;
}
.error {
  margin: 0;
  color: hsl(var(--destructive));
}
</style>
