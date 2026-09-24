#!/usr/bin/env node
/**
 * novel-tracker 专用 digest 服务器
 * - 仅服务 data/digest.html + data/ 下的原始 JSON(便于其他工具读取)
 * - 端口 3899(38 → trackers 谐音,99 收尾),绑定 0.0.0.0
 * - 每次请求重读文件,无需重启即可看到当日最新摘要
 *
 * 用法:node digest-server.js
 *      PORT=3999 node digest-server.js  # 自定义端口
 *      pm2 start digest-server.js --name novel-tracker-digest
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3899', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, 'data');

const MIME = {
  html: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  css:  'text/css; charset=utf-8',
  js:   'application/javascript; charset=utf-8',
  svg:  'image/svg+xml',
  png:  'image/png',
  jpg:  'image/jpeg',
  ico:  'image/x-icon',
};

function send(res, status, type, body) {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function safeJoin(root, urlPath) {
  // 防目录穿越
  const target = path.normalize(path.join(root, urlPath));
  if (!target.startsWith(root)) return null;
  return target;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // 根路径 / 和 /digest.html 都跳到 digest.html
  if (urlPath === '/' || urlPath === '') {
    urlPath = '/digest.html';
  }

  const fp = safeJoin(ROOT, urlPath);
  if (!fp) {
    return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
  }

  fs.stat(fp, (err, stat) => {
    if (err || !stat.isFile()) {
      // 友好 fallback:列出 data 目录内容
      if (urlPath === '/' || urlPath === '/index') {
        const listing = fs.readdirSync(ROOT).map(n => {
          const full = path.join(ROOT, n);
          const isDir = fs.statSync(full).isDirectory();
          return `${isDir ? '📁' : '📄'} <a href="/${n}${isDir ? '/' : ''}">${n}</a>`;
        }).join('<br>');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>novel-tracker digest</title>
<style>body{font-family:sans-serif;max-width:780px;margin:24px auto;padding:0 16px;line-height:1.6}
a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}</style>
</head><body><h1>📚 novel-tracker digest</h1>
<p>每日抓取摘要服务 · 端口 ${PORT}</p>
<p><a href="/digest.html">👉 打开当日摘要 (digest.html)</a></p>
<h3>data/ 目录</h3><pre>${listing}</pre></body></html>`;
        return send(res, 200, 'text/html; charset=utf-8', html);
      }
      return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    }

    const ext = path.extname(fp).slice(1).toLowerCase();
    fs.readFile(fp, (err, data) => {
      if (err) return send(res, 500, 'text/plain; charset=utf-8', 'Read error');
      send(res, 200, MIME[ext] || 'application/octet-stream', data);
    });
  });
});

server.listen(PORT, HOST, () => {
  const ip = require('os').networkInterfaces();
  const addrs = [];
  Object.values(ip).forEach(list => list.forEach(i => {
    if (i.family === 'IPv4' && !i.internal) addrs.push(i.address);
  }));
  console.log(`novel-tracker digest server:`);
  console.log(`  本机: http://127.0.0.1:${PORT}/`);
  addrs.forEach(a => console.log(`  局域网: http://${a}:${PORT}/`));
  console.log(`  摘要直达: http://127.0.0.1:${PORT}/digest.html`);
});

process.on('SIGTERM', () => { console.log('SIGTERM'); server.close(() => process.exit(0)); });
process.on('SIGINT',  () => { console.log('SIGINT');  server.close(() => process.exit(0)); });