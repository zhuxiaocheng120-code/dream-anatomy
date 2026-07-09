# 析梦 Dream Anatomy

**析梦 Dream Anatomy** 是一个中文梦境自我探索工具。它帮助用户记录梦境，并用温和的荣格心理学视角整理梦中的象征、情绪和内在主题。

这个项目目前是一个简单的 MVP 首页雏形，使用 plain HTML、CSS 和 JavaScript 编写。初学者可以直接在浏览器里打开页面，不需要安装额外工具。

## What the App Does

页面的 PRD 风格定位是：**你的梦境自我探索工具**。

它包含：

- 中文首页，介绍梦境记录和自我探索的核心想法。
- 三个明确入口：快速解析、深度引导、梦境日记。
- 基础区域切换，点击入口后可以查看对应占位区域。
- 快速解析区域可以输入梦境碎片，并生成一份本地 mock 的结构化快速解析结果。
- 快速解析结果会保存到浏览器本地梦境日记，并在梦境日记区域显示摘要列表。
- 深度引导区域可以输入梦境，并在本地生成 5 个温和短问题，帮助补充情绪、联想、现实连接、梦中主动性和醒后感受。
- 深度引导回答只在当前页面临时暂存，可以回答部分或全部问题，并生成一份本地 mock 的 Dream Anatomy Report。
- 深度报告包含梦境整理、情绪线索、核心意象、荣格式初步解读、现实连接、自我反思问题、今日小行动和温和提醒，并可保存到本地梦境日记。
- 梦境日记区域会在同一个列表中显示快速解析和深度引导记录。

这个应用不是诊断工具、治疗服务、算命工具，也不会预测未来。它只用于梦境记录和温和的自我探索。当前版本不会发送数据，快速解析结果也只是本地 mock，梦境记录只保存在当前浏览器里。

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
- src/index.html: page content and structure.
- src/style.css: colors, layout, spacing, and responsive styles.
- src/app.js: small interactions for switching between the three MVP entry areas.
- AGENTS.md: contributor guidelines for this repository.
- How to Open the App
- No setup is required.
- Open the project folder on your computer.
- Open the src folder.
- Double-click index.html.
- Your browser should show the 析梦 Dream Anatomy landing page.
- You can also drag src/index.html into a browser window.
- Editing the App
- To change the text on the page, edit src/index.html. To change colors or layout, edit src/style.css. To change the button behavior of reflection messages, edit src/app.js.
- Contributing
- Before making larger changes, read [AGENTS.md](AGENTS.md). Keep updates small, clear, and easy for a beginner to understand.
