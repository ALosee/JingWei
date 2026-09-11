<script setup lang="ts">
import { computed, ref } from 'vue'

import { ButtonLoading, Input } from '@jingwei/ui'

import { useSignIn } from '../composables/use-sign-in.js'

const { tenantCode, username, password, errorMessage, submitting, submit } = useSignIn()
const passwordVisible = ref(false)
const capsLockActive = ref(false)

const passwordType = computed(() => (passwordVisible.value ? 'text' : 'password'))
const passwordToggleLabel = computed(() => (passwordVisible.value ? '隐藏密码' : '显示密码'))

function updateCapsLock(event: KeyboardEvent): void {
  capsLockActive.value = event.getModifierState('CapsLock')
}
</script>

<template>
  <main class="login-page">
    <div class="login-shell">
      <section class="brand-panel" aria-labelledby="platform-title">
        <div class="brand-glow brand-glow-primary" />
        <div class="brand-glow brand-glow-secondary" />
        <header class="brand-header">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M12 24h24M24 12v24" />
              <circle cx="24" cy="24" r="14" />
              <circle cx="24" cy="24" r="3.5" class="brand-mark-core" />
            </svg>
          </span>
          <span class="brand-wordmark">JINGWEI</span>
        </header>

        <div class="brand-copy">
          <p class="brand-kicker">Enterprise workspace</p>
          <h1 id="platform-title">经纬企业平台</h1>
          <p class="brand-statement">让组织、权限与业务边界保持清晰，让每一次协作都有迹可循。</p>
        </div>

        <ul class="platform-principles" aria-label="平台安全能力">
          <li>
            <span class="principle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6z" />
              </svg>
            </span>
            <span><strong>安全会话</strong><small>凭据只由浏览器与服务端处理</small></span>
          </li>
          <li>
            <span class="principle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3 4.5 7v5c0 4.6 3.1 7.4 7.5 9 4.4-1.6 7.5-4.4 7.5-9V7z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <span><strong>租户隔离</strong><small>身份与数据始终保留明确边界</small></span>
          </li>
          <li>
            <span class="principle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <circle cx="8" cy="8" r="3" />
                <circle cx="16.5" cy="9.5" r="2.5" />
                <path
                  d="M3 19c.7-3.7 2.4-5.5 5-5.5s4.3 1.8 5 5.5M13 18c.5-2.7 1.7-4 3.7-4 2 0 3.3 1.3 3.8 4"
                />
              </svg>
            </span>
            <span><strong>实时授权</strong><small>权限变化即时作用于访问决策</small></span>
          </li>
        </ul>

        <footer class="brand-footer">
          <span>Platform Foundation</span>
          <span aria-hidden="true">·</span>
          <span>Secure by design</span>
        </footer>
      </section>

      <section class="auth-panel" aria-labelledby="signin-title">
        <div class="mobile-brand" aria-hidden="true">
          <span class="brand-mark brand-mark-small">
            <svg viewBox="0 0 48 48">
              <path d="M12 24h24M24 12v24" />
              <circle cx="24" cy="24" r="14" />
              <circle cx="24" cy="24" r="3.5" class="brand-mark-core" />
            </svg>
          </span>
          <span class="brand-wordmark">JINGWEI</span>
        </div>

        <article class="auth-card">
          <header class="auth-heading">
            <p class="auth-kicker">欢迎回来</p>
            <h2 id="signin-title">登录工作空间</h2>
            <p>请输入你的租户和账号信息，继续进入经纬企业平台。</p>
          </header>

          <form class="signin-form" @submit.prevent="submit">
            <div class="form-field">
              <label for="tenant-code">租户代码</label>
              <Input
                id="tenant-code"
                v-model="tenantCode"
                class="login-input"
                size="xl"
                autocomplete="organization"
                :maxlength="80"
                placeholder="例如：default"
                required
                :disabled="submitting"
              >
                <template #leading>
                  <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20V6l8-3 8 3v14M8 9h2m4 0h2m-8 4h2m4 0h2m-8 4h2m4 0h2M2 20h20" />
                  </svg>
                </template>
              </Input>
              <p class="field-hint">由你的系统管理员提供</p>
            </div>

            <div class="form-field">
              <label for="login-account">账号</label>
              <Input
                id="login-account"
                v-model="username"
                class="login-input"
                size="xl"
                autocomplete="username"
                :maxlength="320"
                placeholder="用户名或邮箱"
                required
                autofocus
                :disabled="submitting"
              >
                <template #leading>
                  <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c.8-4.7 3.5-7 8-7s7.2 2.3 8 7" />
                  </svg>
                </template>
              </Input>
            </div>

            <div class="form-field">
              <div class="field-label-row">
                <label for="login-password">密码</label>
                <span v-if="capsLockActive" class="caps-lock-note">大写锁定已开启</span>
              </div>
              <Input
                id="login-password"
                v-model="password"
                class="login-input"
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
                  <svg class="field-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 10V8a5 5 0 0 1 10 0v2M5 10h14v11H5z" />
                    <circle cx="12" cy="15" r="1.5" />
                  </svg>
                </template>
                <template #trailing>
                  <button
                    class="password-toggle"
                    type="button"
                    :aria-label="passwordToggleLabel"
                    :aria-pressed="passwordVisible"
                    :disabled="submitting"
                    @click="passwordVisible = !passwordVisible"
                  >
                    <svg v-if="passwordVisible" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.5 10.5 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-2.1 3.1M6.6 6.6C4.2 8.2 3 12 3 12s3.5 7 9 7a9.8 9.8 0 0 0 3.4-.6"
                      />
                    </svg>
                    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
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
              class="login-error"
              role="alert"
              aria-live="polite"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6m0 4h.01" />
              </svg>
              <span>{{ errorMessage }}</span>
            </div>

            <ButtonLoading
              class="signin-button"
              type="submit"
              size="xl"
              :loading="submitting"
              loading-text="正在验证身份"
              loading-position="center"
            >
              登录
            </ButtonLoading>
          </form>

          <div class="session-note">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3 4.5 7v5c0 4.6 3.1 7.4 7.5 9 4.4-1.6 7.5-4.4 7.5-9V7z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <p><strong>安全登录</strong><span>登录凭据不会暴露给页面脚本</span></p>
          </div>

          <p class="support-note">无法登录？请联系所在组织的系统管理员。</p>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.login-page {
  --login-brand-deep: 222 58% 13%;
  --login-brand-mid: 221 51% 22%;
  --login-brand-text: 210 40% 98%;
  --login-brand-soft: 214 32% 91%;

  min-height: 100dvh;
  padding: clamp(0.75rem, 2vw, 1.5rem);
  background:
    radial-gradient(circle at 82% 12%, hsl(var(--primary) / 0.1), transparent 24rem),
    hsl(var(--background));
  color: hsl(var(--foreground));
}

.login-shell {
  display: grid;
  min-height: calc(100dvh - clamp(1.5rem, 4vw, 3rem));
  overflow: hidden;
  border: 1px solid hsl(var(--border) / 0.8);
  border-radius: calc(var(--radius) * 2.25);
  background: hsl(var(--card));
  box-shadow:
    0 1px 2px hsl(var(--foreground) / 0.04),
    0 2rem 6rem hsl(var(--foreground) / 0.08);
}

.brand-panel {
  position: relative;
  display: none;
  min-width: 0;
  overflow: hidden;
  padding: clamp(2rem, 4vw, 4.5rem);
  background: linear-gradient(145deg, hsl(var(--login-brand-deep)), hsl(var(--login-brand-mid)));
  color: hsl(var(--login-brand-text));
  isolation: isolate;
}

.brand-panel::before,
.brand-panel::after {
  position: absolute;
  z-index: -1;
  border: 1px solid hsl(var(--login-brand-soft) / 0.12);
  border-radius: 50%;
  content: '';
}

.brand-panel::before {
  top: 21%;
  left: 58%;
  width: min(32vw, 31rem);
  aspect-ratio: 1;
}

.brand-panel::after {
  top: 30%;
  left: 68%;
  width: min(19vw, 18rem);
  aspect-ratio: 1;
}

.brand-glow {
  position: absolute;
  z-index: -2;
  border-radius: 999px;
  filter: blur(1px);
}

.brand-glow-primary {
  top: -12rem;
  right: -11rem;
  width: 28rem;
  height: 28rem;
  background: hsl(var(--primary) / 0.28);
}

.brand-glow-secondary {
  bottom: -16rem;
  left: -10rem;
  width: 31rem;
  height: 31rem;
  background: hsl(var(--info) / 0.18);
}

.brand-header,
.mobile-brand {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.brand-mark {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 1px solid hsl(var(--login-brand-text) / 0.28);
  border-radius: 0.875rem;
  background: hsl(var(--login-brand-text) / 0.1);
  box-shadow: inset 0 1px hsl(var(--login-brand-text) / 0.12);
}

.brand-mark svg {
  width: 1.8rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.5;
}

.brand-mark .brand-mark-core {
  fill: hsl(var(--login-brand-soft));
  stroke: none;
}

.brand-wordmark {
  font-size: 0.875rem;
  font-weight: 750;
  letter-spacing: 0.22em;
}

.brand-copy {
  align-self: center;
  max-width: 35rem;
  margin-top: auto;
}

.brand-kicker,
.auth-kicker {
  margin: 0 0 0.875rem;
  color: hsl(var(--login-brand-soft));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.brand-copy h1 {
  max-width: 8em;
  margin: 0;
  font-size: clamp(2.5rem, 4vw, 4.75rem);
  font-weight: 720;
  letter-spacing: -0.055em;
  line-height: 1.04;
}

.brand-statement {
  max-width: 30rem;
  margin: 1.5rem 0 0;
  color: hsl(var(--login-brand-soft) / 0.76);
  font-size: clamp(1rem, 1.25vw, 1.15rem);
  line-height: 1.8;
}

.platform-principles {
  display: grid;
  gap: 0.75rem;
  align-self: end;
  margin: auto 0 0;
  padding: 0;
  list-style: none;
}

.platform-principles li {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  max-width: 29rem;
  padding: 0.875rem 1rem;
  border: 1px solid hsl(var(--login-brand-soft) / 0.1);
  border-radius: calc(var(--radius) * 1.25);
  background: hsl(var(--login-brand-deep) / 0.24);
  backdrop-filter: blur(12px);
}

.principle-icon {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  place-items: center;
  border-radius: 0.7rem;
  background: hsl(var(--login-brand-soft) / 0.14);
  color: hsl(var(--login-brand-soft));
}

.principle-icon svg,
.field-icon,
.password-toggle svg,
.login-error svg,
.session-note > svg {
  width: 1.15rem;
  height: 1.15rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.7;
}

.platform-principles strong,
.platform-principles small {
  display: block;
}

.platform-principles strong {
  margin-bottom: 0.15rem;
  font-size: 0.875rem;
  font-weight: 650;
}

.platform-principles small {
  color: hsl(var(--login-brand-soft) / 0.58);
  font-size: 0.75rem;
}

.brand-footer {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 1.5rem;
  color: hsl(var(--login-brand-soft) / 0.42);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.auth-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: clamp(1.5rem, 6vw, 5.5rem);
}

.mobile-brand {
  margin-bottom: 3rem;
  color: hsl(var(--foreground));
}

.brand-mark-small {
  width: 2.5rem;
  height: 2.5rem;
  border-color: hsl(var(--primary) / 0.25);
  background: hsl(var(--primary) / 0.08);
  color: hsl(var(--primary));
}

.auth-card {
  width: min(100%, 28.5rem);
  margin: auto;
}

.auth-heading {
  margin-bottom: 2rem;
}

.auth-kicker {
  color: hsl(var(--primary));
}

.auth-heading h2 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
  font-weight: 720;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.auth-heading > p:last-child {
  margin: 0.75rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.925rem;
  line-height: 1.65;
}

.signin-form {
  display: grid;
  gap: 1.25rem;
}

.form-field {
  display: grid;
  gap: 0.55rem;
}

.form-field label {
  color: hsl(var(--foreground));
  font-size: 0.825rem;
  font-weight: 650;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.caps-lock-note {
  color: hsl(var(--warning));
  font-size: 0.725rem;
}

.login-input {
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background-color 160ms ease;
}

.login-input:focus-within {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
}

.field-icon {
  flex: none;
  color: hsl(var(--muted-foreground));
}

.field-hint {
  margin: -0.1rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.725rem;
}

.password-toggle {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease;
}

.password-toggle:hover {
  background: hsl(var(--accent));
  color: hsl(var(--foreground));
}

.password-toggle:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 1px;
}

.password-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.login-error {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  margin: -0.15rem 0 0;
  padding: 0.75rem 0.875rem;
  border: 1px solid hsl(var(--destructive) / 0.22);
  border-radius: var(--radius);
  background: hsl(var(--destructive) / 0.07);
  color: hsl(var(--destructive));
  font-size: 0.8rem;
  line-height: 1.5;
}

.login-error svg {
  width: 1rem;
  height: 1rem;
  flex: none;
  margin-top: 0.1rem;
}

.signin-button {
  width: 100%;
  min-height: 3.1rem;
  margin-top: 0.2rem;
  font-weight: 680;
  box-shadow: 0 0.75rem 1.75rem hsl(var(--primary) / 0.18);
}

.session-note {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding: 0.8rem 0.9rem;
  border-radius: var(--radius);
  background: hsl(var(--muted) / 0.65);
  color: hsl(var(--muted-foreground));
}

.session-note > svg {
  flex: none;
  color: hsl(var(--success));
}

.session-note p {
  display: grid;
  gap: 0.1rem;
  margin: 0;
  font-size: 0.73rem;
}

.session-note strong {
  color: hsl(var(--foreground));
  font-size: 0.78rem;
  font-weight: 650;
}

.support-note {
  margin: 1.5rem 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  text-align: center;
}

@media (min-width: 900px) {
  .login-shell {
    grid-template-columns: minmax(28rem, 1.08fr) minmax(27rem, 0.92fr);
  }

  .brand-panel {
    display: flex;
    flex-direction: column;
  }

  .mobile-brand {
    display: none;
  }
}

@media (max-width: 899px) {
  .login-shell {
    min-height: calc(100dvh - 1.5rem);
  }
}

@media (max-width: 520px) {
  .login-page {
    padding: 0;
    background: hsl(var(--card));
  }

  .login-shell {
    min-height: 100dvh;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .auth-panel {
    justify-content: flex-start;
    padding: 1.35rem 1.25rem 2rem;
  }

  .mobile-brand {
    margin-bottom: 3.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-input,
  .password-toggle {
    transition: none;
  }
}
</style>
