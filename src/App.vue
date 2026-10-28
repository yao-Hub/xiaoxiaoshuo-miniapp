<script lang="ts">
export default {
  onLaunch() {
    console.info('西瓜啃书启动')
  }
}
</script>

<style>
page {
  --ink: #f5eddc;
  --muted: #a9a195;
  --surface: #211f1b;
  --surface-strong: #2c2923;
  --line: rgba(245, 237, 220, 0.12);
  --gold: #f5c84c;
  --danger: #e75d52;
  min-height: 100%;
  color: var(--ink);
  background: radial-gradient(circle at 90% 0%, rgba(245, 200, 76, 0.13), transparent 34%), #12110f;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 15px;
  font-weight: 400;
  text-rendering: optimizeLegibility;
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
