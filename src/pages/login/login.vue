<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { login, register } from '@/services/auth'

const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const errorMessage = ref('')
const redirectUrl = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const form = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

onLoad((options) => {
  redirectUrl.value = decodeURIComponent(String(options?.redirect || ''))
})

async function submit() {
  errorMessage.value = ''
  const username = form.username.trim()
  if (username.length < 3) {
    errorMessage.value = '账号至少需要 3 个字符'
    return
  }
  if (form.password.length < 8) {
    errorMessage.value = '密码至少需要 8 个字符'
    return
  }
  if (mode.value === 'register' && form.password !== form.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }

  loading.value = true
  try {
    if (mode.value === 'register') {
      await register(username, form.password)
    } else {
      await login(username, form.password)
    }

    if (redirectUrl.value) {
      const tabPages = ['/pages/index/index', '/pages/history/history', '/pages/profile/profile']
      if (tabPages.some((page) => redirectUrl.value.startsWith(page))) {
        uni.switchTab({ url: redirectUrl.value })
      } else {
        uni.redirectTo({ url: redirectUrl.value })
      }
    } else {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  errorMessage.value = ''
}
</script>

<template>
  <view class="login-page">
    <view class="login-card">
      <view class="eyebrow">XIGUA KENSHU</view>
      <view class="title">西瓜啃书</view>
      <view class="subtitle">
        {{ mode === 'login' ? '登录你的账号' : '注册一个新账号' }}
      </view>

      <view class="form">
        <input
          v-model="form.username"
          class="input"
          placeholder="账号"
          placeholder-class="placeholder"
          maxlength="24"
        />
        <view class="password-field">
          <input
            v-model="form.password"
            class="input password-input"
            :password="!showPassword"
            placeholder="密码，至少 8 位"
            placeholder-class="placeholder"
            maxlength="72"
          />
          <button
            class="password-toggle"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            @tap="showPassword = !showPassword"
          >
            <view class="eye-icon" :class="{ 'is-visible': showPassword }">
              <view class="eye-pupil" />
              <view v-if="showPassword" class="eye-slash" />
            </view>
          </button>
        </view>
        <view v-if="mode === 'register'" class="password-field">
          <input
            v-model="form.confirmPassword"
            class="input password-input"
            :password="!showConfirmPassword"
            placeholder="再次输入密码"
            placeholder-class="placeholder"
            maxlength="72"
          />
          <button
            class="password-toggle"
            :aria-label="showConfirmPassword ? '隐藏密码' : '显示密码'"
            @tap="showConfirmPassword = !showConfirmPassword"
          >
            <view class="eye-icon" :class="{ 'is-visible': showConfirmPassword }">
              <view class="eye-pupil" />
              <view v-if="showConfirmPassword" class="eye-slash" />
            </view>
          </button>
        </view>
      </view>

      <view v-if="errorMessage" class="error">{{ errorMessage }}</view>
      <button class="primary" :disabled="loading" @tap="submit">
        {{ loading ? '处理中…' : mode === 'login' ? '登录' : '注册' }}
      </button>
      <button class="switch-mode" @tap="toggleMode">
        {{ mode === 'login' ? '没有账号？注册' : '已有账号？登录' }}
      </button>
      <view v-if="mode === 'register'" class="hint"> 注册后即可登录并使用搜索功能。 </view>
    </view>
  </view>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  padding: 40rpx 30rpx;
  background:
    radial-gradient(circle at 80% 0%, rgba(245, 200, 76, 0.16), transparent 36%), var(--bg);
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

.form {
  margin-top: 44rpx;
}

.input {
  height: 92rpx;
  margin-bottom: 22rpx;
  padding: 0 24rpx;
  color: var(--ink);
  background: #151310;
  border: 1rpx solid var(--line);
  border-radius: 16rpx;
  font-size: 30rpx;
}

.password-field {
  position: relative;
  margin-bottom: 22rpx;
}

.password-input {
  margin-bottom: 0;
  padding-right: 108rpx;
}

.password-toggle {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 92rpx;
  margin: 0;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0 16rpx 16rpx 0;
}

.password-toggle::after {
  border: 0;
}

.eye-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 26rpx;
  border: 3rpx solid var(--gold);
  border-radius: 50%;
}

.eye-pupil {
  width: 12rpx;
  height: 12rpx;
  background: var(--gold);
  border-radius: 50%;
}

.eye-slash {
  position: absolute;
  width: 50rpx;
  height: 3rpx;
  background: var(--gold);
  border-radius: 999rpx;
  transform: rotate(-42deg);
}

.placeholder {
  color: #746e64;
}

.error {
  margin-bottom: 18rpx;
  color: var(--danger);
  font-size: 28rpx;
  line-height: 1.5;
}

.primary {
  height: 88rpx;
  margin: 8rpx 0 0;
  color: #17130a;
  background: var(--gold);
  border-radius: 16rpx;
  font-size: 31rpx;
  font-weight: 700;
  line-height: 88rpx;
}

.primary[disabled] {
  opacity: 0.6;
}

.switch-mode {
  height: 74rpx;
  margin-top: 12rpx;
  color: var(--link, var(--gold));
  background: transparent;
  font-size: 28rpx;
  line-height: 74rpx;
}

.hint {
  margin-top: 16rpx;
  color: var(--muted);
  font-size: 26rpx;
  text-align: center;
}
</style>
