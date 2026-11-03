<script setup lang="ts">
const emit = defineEmits<{
  start: []
}>()
</script>

<template>
  <button class="listen-button" @tap.stop="emit('start')">
    <text class="listen-main">听</text>
  </button>
</template>

<style scoped>
.listen-button {
  position: fixed;
  right: 28rpx;
  bottom: calc(216rpx + env(safe-area-inset-bottom));
  z-index: 26;
  display: flex;
  width: 104rpx;
  height: 104rpx;
  margin: 0;
  padding: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--button-ink);
  background: var(--gold);
  border: 0;
  border-radius: 50%;
  box-shadow: 0 14rpx 36rpx var(--shadow);
  line-height: 1;
}

.listen-main {
  font-size: 38rpx;
  font-weight: 800;
}
</style>
