# 析梦 Dream Anatomy

**析梦 Dream Anatomy** 是一个中文梦境自我探索工具。它帮助用户记录梦境，并用温和的荣格心理学视角整理梦中的象征、情绪和内在主题。

这个项目目前是一个简单的落地页，使用 plain HTML、CSS 和 JavaScript 编写。初学者可以直接在浏览器里打开页面，不需要安装额外工具。

## What the App Does

页面的 PRD 风格定位是：**你的梦境自我探索工具**。

它包含：

- 中文首页，介绍梦境记录和自我探索的核心想法。
- 梦中象征提示，用户可以输入一个象征，例如 `森林`、`水` 或 `门`。
- 梦日记区域，用户可以写下一段梦境。
- 温柔的荣格式反思按钮，帮助用户继续观察梦里的情绪、象征和自我成长线索。

这个应用不是诊断工具、治疗服务、算命工具，也不会预测未来。它只用于梦境记录和温和的自我探索。当前版本不会发送数据，所有内容都在本地浏览器运行。

## Project Structure

```text
.
├── AGENTS.md
├── README.md
├── assets/
├── docs/
├── src/
│   ├── app.js
│   ├── index.html
│   └── style.css
└── tests/
```

- `src/index.html`: page content and structure.
- `src/style.css`: colors, layout, spacing, and responsive styles.
- `src/app.js`: small interactions for the symbol prompt and diary reflection.
- `AGENTS.md`: contributor guidelines for this repository.

## How to Open the App

No setup is required.

1. Open the project folder on your computer.
2. Open the `src` folder.
3. Double-click `index.html`.
4. Your browser should show the 析梦 Dream Anatomy landing page.

You can also drag `src/index.html` into a browser window.

## Editing the App

To change the text on the page, edit `src/index.html`. To change colors or layout, edit `src/style.css`. To change the button behavior or reflection messages, edit `src/app.js`.

## Contributing

Before making larger changes, read [AGENTS.md](AGENTS.md). Keep updates small, clear, and easy for a beginner to understand.
