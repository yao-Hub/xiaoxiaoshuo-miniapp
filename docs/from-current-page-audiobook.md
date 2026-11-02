# 从本页听：产品与设计文档

## 1. 产品文档

### 1.1 功能目标

用户在听书过程中离开播放位置继续阅读时，可以放弃当前播放进度，让听书从正在阅读的页面重新开始。

该功能只改变听书起点，不改变阅读页面，不需要后端新增接口。

### 1.2 使用场景

| 场景     | 用户操作                               | 期望结果                                  |
| -------- | -------------------------------------- | ----------------------------------------- |
| 边听边读 | 听书播放到第 5 页，用户手动翻到第 8 页 | 底部显示“原进度 / 从本页听”               |
| 跨章阅读 | 音频仍在第 10 章，用户正在阅读第 11 章 | 从第 11 章当前页开始播放                  |
| 滚屏阅读 | 用户向上或向下滚动，离开当前播放位置   | 从当前可视正文开始播放                    |
| 播放页内 | 用户仍停留在当前播放页                 | 不显示“从本页听”，显示“暂停播放/继续播放” |

### 1.3 入口与展示

| 项目           | 规则                             |
| -------------- | -------------------------------- |
| 展示位置       | 阅读页隐藏工具栏后的底部听书栏   |
| 音频未启动     | 不展示底部听书栏                 |
| 正在加载       | 展示“音频正在加载”，不可重复点击 |
| 当前页正在播放 | 展示“暂停播放/继续播放”          |
| 已离开播放位置 | 展示“原进度 / 从本页听”          |
| 从本页听执行中 | 切换为“音频正在加载”             |

底部听书栏示意：

```text
[原进度] | [从本页听]
```

### 1.4 点击规则

点击“从本页听”后：

1. 以点击瞬间用户正在阅读的页面为准。
2. 定位当前页正文的第一条可读文字。
3. 停止旧音频、旧预下载和旧时间轴。
4. 使用当前章节和当前页正文偏移请求新的听书音频。
5. 音频加载成功后直接播放。
6. 阅读页面不跳转，自动翻页重新开启。

用户点击后不需要二次确认。

### 1.5 “当前页”的定义

| 阅读模式 | 起点定义                               |
| -------- | -------------------------------------- |
| 左右翻页 | 当前页第一条正文行                     |
| 上下翻页 | 当前页第一条正文行                     |
| 滚屏模式 | 当前可视区域内第一条与视口相交的正文行 |

首页包含书名和章节标题时，从标题后的第一条正文开始，不把标题文字作为朗读起点。

### 1.6 状态变化

| 当前状态       | 点击后的状态               |
| -------------- | -------------------------- |
| 离开播放位置   | 音频加载中                 |
| 加载成功       | 当前页播放中，自动跟随开启 |
| 当前页正在播放 | 不展示“从本页听”           |
| 无音频播放     | 不展示入口                 |

“从本页听”成功后，旧播放进度被替换，底部操作切换为“暂停播放/继续播放”。

### 1.7 异常处理

| 情况                     | 处理                                       |
| ------------------------ | ------------------------------------------ |
| 当前页没有可读正文       | 提示“无法定位当前页的朗读位置”             |
| 用户未登录或内容权限失效 | 沿用现有听书鉴权提示                       |
| 音频请求失败             | 停止加载并提示重试                         |
| 连续点击                 | 加载期间隐藏按钮并忽略重复触发             |
| 新音频尚未返回时再次翻页 | 保留点击时的章节与偏移，不随新页面改写请求 |

### 1.8 不在本期范围

- 不允许选择正文中的任意一句话作为听书起点。
- 不从当前页之后保留旧音频。
- 不新增“从本页听”专用后端接口。
- 不在当前播放页展示“从本页听”。

### 1.9 验收标准

- 三种阅读模式下都能取得当前可视正文的起点。
- 点击后播放章节与当前阅读章节一致。
- 点击后阅读页不发生跳转。
- 播放开始后高亮、自动翻页恢复跟随。
- 点击加载期间不会产生重复音频请求。
- 旧音频、旧时间轴和旧预下载不会被继续使用。

## 2. 设计文档

### 2.1 总体调用链

```text
ReaderImmersiveListenBar
  → emit("fromCurrent")
  → reader.listenFromCurrentPage()
  → 解析当前阅读位置
  → audiobook.start(AudiobookStartOptions)
  → POST /api/tts/chapter
  → 播放首个音频段
  → 自动跟随重新开启
```

后端继续使用现有 `/api/tts/chapter`，无需修改。

### 2.2 前端职责

| 模块                       | 职责                                   |
| -------------------------- | -------------------------------------- |
| `ReaderImmersiveListenBar` | 展示底部入口，派发 `fromCurrent` 事件  |
| `reader.vue`               | 获取当前阅读位置，组装听书启动参数     |
| `useReaderEngine`          | 提供分页与滚动位置到正文偏移的转换能力 |
| `useAudiobook`             | 取消旧播放并启动新的 TTS 计划          |

### 2.3 UI 组件接口

```ts
interface ReaderImmersiveListenBarProps {
  showOriginalProgress: boolean
  isOnPlaybackPage: boolean
  playing: boolean
  loading: boolean
}

interface ReaderImmersiveListenBarEmits {
  locateOriginal: []
  fromCurrent: []
  togglePlay: []
}
```

底部听书栏按以下顺序渲染：

```text
loading
  → 音频正在加载

isOnPlaybackPage
  → 暂停播放 / 继续播放

否则
  → 原进度 | 从本页听
```

### 2.4 阅读位置解析

分页模式直接使用 `currentPageIndex` 的第一条 `line`：

```ts
const page = readerPages[currentPageIndex]
const startLine = page.lines[0]
const absoluteOffset = getReaderLineAbsoluteOffset(chapterParagraphs, startLine)
```

滚屏模式不能直接使用 `currentPageIndex` 的第一行，因为分页索引只是根据滚动比例估算的。需要按 `scrollReaderTop` 找到当前可视区域内第一条完整正文行，再把该行转换为绝对偏移。

统一输出：

```ts
interface AudiobookStartOptions {
  chapterUrl: string
  catalogUrl: string
  bookTitle: string
  title: string
  coverUrl: string
  absoluteStartOffset: number
}
```

### 2.5 启动流程

```text
捕获章节、页码、滚动位置和正文偏移
→ audiobook.start(options)
→ resetPlaybackState()
→ 中止旧请求与预下载
→ 清空旧 timeline
→ 请求 /api/tts/chapter
→ 获取 segments 与 timeline
→ 下载并播放第一个音频段
→ 恢复高亮和自动跟随
```

### 2.6 并发与状态安全

| 风险               | 设计处理                                |
| ------------------ | --------------------------------------- |
| 用户重复点击       | 加载期间隐藏入口并忽略重复操作          |
| 旧请求晚返回       | 使用现有 `requestId` 校验，丢弃过期响应 |
| 旧音频段晚下载     | 使用 `queueGeneration` 丢弃旧预下载     |
| 用户加载中再次翻页 | 请求参数使用点击时快照，不重新读取页面  |
| 旧自动翻页状态残留 | 启动前清空旧播放位置，成功后重新建立    |

### 2.7 与“原进度”的关系

| 操作           | 结果                               |
| -------------- | ---------------------------------- |
| 点击“原进度”   | 保留当前播放位置，把正文定位过去   |
| 点击“从本页听” | 保留当前阅读位置，把音频起点换过来 |

两个操作方向相反，不能复用同一个定位方法。

### 2.8 与自动翻页的关系

- 点击“从本页听”前，自动跟随处于关闭状态。
- 新音频成功后，以当前页为新起点重新开启自动跟随。
- 新音频第一条 timeline 必须映射到当前页。
- 如果 timeline 延迟到达，页面保持不动，收到有效时间轴后再继续自动翻页。

### 2.9 不做无效分支

- 不新增后端请求参数。
- 不复制现有分页算法。
- 不根据播放时间反推当前页。
- 不在组件内部直接操作播放器。
- 不为左右、上下、滚屏各写一套启动流程，只在位置解析阶段区分模式。

## 3. 落地实现细节

### 3.1 涉及文件

| 文件                                                 | 改动                                       |
| ---------------------------------------------------- | ------------------------------------------ |
| `src/components/reader/ReaderImmersiveListenBar.vue` | 增加 `fromCurrent` 事件和“从本页听”按钮    |
| `src/pages/reader/reader.vue`                        | 增加点击处理、当前朗读起点解析和状态恢复   |
| `src/composables/useReaderEngine.ts`                 | 增加滚屏模式下可视行定位能力               |
| `src/composables/useAudiobook.ts`                    | 直接复用现有 `start()`，不增加新的播放接口 |
| `src/utils/reader-position.ts`                       | 复用现有绝对偏移到阅读位置映射             |

后端、TTS 服务和 `/api/tts/chapter` 均不修改。

### 3.2 底部按钮实现

`ReaderImmersiveListenBar` 增加事件：

```ts
const emit = defineEmits<{
  locateOriginal: []
  fromCurrent: []
  togglePlay: []
}>()
```

仅在离开播放位置的按钮组中渲染：

```vue
<button class="listen-bar-action" @tap="emit('locateOriginal')">
  <view class="listen-bar-icon locate-icon">
    <text>⌖</text>
  </view>
  <text class="listen-bar-label">原进度</text>
</button>

<view class="listen-bar-divider" />

<button class="listen-bar-action" @tap="emit('fromCurrent')">
  <view class="listen-bar-icon">
    <view class="headphone-icon">
      <view class="headphone-band" />
      <view class="headphone-ear left" />
      <view class="headphone-ear right" />
    </view>
  </view>
  <text class="listen-bar-label">从本页听</text>
</button>
```

加载期间继续保持现有行为，只显示“音频正在加载”，不渲染“从本页听”。

### 3.3 当前朗读起点结构

在 `reader.vue` 内统一转换成：

```ts
interface ReaderListeningStart {
  chapterUrl: string
  pageIndex: number
  absoluteOffset: number
}
```

页码只在阅读器内部用于竞态判断，不需要传给后端。

### 3.4 分页模式起点

左右和上下模式共用一条路径：

```ts
const page = readerPages.value[currentPageIndex.value]
const line = page?.lines[0]
if (!chapter.value || !line) {
  return undefined
}

return {
  chapterUrl: chapter.value.chapterUrl,
  pageIndex: currentPageIndex.value,
  absoluteOffset: getReaderLineAbsoluteOffset(chapterParagraphs.value, line)
}
```

书名和章节标题由阅读组件单独渲染，不在 `lines` 中，所以这里天然会从第一条正文开始。

### 3.5 滚屏模式起点

`useReaderEngine` 增加一个只负责几何计算的方法：

```ts
function getVisibleScrollLine(scrollTop: number) {
  let lineTop = scrollShowHeading.value ? headingHeightPx.value : 0

  for (const line of scrollLines.value) {
    const lineHeight = lineHeightPx.value + (line.paragraphEnd ? paragraphGapPx.value : 0)
    const lineBottom = lineTop + lineHeight
    if (lineBottom > scrollTop) {
      return line
    }
    lineTop = lineBottom
  }

  return undefined
}
```

选择“第一条与可视区域相交的正文行”：

- 不要求整行完全可见。
- 从该行的行首开始朗读，避免从半个词开始。
- 行上方部分不可见时，最多从当前可视行开头补读，不从下一行漏字。

然后把该行转换为正文绝对偏移。

### 3.6 点击处理

```ts
function listenFromCurrentPage() {
  const start = getCurrentListeningStart()
  if (!chapter.value || !start) {
    uni.showToast({
      title: '无法定位当前页的朗读位置',
      icon: 'none'
    })
    return false
  }

  const options: AudiobookStartOptions = {
    chapterUrl: start.chapterUrl,
    catalogUrl: effectiveCatalogUrl.value,
    bookTitle: bookTitle.value,
    title: chapter.value.title,
    coverUrl: bookCoverUrl.value,
    absoluteStartOffset: start.absoluteOffset
  }

  audiobookPlaybackPosition.value = undefined
  audiobookAutoFollowEnabled.value = false
  pendingAudiobookStart.value = {
    chapterUrl: start.chapterUrl,
    pageIndex: start.pageIndex
  }
  void audiobook.start(options)
  return true
}
```

以下几点不能省：

- 必须先取得位置快照，再调用 `audiobook.start()`。
- 请求发出后不再读取当前页，避免用户翻页改变请求目标。
- 启动前清空旧播放位置，防止旧 timeline 把页面拉回旧进度。
- 启动时暂时关闭自动跟随，等第一条新 timeline 确认位置后再恢复。

### 3.7 自动跟随恢复

新增一个短暂的启动快照：

```ts
interface PendingAudiobookStart {
  chapterUrl: string
  pageIndex: number
}

const pendingAudiobookStart = ref<PendingAudiobookStart>()
```

恢复规则：

| 条件                                   | 结果                     |
| -------------------------------------- | ------------------------ |
| 新 timeline 到达，章节和页仍与快照一致 | 开启自动跟随             |
| 用户加载期间翻到其他页                 | 保持自动跟随关闭         |
| 用户加载期间切换章节                   | 保持自动跟随关闭         |
| 用户点击“原进度”                       | 清除待处理快照           |
| 启动失败                               | 清除待处理快照和播放位置 |

不能直接用“新 timeline 已经到达”作为恢复条件，因为用户在加载期间可能已经看了别的内容。

### 3.8 与 `useAudiobook.start()` 的衔接

现有 `start(options)` 已经完成：

- `resetPlaybackState()`
- 中止旧 TTS 请求
- 中止下一文本计划请求
- 销毁旧音频上下文
- 删除旧预下载文件
- 清空旧 timeline
- 按新偏移请求 `/api/tts/chapter`
- 下载并播放首个音频段

因此“从本页听”只负责传入新的 `AudiobookStartOptions`，不再另写一套 TTS 请求或音频下载逻辑。

同章节内优先复用已经下载的音频：

```text
当前章节相同
→ 当前 timeline 包含当前页起点
→ 起点所在音频段已下载，或对应的预下载任务仍在进行
→ 切换该音频段并 seek 到对应时间
```

只有以下任一条件不满足时，才调用 `start(options)` 重新加载：

- 当前页不属于当前 TTS 播放计划。
- timeline 没有覆盖当前页起点。
- 目标音频段下载失败。
- 已切换到其他章节。

预下载尚未完成时会复用同一个下载任务并等待，不重复发起下载。下载期间继续播放原音频，目标段准备完成后切换到本页进度；这样可以避免用户在本章已下载或正在预下载的范围内来回翻页时重复请求 TTS。

### 3.9 请求竞态

现有两代标识必须继续使用：

| 标识              | 作用                                   |
| ----------------- | -------------------------------------- |
| `requestId`       | 丢弃已经过期的 `/api/tts/chapter` 响应 |
| `queueGeneration` | 丢弃旧文本计划和旧音频段下载           |

点击“从本页听”后，旧播放响应即使晚到，也不能重新设置 `timeline`、恢复旧音频或触发自动翻页。

### 3.10 错误处理

| 失败节点               | 前端处理                          |
| ---------------------- | --------------------------------- |
| 找不到当前正文行       | Toast：“无法定位当前页的朗读位置” |
| 新 TTS 请求失败        | Toast：使用接口错误信息           |
| 首个音频段下载失败     | 继续使用现有错误提示和重试入口    |
| 用户加载期间关闭播放器 | 请求失效，不恢复自动跟随          |

### 3.11 推荐实施顺序

1. 在 `ReaderImmersiveListenBar` 恢复“从本页听”按钮和事件。
2. 在 `useReaderEngine` 增加滚屏可视行定位。
3. 在 `reader.vue` 增加统一的当前朗读起点解析。
4. 接入 `listenFromCurrentPage()` 和启动快照。
5. 验证分页、滚屏、跨章节、连续点击和失败重试。

### 3.12 验收用例

| 用例                         | 预期                                 |
| ---------------------------- | ------------------------------------ |
| 第 5 页播放，翻到第 8 页点击 | 从第 8 页第一行开始播放              |
| 第 10 章播放，在第 11 章点击 | 从第 11 章当前页开始播放             |
| 滚屏到段落中间点击           | 从当前可视的第一条正文行开始播放     |
| 加载中连续点击               | 只产生一次新的 TTS 请求              |
| 加载中继续翻页               | 新音频开始后不强制拉回启动快照页     |
| 点击“原进度”                 | 正文回到音频位置，而不是改变音频起点 |
