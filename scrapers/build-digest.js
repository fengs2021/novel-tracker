#!/usr/bin/env node
/**
 * 抓取结果 HTML 摘要生成器
 * - 读四平台 latest.json / summary.json + analysis.json
 * - 生成自包含 HTML(内联 CSS,无外部依赖)
 * - 写到 data/digest.html,推送到 GitHub 后用 jsDelivr CDN 访问
 *
 * 用法:node scrapers/build-digest.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT  = path.join(DATA, 'digest.html');

const PLATFORMS = [
  { key: 'fanqie',  name: '🍅 番茄小说',   emoji: '🍅' },
  { key: 'jjwxc',   name: '📚 晋江文学城', emoji: '📚' },
  { key: 'changpei', name: '🎭 长佩文学',  emoji: '🎭' },
  { key: 'qimao',   name: '🐱 七猫小说',   emoji: '🐱' },
];

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topBooks(latest, n = 10) {
  if (!latest || !Array.isArray(latest.books)) return [];
  return latest.books.slice(0, n).map(b => ({
    rank: b.rank,
    name: b.book_name || b.title || '',
    author: b.author || '',
    tags: [b.primary_tag, ...(b.secondary_tags || [])].filter(Boolean).slice(0, 3),
    url: b.book_url || b.url || '',
    rank_change: b.rank_change,
  }));
}

function renderBookRows(books) {
  if (!books.length) return '<tr><td colspan="4" class="muted">无数据</td></tr>';
  return books.map(b => {
    const tag = b.rank_change === 'new'
      ? '<span class="tag tag-new">NEW</span>'
      : (typeof b.rank_change === 'number' && b.rank_change > 0
          ? `<span class="tag tag-up">↑${b.rank_change}</span>`
          : (typeof b.rank_change === 'number' && b.rank_change < 0
              ? `<span class="tag tag-down">↓${Math.abs(b.rank_change)}</span>`
              : ''));
    const url = b.url ? `<a href="${esc(b.url)}" target="_blank">${esc(b.name)}</a>` : esc(b.name);
    const tags = b.tags.map(t => `<span class="mini-tag">${esc(t)}</span>`).join(' ');
    return `<tr>
      <td class="rank">${b.rank}</td>
      <td>${url} ${tag}</td>
      <td>${esc(b.author)}</td>
      <td>${tags}</td>
    </tr>`;
  }).join('\n');
}

function renderSummary(summary) {
  if (!summary || !Array.isArray(summary.blocks)) return '';
  return summary.blocks.map(block => `
    <div class="block">
      <h4>${esc(block.title || '')}</h4>
      <ul>${(block.lines || []).map(l => `<li>${esc(l)}</li>`).join('')}</ul>
    </div>
  `).join('\n');
}

function renderPlatform(p) {
  const latest = readJSON(path.join(DATA, p.key, 'latest.json'));
  const summary = readJSON(path.join(DATA, p.key, 'summary.json'));
  const updateDate = latest?.update_date || latest?.update_time || '-';
  const total = latest?.total_count ?? '?';
  const books = topBooks(latest, 10);
  const sourceUrl = latest?.source_url || '';
  const ok = books.length > 0;
  return `
    <section class="platform ${ok ? '' : 'empty'}">
      <header>
        <h2>${p.name}</h2>
        <span class="badge ${ok ? 'badge-ok' : 'badge-bad'}">${ok ? '✅ OK' : '❌ 缺数据'}</span>
        <span class="meta">${esc(updateDate)} · ${total} 本${sourceUrl ? ` · <a href="${esc(sourceUrl)}" target="_blank">源榜</a>` : ''}</span>
      </header>
      <table>
        <thead><tr><th class="rank">#</th><th>书名</th><th>作者</th><th>标签</th></tr></thead>
        <tbody>${renderBookRows(books)}</tbody>
      </table>
      ${renderSummary(summary)}
    </section>
  `;
}

function renderAnalysis() {
  const a = readJSON(path.join(DATA, 'analysis.json'));
  if (!a) return '';
  const overall = a.overall_summary || '';
  return `
    <section class="analysis">
      <h2>🧠 AI 概览</h2>
      <p class="overall">${esc(overall)}</p>
    </section>
  `;
}

function render() {
  const date = new Date().toISOString().slice(0, 10);
  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>novel-tracker 每日速览 · ${date}</title>
<style>
  :root {
    --bg: #f7f8fa; --card: #ffffff; --text: #1f2328; --muted: #6b7280;
    --border: #e5e7eb; --primary: #2563eb; --accent: #f59e0b;
    --tag-new: #16a34a; --tag-up: #16a34a; --tag-down: #dc2626;
  }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
    line-height: 1.55; font-size: 15px; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 24px 16px 64px; }
  h1 { font-size: 24px; margin: 0 0 8px; }
  h2 { font-size: 18px; margin: 24px 0 12px; }
  h4 { margin: 12px 0 6px; font-size: 14px; color: var(--primary); }
  header.top { padding: 16px 0; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
  header.top p { margin: 4px 0; color: var(--muted); font-size: 13px; }
  .platform { background: var(--card); border: 1px solid var(--border);
    border-radius: 8px; padding: 16px 18px; margin: 12px 0; }
  .platform header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .platform header h2 { margin: 0; flex: 0 0 auto; }
  .platform .meta { color: var(--muted); font-size: 12px; }
  .platform.empty { opacity: 0.55; }
  .badge { font-size: 12px; padding: 2px 8px; border-radius: 10px; font-weight: 600; }
  .badge-ok { background: #dcfce7; color: #166534; }
  .badge-bad { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid var(--border); font-size: 13px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; color: var(--muted); }
  td.rank { font-weight: 700; color: var(--accent); width: 32px; text-align: center; }
  th.rank { width: 32px; text-align: center; }
  a { color: var(--primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .tag { font-size: 11px; padding: 1px 5px; border-radius: 4px; margin-left: 4px; vertical-align: middle; }
  .tag-new, .tag-up { background: #dcfce7; color: var(--tag-new); }
  .tag-down { background: #fee2e2; color: var(--tag-down); }
  .mini-tag { display: inline-block; font-size: 11px; padding: 1px 6px;
    background: #eff6ff; color: var(--primary); border-radius: 4px; margin-right: 3px; }
  .block ul { margin: 4px 0 8px; padding-left: 18px; font-size: 13px; }
  .block li { margin: 2px 0; color: #374151; }
  .muted { color: var(--muted); text-align: center; }
  .analysis { background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
    border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px 18px; margin: 12px 0; }
  .analysis .overall { margin: 0; font-size: 14px; color: #1e293b; }
  footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border);
    color: var(--muted); font-size: 12px; text-align: center; }
  @media (max-width: 600px) {
    body { font-size: 14px; }
    .wrap { padding: 16px 10px 48px; }
    table { font-size: 12px; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>📚 novel-tracker 每日速览</h1>
    <p>📅 日期: <strong>${esc(date)}</strong></p>
    <p>🕒 生成时间: ${esc(generated)}</p>
    <p>🌐 数据源: 番茄小说 / 晋江文学城 / 长佩文学 / 七猫小说 · GitHub Actions 自动推送</p>
  </header>
  ${renderAnalysis()}
  ${PLATFORMS.map(renderPlatform).join('\n')}
  <footer>
    本页由 GitHub Actions 自动生成 · 数据归各平台所有<br>
    <a href="https://github.com/fengs2021/novel-tracker" target="_blank">仓库</a> · jsDelivr CDN 托管
  </footer>
</div>
</body>
</html>`;
  return html;
}

function main() {
  const html = render();
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(OUT, html, 'utf8');
  console.log(`✓ digest.html 写入 ${OUT} (${html.length} bytes)`);
}

if (require.main === module) main();
module.exports = { render, PLATFORMS };