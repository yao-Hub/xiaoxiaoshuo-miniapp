<script lang="ts">
import { initializeTheme, useTheme } from '@/composables/useTheme'
import { useAudiobook } from '@/composables/useAudiobook'
import { getAnalyticsSessionId, trackAnalyticsDuration } from '@/services/analytics'
import { ensureUserSession } from '@/services/auth'
import { syncUserDataFromServer } from '@/services/user-data-sync'

let appSessionStartedAt = 0

function setupMiniProgramUpdate() {
  // #ifdef MP-WEIXIN
  const updateManager = uni.getUpdateManager()
  updateManager.onUpdateReady(() => {
    uni.showModal({
      title: '发现新版本',
      content: '新版本已准备好，是否立即重启更新？',
      confirmText: '立即更新',
      cancelText: '稍后',
      success(result) {
        if (result.confirm) {
          updateManager.applyUpdate()
        }
      }
    })
  })
  updateManager.onUpdateFailed(() => {
    uni.showToast({
      title: '新版本下载失败，请重新打开小程序',
      icon: 'none',
      duration: 3000
    })
  })
  // #endif
}

export default {
  onLaunch() {
    initializeTheme()
    setupMiniProgramUpdate()
    getAnalyticsSessionId()
    appSessionStartedAt = Date.now()
  },
  onShow() {
    appSessionStartedAt = Date.now()
    void (async () => {
      try {
        await ensureUserSession()
      } catch {
        return
      }
      const synced = await syncUserDataFromServer()
      if (synced) {
        useTheme().reloadThemeFromStorage()
        useAudiobook().reloadUserSettings()
      }
    })()
  },
  onHide() {
    trackAnalyticsDuration('app_session', appSessionStartedAt, {
      page: 'app'
    })
    appSessionStartedAt = 0
  }
}
</script>

<style>
page {
  --bg: #12110f;
  --ink: #f5eddc;
  --muted: #a9a195;
  --surface: #211f1b;
  --surface-strong: #2c2923;
  --input-bg: #151310;
  --line: rgba(245, 237, 220, 0.12);
  --gold: #f5c84c;
  --danger: #e75d52;
  --danger-border: rgba(231, 93, 82, 0.38);
  --success: #67d38a;
  --accent: #f5c84c;
  --accent-soft: rgba(245, 200, 76, 0.1);
  --button-ink: #17130a;
  --button-muted: rgba(23, 19, 10, 0.68);
  --ambient: rgba(245, 200, 76, 0.13);
  --reader-bg: #171614;
  --reader-ink: #eee7d8;
  --toolbar-bg: rgba(28, 26, 22, 0.97);
  --overlay: rgba(0, 0, 0, 0.52);
  --shadow: rgba(0, 0, 0, 0.3);
  --skeleton-a: #211f1b;
  --skeleton-b: #2b2822;
  min-height: 100%;
  color: var(--ink);
  background: var(--bg);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 15px;
  font-weight: 400;
}

.theme-light {
  --bg: #f6f1e7;
  --ink: #29251f;
  --muted: #746d62;
  --surface: #fffaf1;
  --surface-strong: #eee5d7;
  --input-bg: #fffdf8;
  --line: rgba(61, 48, 31, 0.14);
  --gold: #e3ad3f;
  --danger: #b84239;
  --danger-border: rgba(184, 66, 57, 0.32);
  --success: #277244;
  --accent: #8c5b00;
  --accent-soft: rgba(140, 91, 0, 0.1);
  --button-ink: #211707;
  --button-muted: rgba(33, 23, 7, 0.7);
  --ambient: rgba(183, 122, 19, 0.12);
  --reader-bg: #f6f1e7;
  --reader-ink: #302b24;
  --toolbar-bg: rgba(255, 250, 241, 0.97);
  --overlay: rgba(35, 28, 18, 0.28);
  --shadow: rgba(83, 63, 34, 0.16);
  --skeleton-a: #eee5d7;
  --skeleton-b: #fffaf1;
  color: var(--ink);
}

view,
text,
input,
button {
  box-sizing: border-box;
}

button::after {
  border: 0;
}

.page {
  min-height: 100vh;
  padding: 32rpx 28rpx calc(48rpx + env(safe-area-inset-bottom));
  color: var(--ink);
  background: radial-gradient(circle at 90% 0%, var(--ambient), transparent 34%), var(--bg);
}

.card {
  background: var(--surface);
  border: 1rpx solid var(--line);
  border-radius: 24rpx;
}

.section-title {
  margin: 0;
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.muted {
  color: var(--muted);
}

.empty {
  padding: 64rpx 24rpx;
  color: var(--muted);
  text-align: center;
}
</style>
