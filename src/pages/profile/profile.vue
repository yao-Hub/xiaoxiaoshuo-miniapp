<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import GlobalAudiobookPlayer from '@/components/audiobook/GlobalAudiobookPlayer.vue'
import BottomSheet from '@/components/common/BottomSheet.vue'
import {
  ensureUserSession,
  getAuthToken,
  getCachedUser,
  getCurrentUser,
  hasActiveAccess,
  hasAudiobookAccess,
  logout,
  openLoginPage,
  updateProfile,
  type SessionUser
} from '@/services/auth'
import { usePageAnalytics } from '@/composables/usePageAnalytics'
import { useTabBarTheme } from '@/composables/useTabBarTheme'

const user = ref<SessionUser | undefined>(getCachedUser())
const loggedIn = ref(Boolean(getAuthToken()))
const errorMessage = ref('')
const profileSheetVisible = ref(false)
const profileSaving = ref(false)
const avatarLoading = ref(false)
const profileErrorMessage = ref('')
const avatarPreview = ref('')
const profileForm = reactive({
  displayName: ''
})
const { themeClass, resolvedTheme, toggleResolvedTheme } = useTabBarTheme(2)
usePageAnalytics('profile')
const themeIconPath = computed(() =>
  resolvedTheme.value === 'dark'
    ? '/static/icons/theme-sun-light.svg'
    : '/static/icons/theme-moon-dark.svg'
)

const accessText = computed(() => (hasActiveAccess(user.value) ? '功能正常' : ''))
const audiobookAccessText = computed(() => {
  if (!user.value?.audiobookEnabled) {
    return '未开通'
  }
  return hasAudiobookAccess(user.value) ? '正常' : '已到期'
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

function openProfileEditor() {
  if (!user.value) {
    return
  }
  profileForm.displayName = user.value.displayName || usernameText.value
  avatarPreview.value = user.value.avatarUrl || ''
  profileErrorMessage.value = ''
  profileSheetVisible.value = true
}

function closeProfileEditor() {
  if (profileSaving.value) {
    return
  }
  profileSheetVisible.value = false
  profileErrorMessage.value = ''
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

async function setAvatarFromPath(filePath: string) {
  avatarLoading.value = true
  profileErrorMessage.value = ''
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
    avatarPreview.value = dataUrl
  } catch (error) {
    profileErrorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    avatarLoading.value = false
  }
}

function handleChooseAvatar(event: { detail: { avatarUrl: string } }) {
  const avatarUrl = String(event.detail.avatarUrl || '')
  if (avatarUrl) {
    void setAvatarFromPath(avatarUrl)
  }
}

function chooseCustomAvatar() {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success(result) {
      const filePath = result.tempFilePaths[0]
      if (filePath) {
        void setAvatarFromPath(filePath)
      }
    }
  })
}

function resetAvatar() {
  avatarPreview.value = ''
}

async function saveProfile() {
  const displayName = profileForm.displayName.trim()
  if (!displayName) {
    profileErrorMessage.value = '请输入昵称'
    return
  }
  if (displayName.length > 24) {
    profileErrorMessage.value = '昵称最多 24 个字符'
    return
  }
  profileSaving.value = true
  profileErrorMessage.value = ''
  try {
    user.value = await updateProfile(displayName, avatarPreview.value || null)
    profileSheetVisible.value = false
    uni.showToast({ title: '资料已保存', icon: 'success' })
  } catch (error) {
    profileErrorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    profileSaving.value = false
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
        :disabled="!loggedIn"
        aria-label="编辑头像和昵称"
        @tap="openProfileEditor"
      >
        <image
          v-if="user?.avatarUrl"
          class="avatar-image"
          :src="user.avatarUrl"
          mode="aspectFill"
        />
        <view v-else class="avatar">{{ avatarText }}</view>
        <view v-if="loggedIn" class="avatar-edit-badge">换</view>
      </button>
      <view>
        <view class="username">{{ usernameText }}</view>
        <view
          v-if="!loggedIn || accessText"
          class="status"
          :class="{ active: hasActiveAccess(user) }"
        >
          {{ loggedIn ? accessText : '登录以获取更多权限' }}
        </view>
        <text v-if="loggedIn" class="profile-edit-link" @tap="openProfileEditor"> 编辑资料 </text>
      </view>
    </view>

    <view v-if="loggedIn" class="detail-card card">
      <view class="detail-row">
        <text>阅读权限</text>
        <text>{{ hasActiveAccess(user) ? '正常' : '暂不可用' }}</text>
      </view>
      <view class="detail-row">
        <text>阅读到期时间</text>
        <text>{{ formatTime(user?.accessExpiresAt || null) }}</text>
      </view>
      <view class="detail-row">
        <text>听书权限</text>
        <text>{{ audiobookAccessText }}</text>
      </view>
      <view class="detail-row">
        <text>听书到期时间</text>
        <text>{{ formatTime(user?.audiobookExpiresAt || null) }}</text>
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
    <button v-else class="login-button" @tap="openLogin">微信登录</button>

    <BottomSheet v-if="profileSheetVisible" :z-index="100" @close="closeProfileEditor">
      <view class="profile-sheet">
        <view class="profile-sheet-head">
          <view>
            <view class="profile-sheet-title">编辑资料</view>
            <view class="profile-sheet-subtitle">选择微信头像和昵称，或手动自定义</view>
          </view>
          <button class="sheet-close" aria-label="关闭资料编辑" @tap="closeProfileEditor">×</button>
        </view>

        <button
          class="avatar-editor"
          open-type="chooseAvatar"
          :disabled="avatarLoading"
          aria-label="选择微信头像"
          @chooseavatar="handleChooseAvatar"
        >
          <image
            v-if="avatarPreview"
            class="avatar-preview"
            :src="avatarPreview"
            mode="aspectFill"
          />
          <view v-else class="avatar-preview avatar-placeholder">{{ avatarText }}</view>
          <view class="avatar-editor-hint">
            {{ avatarLoading ? '正在处理头像…' : '点击选择微信头像' }}
          </view>
        </button>

        <view class="avatar-actions">
          <button class="sheet-secondary-button" @tap="chooseCustomAvatar">从相册选择</button>
          <button v-if="avatarPreview" class="sheet-text-button" @tap="resetAvatar">
            恢复默认
          </button>
        </view>

        <view class="profile-field">
          <text class="profile-field-label">昵称</text>
          <input
            v-model="profileForm.displayName"
            class="profile-name-input"
            type="nickname"
            maxlength="24"
            confirm-type="done"
            placeholder="点击使用微信昵称，或手动输入"
            placeholder-class="profile-placeholder"
            @confirm="saveProfile"
          />
        </view>

        <view v-if="profileErrorMessage" class="profile-sheet-error">
          {{ profileErrorMessage }}
        </view>

        <view class="profile-sheet-actions">
          <button class="sheet-cancel-button" :disabled="profileSaving" @tap="closeProfileEditor">
            取消
          </button>
          <button
            class="sheet-save-button"
            :disabled="profileSaving || avatarLoading"
            @tap="saveProfile"
          >
            {{ profileSaving ? '保存中…' : '保存' }}
          </button>
        </view>
      </view>
    </BottomSheet>

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

.avatar-edit-badge {
  position: absolute;
  right: -6rpx;
  bottom: -6rpx;
  display: grid;
  width: 36rpx;
  height: 36rpx;
  color: var(--button-ink);
  background: var(--gold);
  border: 4rpx solid var(--surface);
  border-radius: 50%;
  font-size: 20rpx;
  font-weight: 700;
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

.profile-edit-link {
  display: inline-block;
  margin-top: 10rpx;
  color: var(--gold);
  font-size: 25rpx;
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

.profile-sheet {
  padding: 8rpx 4rpx 4rpx;
}

.profile-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.profile-sheet-title {
  font-size: 36rpx;
  font-weight: 800;
}

.profile-sheet-subtitle {
  margin-top: 8rpx;
  color: var(--muted);
  font-size: 25rpx;
}

.sheet-close {
  width: 60rpx;
  height: 60rpx;
  margin: 0;
  padding: 0;
  flex: 0 0 60rpx;
  color: var(--muted);
  background: transparent;
  font-size: 46rpx;
  line-height: 60rpx;
}

.avatar-editor {
  display: flex;
  width: 100%;
  margin: 28rpx 0 0;
  padding: 0;
  align-items: center;
  flex-direction: column;
  gap: 12rpx;
  color: var(--ink);
  background: transparent;
  line-height: 1.4;
}

.avatar-preview {
  width: 132rpx;
  height: 132rpx;
  border-radius: 34rpx;
}

.avatar-placeholder {
  display: grid;
  color: var(--button-ink);
  background: var(--gold);
  font-size: 54rpx;
  font-weight: 800;
  place-items: center;
}

.avatar-editor-hint {
  color: var(--muted);
  font-size: 25rpx;
}

.avatar-actions {
  display: flex;
  min-height: 60rpx;
  margin-top: 12rpx;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
}

.sheet-secondary-button,
.sheet-text-button {
  height: 56rpx;
  margin: 0;
  padding: 0 20rpx;
  border-radius: 12rpx;
  font-size: 25rpx;
  line-height: 56rpx;
}

.sheet-secondary-button {
  color: var(--ink);
  background: var(--surface-strong);
}

.sheet-text-button {
  color: var(--muted);
  background: transparent;
}

.profile-field {
  margin-top: 18rpx;
}

.profile-field-label {
  display: block;
  margin-bottom: 10rpx;
  color: var(--muted);
  font-size: 25rpx;
}

.profile-name-input {
  height: 86rpx;
  padding: 0 22rpx;
  color: var(--ink);
  background: var(--input-bg);
  border: 1rpx solid var(--line);
  border-radius: 14rpx;
  font-size: 29rpx;
}

.profile-placeholder {
  color: var(--muted);
}

.profile-sheet-error {
  margin-top: 14rpx;
  color: var(--danger);
  font-size: 25rpx;
  line-height: 1.5;
}

.profile-sheet-actions {
  display: flex;
  margin-top: 24rpx;
  gap: 14rpx;
}

.sheet-cancel-button,
.sheet-save-button {
  height: 78rpx;
  margin: 0;
  border-radius: 14rpx;
  font-size: 28rpx;
  line-height: 78rpx;
}

.sheet-cancel-button {
  color: var(--muted);
  background: var(--surface-strong);
  flex: 1;
}

.sheet-save-button {
  color: var(--button-ink);
  background: var(--gold);
  flex: 2;
  font-weight: 700;
}

.sheet-cancel-button[disabled],
.sheet-save-button[disabled] {
  opacity: 0.55;
}
</style>
