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

## 静态品牌标识与可访问性

Web 端页面中的可见 Logo 使用同源 inline SVG 渲染，云朵轮廓保持完全静态。`src/assets/brand/` 中的 SVG 文件继续作为 favicon、源资产和导出基础保留。

当前品牌标识不包含云朵线条变形、描边流动、透明度交替、上下漂浮、缩放、呼吸或旋转等持续动画。Logo 只保留 `.archive-cloud-outline` 这一条静态云朵轮廓和必要的内部细节，避免干扰阅读和产品定位。

装饰性 inline Logo 使用 `aria-hidden="true"` 和 `focusable="false"`，品牌按钮本身保留可访问名称和键盘 focus。

## 小程序后续复用

未来如果微信小程序需要平台头像或启动图，可以从 `src/assets/brand/` 的 SVG 源文件导出 PNG。当前小程序端通过原生 `<image>` 使用 `miniprogram/assets/brand/mini-cloud-outline-base.svg` 这一份本地静态云朵资源，并用 WXML/WXSS 的 `archive-cloud-mark`、`mini-cloud-outline-base` 复用同一套静态品牌语义；不依赖远程图片或字体，也不代表已经上传或配置微信公众平台后台图标。
