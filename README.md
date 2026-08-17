# Rai's Notes — 自研静态博客生成器

个人博客：技术笔记 / 生活随笔 / 作品集。

**线上地址**: https://raicco-raydd.github.io/blog/

## 技术栈

- Node.js 静态生成器（自研，`build.js`）
- `markdown-it` — Markdown → HTML 渲染
- `gray-matter` — frontmatter 解析
- GitHub Actions 自动构建 → GitHub Pages

## 目录结构

```
blog/
├── build.js          # 生成器（扫描/渲染/构建）
├── config.json       # 站点配置（标题/描述/作者/baseUrl）
├── content/          # 📝 文章目录（.md 文件，写这里）
├── templates/        # 页面模板（layout/card/index/post/tag）
├── public/           # 静态资源（style.css 等）
├── dist/             # 构建输出（gitignore，由 Actions 部署）
└── .github/workflows/pages.yml  # 自动部署流水线
```

## 写文章（3 步）

1. 在 `content/` 新建 `.md` 文件：

```markdown
---
title: "文章标题"
date: "2026-08-17"
tags: ["标签1", "标签2"]
description: "列表页显示的一句话摘要"
---

正文内容（Markdown）...
```

2. 本地预览：

```bash
node build.js        # 构建到 dist/
cd dist && npx serve # 或任意静态服务器
```

3. 发布：`git add -A && git commit && git push`
   → GitHub Actions 自动构建部署，约 1-2 分钟上线

## 常用配置（config.json）

| 字段 | 说明 |
|------|------|
| siteTitle | 站点标题 |
| siteDescription | 站点描述 |
| author | 作者名 |
| baseUrl | 站点绝对地址（RSS 用） |

## 草稿机制

frontmatter 加 `draft: true` 的文章不会出现在构建产物中。
