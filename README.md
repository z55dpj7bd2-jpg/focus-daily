# 专注日课 · 每日三练

一个**每天自动换方案**的专注力训练网页应用。纯前端静态站点，部署到 Cloudflare 后，iPhone 用 Safari 打开链接即可使用，可「添加到主屏幕」当 App 用，断网也能练。

## 每天练什么

| 项目 | 固定 / 轮换 | 说明 |
| --- | --- | --- |
| 舒尔特方格 | 每天都有 | 4×4 / 5×5 / 6×6 按日期轮换，中心注视点，计时 + 错误数 |
| 追踪小球 | 每天都有 | 「平滑眼动追踪（45/60/75 秒）」与「多目标追踪（4/5 球 × 3 轮）」隔天交替 |
| 第三项 | 4 天一轮 | 色词干扰 → 数字反序 → 闪点记忆 → 节拍专注，参数（时长、位数、BPM）随日期变化 |

所有参数由日期做种子生成：同一天在任何设备上都是同一套方案，第二天自动变。不需要服务器、不需要定时任务 —— 换日逻辑在本地完成，所以比 Workers + KV + Cron 更省，也不会因为 Cron 延迟而「今天还显示昨天的内容」。

## 文件结构

```
index.html              页面骨架（含 iPhone/PWA meta）
assets/app.css          样式（深色、移动端优先、安全区适配）
assets/app.js           全部训练逻辑 + 本地数据 + 日历统计
assets/icon-*.png       主屏图标（180 / 512 / 1024）
manifest.webmanifest    PWA 清单
sw.js                   Service Worker，离线缓存
wrangler.toml           Cloudflare Workers 部署配置
.assetsignore           部署时忽略的文件
tools/make_icons.py     图标生成脚本（无依赖）
tools/shot.mjs          本地预览 + 真机尺寸截图自测脚本
```

## 本地先看一眼

直接双击 `index.html` 就能打开。或用 Node 起个本地服务（推荐，行为跟线上一致）：

```powershell
cd <本目录>
node tools\serve.mjs     # 起本地服务，会打印局域网地址，iPhone 同一 WiFi 下可直接打开试
node tools\shot.mjs      # 真机尺寸自动截图自测，输出到 tools/shots/
```

> 提示：`?dev=1&d=2026-11-16` 可以预览指定日期的训练方案（自测用）。

## 部署（两种，都免费）

见 `DEPLOY.md`。最省事的是 Cloudflare Pages 上传 zip，不需要命令行。

## iPhone 上怎么用

1. Safari 打开部署后的 `https://xxx.workers.dev` 或 `https://xxx.pages.dev` 链接；
2. 点「分享」→「添加到主屏幕」；
3. 从主屏图标进入，全屏无地址栏，和原生 App 体验一致；
4. 断网也能打开（首次加载后已缓存）。

数据（成绩、打卡、连续天数）全部保存在本机浏览器 localStorage，不上传服务器，换手机不会同步。

## 想加自己的训练项

在 `assets/app.js` 里：

1. 写一个 `TrainXxx(st, cfg)` 函数，返回清理函数（清定时器 / 关音效），结束时调 `showResult(...)`；
2. 把 id 加进 `THIRD_IDS` 数组（4 天一轮会自动纳入）；
3. 在 `THIRD_INFO` 里补名称与图标，在 `thirdDesc(plan)` 与 `render()` 的分发里各加一个分支。

参数想「每天不同」，用 `rngFrom(hash32(dateStr + '|xxx'))` 取随机数，同一日期永远一致。
