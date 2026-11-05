<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import {
  ensureUserSession,
  getAuthToken,
  getCachedUser,
  getCurrentUser,
  hasActiveAccess,
  hasAudiobookAccess,
  openLoginPage,
  updateProfile,
  type SessionUser
} from '@/services/auth'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { useTabBarTheme } from '@/composables/useTabBarTheme'

const user = ref<SessionUser | undefined>(getCachedUser())
const loggedIn = ref(Boolean(getAuthToken()))
const errorMessage = ref('')
const avatarLoading = ref(false)
const nicknameDraft = ref('')
const nicknameSaving = ref(false)
const { themeClass, resolvedTheme, toggleResolvedTheme } = useTabBarTheme(2)
usePageAnalytics('profile')
const themeIconPath = computed(() =>
  resolvedTheme.value === 'dark'
    ? '/static/icons/theme-sun-light.svg'
    : '/static/icons/theme-moon-dark.svg'
)

const audiobookAccessText = computed(() => {
  if (!user.value?.audiobookEnabled) {
    return '未开通'
  }
  if (user.value.audiobookTrialMinutes > 0) {
    return '待首次收听'
  }
  return hasAudiobookAccess(user.value) ? '正常' : '已到期'
})
const readAccessText = computed(() => {
  if (!user.value?.accessEnabled) {
    return '未开通'
  }
  if (user.value.accessTrialMinutes > 0) {
    return '待首次阅读'
  }
  return hasActiveAccess(user.value) ? '正常' : '已到期'
})
const usernameText = computed(() => {
  if (user.value?.displayName) {
    return user.value.displayName
  }
  if (user.value?.publicId) {
    return `微信用户 ${user.value.publicId.slice(-4).toUpperCase()}`
  }
  return loggedIn.value ? '账号加载中' : '未登录'
})
const avatarText = computed(() => usernameText.value.slice(0, 1))

syncNicknameDraft()

onShow(async () => {
  if (!getAuthToken()) {
    try {
      await ensureUserSession()
    } catch {
      // 微信登录失败时保留重新登录入口。
    }
  }
  loggedIn.value = Boolean(getAuthToken())
  if (!loggedIn.value) {
    user.value = undefined
    nicknameDraft.value = ''
    return
  }
  try {
    user.value = await getCurrentUser({ showLoading: false })
    errorMessage.value = ''
    syncNicknameDraft()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
})

function formatTime(value: string | null, trialMinutes: number) {
  if (trialMinutes > 0) {
    return '首次使用后开始计时'
  }
  if (!value) {
    return '长期有效'
  }
  return new Date(value).toLocaleString('zh-CN')
}

function openLogin() {
  openLoginPage('/pages/profile/profile')
}

function syncNicknameDraft() {
  nicknameDraft.value = user.value?.displayName || usernameText.value
}

function compressAvatar(filePath: string) {
  return new Promise<string>((resolve) => {
    uni.compressImage({
      src: filePath,
      quality: 70,
      success(result) {
        resolve(result.tempFilePath)
      },
      fail() {
        resolve(filePath)
      }
    })
  })
}

function readAvatarBase64(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    uni.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success(result) {
        resolve(String(result.data || ''))
      },
      fail() {
        reject(new Error('读取头像失败，请重新选择'))
      }
    })
  })
}

async function saveAvatarFromPath(filePath: string) {
  avatarLoading.value = true
  errorMessage.value = ''
  try {
    const compressedPath = await compressAvatar(filePath)
    const base64 = await readAvatarBase64(compressedPath)
    const lowerPath = compressedPath.toLowerCase()
    const contentType = lowerPath.endsWith('.png')
      ? 'image/png'
      : lowerPath.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg'
    const dataUrl = `data:${contentType};base64,${base64}`
    if (!base64 || dataUrl.length > 700000) {
      throw new Error('头像文件过大，请选择更小的图片')
    }
    user.value = await updateProfile(user.value?.displayName || usernameText.value, dataUrl)
    syncNicknameDraft()
    uni.showToast({ title: '头像已更新', icon: 'success' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    uni.showToast({ title: errorMessage.value, icon: 'none' })
  } finally {
    avatarLoading.value = false
  }
}

function handleChooseAvatar(event: { detail: { avatarUrl: string } }) {
  const avatarUrl = String(event.detail.avatarUrl || '')
  if (avatarUrl) {
    void saveAvatarFromPath(avatarUrl)
  }
}

async function saveNickname() {
  if (!user.value || nicknameSaving.value) {
    return
  }
  const currentName = user.value.displayName || usernameText.value
  const displayName = nicknameDraft.value.trim()
  if (!displayName) {
    nicknameDraft.value = currentName
    return
  }
  if (displayName === currentName) {
    nicknameDraft.value = currentName
    return
  }
  nicknameSaving.value = true
  errorMessage.value = ''
  try {
    user.value = await updateProfile(displayName, user.value.avatarUrl)
    syncNicknameDraft()
    uni.showToast({ title: '昵称已更新', icon: 'success' })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    syncNicknameDraft()
    uni.showToast({ title: errorMessage.value, icon: 'none' })
  } finally {
    nicknameSaving.value = false
  }
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
      <button
        class="avatar-button"
        open-type="chooseAvatar"
        :disabled="!loggedIn || avatarLoading"
        aria-label="更换头像"
        @chooseavatar="handleChooseAvatar"
      >
        <image
          v-if="user?.avatarUrl"
          class="avatar-image"
          :src="user.avatarUrl"
          mode="aspectFill"
        />
        <view v-else class="avatar">{{ avatarText }}</view>
      </button>
      <view class="profile-copy">
        <input
          v-model="nicknameDraft"
          class="username"
          type="nickname"
          maxlength="24"
          confirm-type="done"
          :disabled="!loggedIn || nicknameSaving"
          aria-label="点击使用微信昵称"
          @confirm="saveNickname"
          @blur="saveNickname"
        />
        <view v-if="!loggedIn" class="status">登录以获取更多权限</view>
      </view>
    </view>

    <view v-if="loggedIn" class="detail-card card">
      <view class="detail-row">
        <text>阅读权限</text>
        <text>{{ readAccessText }}</text>
      </view>
      <view class="detail-row">
        <text>阅读到期时间</text>
        <text>{{ formatTime(user?.accessExpiresAt || null, user?.accessTrialMinutes || 0) }}</text>
      </view>
      <view class="detail-row">
        <text>听书权限</text>
        <text>{{ audiobookAccessText }}</text>
      </view>
      <view class="detail-row">
        <text>听书到期时间</text>
        <text>
          {{ formatTime(user?.audiobookExpiresAt || null, user?.audiobookTrialMinutes || 0) }}
        </text>
      </view>
    </view>

    <view v-if="errorMessage" class="status-tip error">{{ errorMessage }}</view>
    <button v-if="!loggedIn" class="login-button" @tap="openLogin">微信登录</button>

    <GlobalAudiobookPlayer placement="above-tab" />
  </view>
</template>

<style scoped>
.profile-page {
  padding-top: 22rpx;
  padding-bottom: 150rpx;
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

.avatar-button {
  position: relative;
  width: 104rpx;
  height: 104rpx;
  margin: 0;
  padding: 0;
  flex: 0 0 104rpx;
  background: transparent;
  border: 0;
  border-radius: 28rpx;
  overflow: visible;
  line-height: 1;
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

.avatar-image {
  display: block;
  width: 104rpx;
  height: 104rpx;
  border-radius: 28rpx;
}

.profile-copy {
  min-width: 0;
  flex: 1;
}

.username {
  width: 100%;
  height: 56rpx;
  min-height: 56rpx;
  padding: 0;
  color: var(--ink);
  background: transparent;
  border: 0;
  font-size: 40rpx;
  font-weight: 800;
  line-height: 56rpx;
}

.status {
  margin-top: 10rpx;
  color: var(--danger);
  font-size: 27rpx;
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

.login-button {
  height: 82rpx;
  margin: 32rpx 0 0;
  border-radius: 16rpx;
  font-size: 28rpx;
  line-height: 82rpx;
}

.login-button {
  color: var(--button-ink);
  background: var(--gold);
  border: 0;
  font-weight: 700;
}

</style>
