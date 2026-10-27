<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { login, register } from '@/services/auth'

const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const errorMessage = ref('')
const redirectUrl = ref('')
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
    let user
    if (mode.value === 'register') {
      user = await register(username, form.password)
    } else {
      user = await login(username, form.password)
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
      <view class="eyebrow">XIAOXIAOSHUO</view>
      <view class="title">西瓜伴读</view>
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
        <input
          v-model="form.password"
          class="input"
          password
          placeholder="密码，至少 8 位"
          placeholder-class="placeholder"
          maxlength="72"
        />
        <input
          v-if="mode === 'register'"
          v-model="form.confirmPassword"
          class="input"
          password
          placeholder="再次输入密码"
          placeholder-class="placeholder"
          maxlength="72"
        />
      </view>

      <view v-if="errorMessage" class="error">{{ errorMessage }}</view>
      <button class="primary" :disabled="loading" @tap="submit">
        {{ loading ? '处理中…' : mode === 'login' ? '登录' : '注册' }}
      </button>
      <button class="switch-mode" @tap="toggleMode">
        {{ mode === 'login' ? '没有账号？注册' : '已有账号？登录' }}
      </button>
      <view v-if="mode === 'register'" class="hint">
        注册后即可登录并使用搜索功能。
      </view>
    </view>
  </view>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  padding: 40rpx 30rpx;
  background:
    radial-gradient(circle at 80% 0%, rgba(245, 200, 76, 0.16), transparent 36%),
    var(--bg);
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
