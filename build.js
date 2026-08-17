#!/usr/bin/env node
/**
 * blog 静态生成器
 * 用法: node build.js
 * 输出: dist/ 目录（整体推到 GitHub Pages）
 */
const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const matter = require('gray-matter');

// ---------- 配置 ----------
const ROOT = __dirname;
const CONTENT_DIR = path.join(ROOT, 'content');
const TEMPLATE_DIR = path.join(ROOT, 'templates');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST_DIR = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

// ---------- 工具函数 ----------
function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
}

function fill(template, data) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) =>
    data[key] !== undefined ? data[key] : m
  );
}

function slugify(filename) {
  return filename.replace(/\.md$/, '').trim();
}

function formatDate(d) {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toRFC822(d) {
  return new Date(d).toUTCString();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

// ---------- 读取并解析文章 ----------
function loadPosts() {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  const posts = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { data, content } = matter(raw);

    if (data.draft) continue; // 草稿不发布

    const slug = data.slug || slugify(file);
    posts.push({
      slug,
      title: data.title || slug,
      date: data.date || '1970-01-01',
      tags: Array.isArray(data.tags) ? data.tags : [],
      description: data.description || '',
      content,
    });
  }

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

// ---------- 生成页面 ----------
function cardHTML(p, urlPrefix) {
  return fill(readTemplate('card.html'), {
    title: p.title,
    date: formatDate(p.date),
    description: p.description || '',
    tags: p.tags.map((t) => `<a class="tag" href="${urlPrefix}tags/${encodeURIComponent(t)}/">#${t}</a>`).join(' '),
    url: `${urlPrefix}posts/${p.slug}.html`,
  });
}

function buildIndex(posts, layoutTemplate) {
  const items = posts.map((p) => cardHTML(p, '')).join('\n');
  const tags = collectTags(posts);
  return fill(layoutTemplate, {
    root: '',
    siteTitle: config.siteTitle,
    siteDescription: config.siteDescription,
    pageTitle: '首页',
    content: fill(readTemplate('index.html'), { posts: items, tags: renderTagCloud(tags, '') }),
  });
}

function buildPostPage(post, layoutTemplate) {
  const body = md.render(post.content);
  const tags = post.tags
    .map((t) => `<a class="tag" href="../tags/${encodeURIComponent(t)}/">#${t}</a>`)
    .join(' ');

  return fill(layoutTemplate, {
    root: '../',
    siteTitle: config.siteTitle,
    siteDescription: config.siteDescription,
    pageTitle: post.title,
    content: fill(readTemplate('post.html'), {
      title: post.title,
      date: formatDate(post.date),
      tags,
      body,
    }),
  });
}

function collectTags(posts) {
  const map = {};
  for (const p of posts) {
    for (const t of p.tags) {
      map[t] = (map[t] || 0) + 1;
    }
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function renderTagCloud(tags, urlPrefix) {
  if (tags.length === 0) return '<p>暂无标签</p>';
  return tags
    .map(([name, count]) => `<a class="tag" href="${urlPrefix}tags/${encodeURIComponent(name)}/">#${name} (${count})</a>`)
    .join(' ');
}

function buildTagPages(posts, layoutTemplate) {
  const tagTemplate = readTemplate('tag.html');
  const tagMap = {};
  for (const p of posts) {
    for (const t of p.tags) {
      (tagMap[t] = tagMap[t] || []).push(p);
    }
  }

  const tagNames = Object.keys(tagMap).sort();

  // 标签总览页 tags/index.html
  const overview = fill(layoutTemplate, {
    root: '../',
    siteTitle: config.siteTitle,
    siteDescription: config.siteDescription,
    pageTitle: '标签',
    content: fill(tagTemplate, {
      tag: '全部标签',
      posts: tagNames.map((n) => `<a class="tag" href="${encodeURIComponent(n)}/">#${n} (${tagMap[n].length})</a>`).join(' '),
    }),
  });
  ensureDir(path.join(DIST_DIR, 'tags'));
  fs.writeFileSync(path.join(DIST_DIR, 'tags', 'index.html'), overview);

  for (const [name, list] of Object.entries(tagMap)) {
    const items = list.map((p) => cardHTML(p, '../../')).join('\n');

    const html = fill(layoutTemplate, {
      root: '../../',
      siteTitle: config.siteTitle,
      siteDescription: config.siteDescription,
      pageTitle: `标签: ${name}`,
      content: fill(tagTemplate, { tag: name, posts: items }),
    });

    const dir = path.join(DIST_DIR, 'tags', name);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), html);
  }
}

function buildRSS(posts) {
  const items = posts
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${config.baseUrl}posts/${p.slug}.html</link>
      <pubDate>${toRFC822(p.date)}</pubDate>
      <guid>${config.baseUrl}posts/${p.slug}.html</guid>
      <description>${escapeXml(p.description || '')}</description>
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(config.siteTitle)}</title>
    <link>${config.baseUrl}</link>
    <description>${escapeXml(config.siteDescription)}</description>
    <lastBuildDate>${toRFC822(new Date())}</lastBuildDate>
    ${items}
  </channel>
</rss>
`;
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------- 主流程 ----------
function main() {
  // 清空 dist
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  ensureDir(DIST_DIR);

  const posts = loadPosts();
  if (posts.length === 0) {
    console.warn('[warn] content 目录下没有文章');
  }

  const layout = readTemplate('layout.html');

  // 首页
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), buildIndex(posts, layout));

  // 文章页
  ensureDir(path.join(DIST_DIR, 'posts'));
  for (const p of posts) {
    fs.writeFileSync(path.join(DIST_DIR, 'posts', `${p.slug}.html`), buildPostPage(p, layout));
  }

  // 标签页
  buildTagPages(posts, layout);

  // RSS
  fs.writeFileSync(path.join(DIST_DIR, 'rss.xml'), buildRSS(posts));

  // 静态资源
  fs.cpSync(PUBLIC_DIR, DIST_DIR, { recursive: true });

  console.log(`✅ 构建完成: ${posts.length} 篇文章, ${collectTags(posts).length} 个标签`);
  console.log(`   输出目录: ${DIST_DIR}`);
}

main();
