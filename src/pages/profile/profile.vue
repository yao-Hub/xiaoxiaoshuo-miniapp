<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  getAuthToken,
  getCachedUser,
  getCurrentUser,
  logout,
  openLoginPage,
  type SessionUser
} from '@/services/auth'
import { syncTabBar } from '@/utils/tabbar'

const user = ref<SessionUser | undefined>(getCachedUser())
const loggedIn = ref(Boolean(getAuthToken()))
const loading = ref(false)
const errorMessage = ref('')

const accessText = computed(() => {
  if (!user.value?.accessEnabled) {
    return ''
  }
  if (user.value.accessExpiresAt && Date.parse(user.value.accessExpiresAt) <= Date.now()) {
    return ''
  }
  return '功能正常'
})

onShow(async () => {
  syncTabBar(2)
  loggedIn.value = Boolean(getAuthToken())
  if (!loggedIn.value) {
    user.value = undefined
    return
  }
  loading.value = true
  try {
    user.value = await getCurrentUser()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
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
  <view class="page profile-page">
    <view class="profile-hero card">
      <view class="avatar">{{ user?.username?.slice(0, 1) || '西' }}</view>
      <view>
        <view class="username">{{ loggedIn ? user?.username || '加载中' : '未登录' }}</view>
        <view v-if="!loggedIn || accessText" class="status" :class="{ active: user?.accessEnabled }">
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
    <view v-else-if="loggedIn && !user?.accessEnabled" class="status-tip">
      当前版本部分内容暂不可用。
    </view>

    <button v-if="loggedIn" class="logout-button" @tap="logout">退出登录</button>
    <button v-else class="login-button" @tap="openLogin">登录 / 注册</button>
  </view>
</template>

<style scoped>
.profile-page {
  padding-top: 44rpx;
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
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
  color: #17130a;
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
  color: #67d38a;
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
  border: 1rpx solid rgba(231, 93, 82, 0.4);
}

.login-button {
  color: #17130a;
  background: var(--gold);
  border: 0;
  font-weight: 700;
}

.middle {
  display: grid;
  place-items: center;
}
</style>
