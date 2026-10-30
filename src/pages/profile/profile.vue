<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import {
  getAuthToken,
  getCachedUser,
  getCurrentUser,
  logout,
  openLoginPage,
  type SessionUser
} from '@/services/auth'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { useTabBarTheme } from '@/composables/useTabBarTheme'

const user = ref<SessionUser | undefined>(getCachedUser())
const loggedIn = ref(Boolean(getAuthToken()))
const errorMessage = ref('')
const { themeClass, resolvedTheme, toggleResolvedTheme } = useTabBarTheme(2)
usePageAnalytics('profile')
const themeIconPath = computed(() =>
  resolvedTheme.value === 'dark'
    ? '/static/icons/theme-sun-light.svg'
    : '/static/icons/theme-moon-dark.svg'
)

const accessText = computed(() => {
  if (!user.value?.accessEnabled) {
    return ''
  }
  if (user.value.accessExpiresAt && Date.parse(user.value.accessExpiresAt) <= Date.now()) {
    return ''
  }
  return '功能正常'
})

const usernameText = computed(() => {
  const username = user.value?.username
  if (typeof username === 'string' && username.trim()) {
    return username.trim()
  }
  return loggedIn.value ? '账号加载中' : '未登录'
})

const avatarText = computed(() => {
  const username = user.value?.username
  return typeof username === 'string' && username.trim() ? username.trim().slice(0, 1) : '西'
})

onShow(async () => {
  loggedIn.value = Boolean(getAuthToken())
  if (!loggedIn.value) {
    user.value = undefined
    return
  }
  try {
    user.value = await getCurrentUser({ showLoading: false })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
})

function formatTime(value: string | null) {
  if (!value) {
    return '长期有效'
  }
  return new Date(value).toLocaleString('zh-CN')
}

function openLogin() {
  openLoginPage('/pages/profile/profile')
}
</script>

<template>
  <view class="page profile-page" :class="themeClass">
    <view class="profile-toolbar">
      <button
        class="theme-switch"
        :aria-label="resolvedTheme === 'dark' ? '切换为浅色模式' : '切换为深色模式'"
        @tap="toggleResolvedTheme"
      >
        <image class="theme-icon-image" :src="themeIconPath" mode="aspectFit" aria-hidden="true" />
      </button>
    </view>

    <view class="profile-hero card">
      <view class="avatar">{{ avatarText }}</view>
      <view>
        <view class="username">{{ usernameText }}</view>
        <view
          v-if="!loggedIn || accessText"
          class="status"
          :class="{ active: user?.accessEnabled }"
        >
          {{ loggedIn ? accessText : '登录以获取更多权限' }}
        </view>
      </view>
    </view>

    <view v-if="loggedIn" class="detail-card card">
      <view class="detail-row">
        <text>开通状态</text>
        <text>{{ user?.accessEnabled ? '正常' : '暂不可用' }}</text>
      </view>
      <view class="detail-row">
        <text>到期时间</text>
        <text>{{ formatTime(user?.accessExpiresAt || null) }}</text>
      </view>
      <view class="detail-row">
        <text>备注</text>
        <text>{{ user?.remark || '无' }}</text>
      </view>
      <view class="detail-row">
        <text>最近登录</text>
        <text>{{ user?.lastLoginAt ? formatTime(user.lastLoginAt) : '—' }}</text>
      </view>
    </view>

    <view v-if="errorMessage" class="status-tip error">{{ errorMessage }}</view>
    <button v-if="loggedIn" class="logout-button" @tap="logout">退出登录</button>
    <button v-else class="login-button" @tap="openLogin">登录 / 注册</button>

    <GlobalAudiobookPlayer placement="above-tab" />
  </view>
</template>

<style scoped>
.profile-page {
  padding-top: 22rpx;
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}

.profile-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 64rpx;
  margin-bottom: 14rpx;
}

.theme-switch {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  background: transparent;
  border: 0;
  border-radius: 50%;
  flex: 0 0 72rpx;
}

.theme-icon-image {
  display: block;
  width: 44rpx;
  height: 44rpx;
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 26rpx;
  padding: 30rpx;
}

.avatar {
  display: grid;
  width: 104rpx;
  height: 104rpx;
  color: var(--button-ink);
  background: var(--gold);
  border-radius: 28rpx;
  font-size: 50rpx;
  font-weight: 800;
  place-items: center;
}

.username {
  font-size: 40rpx;
  font-weight: 800;
}

.status {
  margin-top: 10rpx;
  color: var(--danger);
  font-size: 27rpx;
}

.status.active {
  color: var(--success);
}

.detail-card {
  margin-top: 24rpx;
  overflow: hidden;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 24rpx;
  padding: 25rpx 28rpx;
  border-bottom: 1rpx solid var(--line);
  font-size: 28rpx;
}

.detail-row:last-child {
  border-bottom: 0;
}

.detail-row text:first-child {
  color: var(--muted);
}

.detail-row text:last-child {
  text-align: right;
}

.status-tip {
  margin-top: 24rpx;
  padding: 24rpx;
  color: var(--muted);
  background: var(--surface);
  border: 1rpx solid var(--line);
  border-radius: 18rpx;
  font-size: 27rpx;
  line-height: 1.6;
}

.status-tip.error {
  color: var(--danger);
}

.logout-button,
.login-button {
  height: 82rpx;
  margin: 32rpx 0 0;
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 82rpx;
}

.logout-button {
  color: var(--danger);
  background: transparent;
  border: 1rpx solid var(--danger-border);
}

.login-button {
  color: var(--button-ink);
  background: var(--gold);
  border: 0;
  font-weight: 700;
}
</style>
