# 西瓜啃书

代码检查与构建：

```powershell
npm run lint
npm run format:check
npm run check
npm run build:mp-weixin
```

基于 uni-app、Vue 3、TypeScript 和 Vite 的微信小程序项目。

账号注册后默认没有访问权限，需要在管理后台由管理员开通。

## 启动

```powershell
npm install
npm run dev:mp-weixin
```

编译结果位于 `dist/dev/mp-weixin`，使用微信开发者工具导入该目录。

## 页面

| 页面     | 路径                    |
| -------- | ----------------------- |
| 搜索首页 | `pages/index/index`     |
| 搜索结果 | `pages/search/search`   |
| 章节目录 | `pages/catalog/catalog` |
| 小说阅读 | `pages/reader/reader`   |
| 历史记录 | `pages/history/history` |
| 登录注册 | `pages/login/login`     |
| 我的账号 | `pages/profile/profile` |
