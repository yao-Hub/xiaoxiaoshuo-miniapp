<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import { ensureUserSession } from '@/services/auth'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { useAudiobook } from '@/composables/useAudiobook'
import { usePageTheme, useTheme } from '@/composables/useTheme'
import { syncUserDataFromServer } from '@/services/user-data-sync'

const loading = ref(false)
const errorMessage = ref('')
const redirectUrl = ref('')
const { themeClass } = usePageTheme()
usePageAnalytics('login')

onLoad((options) => {
  redirectUrl.value = decodeURIComponent(String(options?.redirect || ''))
})

async function loginWithWechat() {
  if (loading.value) {
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    await ensureUserSession()
    await finishLogin()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

async function finishLogin() {
  await syncUserDataFromServer()
  useTheme().reloadThemeFromStorage()
  useAudiobook().reloadUserSettings()

  if (redirectUrl.value) {
    const tabPages = ['/pages/index/index', '/pages/history/history', '/pages/profile/profile']
    if (tabPages.some((page) => redirectUrl.value.startsWith(page))) {
      uni.switchTab({ url: redirectUrl.value })
    } else {
      uni.redirectTo({ url: redirectUrl.value })
    }
    return
  }
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="login-page" :class="themeClass">
    <view class="login-card">
      <view class="eyebrow">XIGUA KENSHU</view>
      <view class="title">西瓜啃书</view>
      <view class="subtitle">使用微信登录后即可使用</view>

      <button class="wechat-button" :disabled="loading" @tap="loginWithWechat">
        <image
          class="wechat-icon"
          src="/static/icons/wechat.svg"
          mode="aspectFit"
          aria-hidden="true"
        />
        <text>{{ loading ? '登录中…' : '微信一键登录' }}</text>
      </button>

      <view v-if="errorMessage" class="error">{{ errorMessage }}</view>
    </view>

    <GlobalAudiobookPlayer />
  </view>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  padding: 40rpx 30rpx;
  background: radial-gradient(circle at 80% 0%, var(--ambient), transparent 36%), var(--bg);
  place-items: center;
}

.login-card {
  width: 100%;
  max-width: 560rpx;
  padding: 48rpx 36rpx;
  background: var(--surface);
  border: 1rpx solid var(--line);
  border-radius: 30rpx;
}

.eyebrow {
  color: var(--gold);
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}

.title {
  margin-top: 14rpx;
  font-size: 64rpx;
  font-weight: 800;
}

.subtitle {
  margin-top: 12rpx;
  color: var(--muted);
  font-size: 30rpx;
}

.wechat-button {
  display: flex;
  height: 92rpx;
  margin: 40rpx 0 0;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  color: #fff;
  background: #07c160;
  border-radius: 16rpx;
  font-size: 31rpx;
  font-weight: 700;
  line-height: 92rpx;
}

.wechat-button[disabled] {
  opacity: 0.6;
}

.wechat-icon {
  width: 44rpx;
  height: 44rpx;
}

.error {
  margin-top: 24rpx;
  color: var(--danger);
  font-size: 28rpx;
  line-height: 1.5;
}
</style>
