<script setup lang="ts">
import { PageContainer } from '@jingwei/ui'
</script>

<template>
  <main class="recovery">
    <PageContainer title="恢复入口" description="动态导航不可用时保留的最小静态安全层。">
      <p>请检查 Navigation 发布版本、Edition 页面注册表以及服务端连接状态。</p>
      <a href="/">重新加载</a>
    </PageContainer>
  </main>
</template>

<style scoped>
.recovery {
  width: min(44rem, calc(100% - 2rem));
  margin: 4rem auto;
}
</style>
