# Dream Anatomy Brand Assets

本目录说明 Web Beta 使用的品牌资产边界。

## 资产清单

- `src/assets/brand/dream-guide-mark.svg`：Icon Logo，云朵里的梦境向导。
- `src/assets/brand/dream-anatomy-lockup.svg`：Horizontal Lockup，图形加“析梦 Dream Anatomy”。
- `src/assets/brand/dream-guide-monochrome.svg`：Monochrome Variant，适合单色或印刷式场景。

这些文件是 **Dream Anatomy Beta 的原创品牌标识 v1**。它们使用本项目现有的 parchment、warm charcoal、muted olive、dusty sage 和 sepia 视觉语言，不使用外部图片、字体文件、脚本或第三方商标。

## 原创与品牌边界

这个标识的概念是“云朵里的梦境向导”。它不复制 Claude、Anthropic、HEMISPHERIC、荣格历史画作、塔罗或其他第三方品牌资产。

正式商标使用前仍应完成相似标识检索和必要法律审查。当前文件只代表 Web Beta 的原创视觉方向，不表示已注册商标或已完成法律审查。

## 动效与可访问性

Web 端 Logo 和页面使用克制的 CSS 微动画，主要通过 `transform` 和 `opacity` 实现。系统设置 `prefers-reduced-motion: reduce` 时，会关闭循环浮动、眨眼、进入动画和进度条揭示动画，只保留必要的即时状态反馈。

装饰性 Logo 图片使用空 `alt`，品牌按钮本身保留可访问名称和键盘 focus。

## 小程序后续复用

未来如果微信小程序需要平台头像或启动图，可以从 `src/assets/brand/` 的 SVG 源文件导出 PNG。当前版本只保存源 SVG 和 Web 引用，不代表已经上传或配置微信公众平台后台图标。
