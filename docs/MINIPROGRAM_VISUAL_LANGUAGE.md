# 微信小程序视觉语言

## 目标

微信小程序沿用 Web 端已经确定的 Dream Anatomy 视觉语言：旧纸、私人档案、心理工作室、手稿记录和温和的梦境自我探索。首页是最完整的视觉锚点，其他页面使用克制的页面级点缀。

## 配色 Tokens

当前版本在 `miniprogram/app.wxss` 中以共享样式维护视觉 tokens：

- parchment / warm ivory：`#f1eadc`、`#fff7e8`、`#fffdf6`
- warm charcoal：`#302a23`
- sepia / muted brown：`#8a6f52`、`#7b624b`、`#6d6358`
- muted olive / dusty sage：`#5f6549`、`#9fa58b`
- danger：低饱和红棕，用于删除和清空等不可恢复操作

错误、成功、禁用和危险操作不只依赖颜色，也通过边框、左侧提示线、按钮状态和确认弹窗文案区分。

## 字体与层级

- 标题优先使用系统可用中文衬线 fallback，如 `Songti SC` 和 CJK serif。
- 正文继续使用系统无衬线字体，保证微信端中文阅读清晰。
- `.eyebrow`、`.title`、`.subtitle`、`.microcopy`、`.section-title`、`.small` 共同构成页面标题、说明、注释和标签层级。
- 不提交字体文件，不依赖远程字体。

## 页面设计规则

- 首页：品牌主视觉、主要入口、最近梦境和反思微文案。
- AI 整理梦境：梦境记录工作台和手稿输入区。
- 结果页：心理档案报告感，区分文字整理、梦境线索卡和保存操作。
- 梦境日记：私人梦境档案和索引卡列表。
- 记录详情：手稿记录与 AI 辅助整理报告结合，长文本可换行。
- 隐私与数据：档案文书感，优先保证法律文本和危险操作可读。
- 我的：本机游客档案和印章感，不展示假的头像、昵称或登录状态。

## 原创装饰资产清单

本轮不依赖远程图片，也不下载版权不明素材。所有装饰均由 WXML/WXSS 原创绘制：

- `mini-cloud-outline-mark`：云朵轮廓图层容器，用于首页主视觉和“我的”身份视觉。
- `corner-lines`：手稿角线，用于 AI 整理梦境和记录详情。
- `archive-rail`：档案索引线，用于结果页、梦境日记和隐私页。
- `identity-seal`：游客身份印章，用于“我的”页面。
- `empty-mark`：空状态圆形标记，用于首页和梦境日记空状态。
- `archive-cloud-mark` / `mini-cloud-outline-base` / `mini-cloud-outline-flow`：静态云朵基础轮廓和同路径动态粗线帧叠层，不承载信息。
- `miniprogram/assets/brand/mini-cloud-outline-*.svg`：本地原创 SVG 图层资产。基础图层完整显示云朵轮廓；动态帧使用同一条云朵 path，只改变 `stroke-dashoffset`，由 WXSS 控制帧透明度轮播。

这些点缀都应保持 `aria-hidden="true"`，不承载信息，不拦截点击，不复制 HEMISPHERIC 品牌、荣格历史画作或其他第三方作品。

## 云朵与线条动效

小程序端不在 WXML 中直接使用 raw `<svg>` 或 `<path>`，而是通过原生 `<image>` 叠放本地 SVG 图层。`@keyframes miniCloudOutlineFlow` 只轮播 `.mini-cloud-outline-flow` 帧的透明度；每一帧都使用同一条云朵 path，并预设不同 `stroke-dashoffset`，从而形成较粗棕褐色描边沿外轮廓移动的效果。云朵本身不漂浮、不缩放，静态 `.mini-cloud-outline-base` 始终完整可见。动效只使用 WXSS，不使用 JS animation loop、不依赖远程图片或字体。微信运行环境如果不支持 SVG 图像或该动画属性，会自然降级为静态云朵轮廓，不影响记录、整理、保存、导出或身份功能。

## 未来复用

后续新增小程序页面时，优先复用：

- `.page-hero`
- `.archive-panel`
- `.manuscript-panel`
- `.archive-cloud-mark`
- `.mini-cloud-outline-mark`
- `.mini-cloud-outline-base`
- `.mini-cloud-outline-flow`
- `.mini-cloud-detail`
- `.archive-rail`
- `.corner-lines`
- `.identity-seal`
- `.card`
- `.button`
- `.danger-button`
- `.long-text-safe`

页面级 WXSS 只保留必要布局，不复制整套颜色和卡片样式。

## 手动验收清单

发布前需要使用微信开发者工具导入 `miniprogram/` 并检查：

1. 首页、AI 整理梦境、结果页、梦境日记、记录详情、隐私与数据、我的页面都能打开。
2. 小屏幕模拟器下无横向溢出。
3. 输入长梦境时 AI 整理页面仍可操作。
4. 长 AI 结果、梦境线索卡和导出 JSON 不破坏布局。
5. 删除和清空确认弹窗仍清楚可辨。
6. 深度记录仍显示“正在开发中”，不能触发 API。
7. 游客请求仍不发送 Authorization。
8. 首页云朵和“我的”身份印章有沿外轮廓移动的粗线动效；云朵整体位置固定，低性能或不支持动画时保持静态可读。
9. 真机触摸区域、滚动和安全区正常。

当前自动化测试覆盖静态边界和服务逻辑；本仓库环境尚未完成真机验收。上线前需要在微信开发者工具和真机上补充视觉截图与交互验证。
