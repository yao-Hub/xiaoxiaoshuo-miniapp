# 小小小说

基于 uni-app、Vue 3、TypeScript 和 Vite 的微信小程序项目。

## 启动

```powershell
npm install
npm run dev:mp-weixin
```

编译结果位于 `dist/dev/mp-weixin`，使用微信开发者工具导入该目录。

H5 预览：

```powershell
npm run dev:h5
```

## 页面

| 页面 | 路径 |
|---|---|
| 搜索首页 | `pages/index/index` |
| 搜索结果 | `pages/search/search` |
| 章节目录 | `pages/catalog/catalog` |
| 小说阅读 | `pages/reader/reader` |
| 历史记录 | `pages/history/history` |

## 后端接入

项目已通过 `.env.local` 连接本地 Node.js 后端。接口地址：

```text
VITE_API_BASE_URL=http://127.0.0.1:3000
```

后端项目位于 `D:\project\xiaoxiaoshuo-server`。

生产构建读取 `.env.production`：

```text
VITE_API_BASE_URL=https://xiaoxiaoshuo.top
```

服务层位于 `src/services/novel.ts`，当前约定接口：

| 接口 | 参数 | 用途 |
|---|---|---|
| `GET /api/search` | `q` | 搜索书名 |
| `GET /api/catalog` | `id` | 获取书籍和目录 |
| `GET /api/chapter` | `id`、`chapterId` | 获取章节正文 |

微信小程序正式发布前，需要在微信公众平台配置后端域名，并保证 HTTPS、备案和合法域名校验通过。
