#!/bin/bash
# novel-tracker 每日更新脚本
# - 拉取 origin/main 最新数据(覆盖本地 data/)
# - 重新生成 data/digest.html
# - pm2 服务自动读取新文件,无需重启
#
# 定时:每天 Beijing 03:00(= UTC 19:00) 跑一次
set -e

REPO_DIR="/root/.zcode/workspace/default/novel-tracker"
LOG="/root/novel-tracker-update.log"
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

cd "$REPO_DIR" || { echo "[$TIMESTAMP] cd failed" >> "$LOG"; exit 1; }

# 1) 拉最新(用 stash 防本地 digest.html 改动挡 pull)
    git stash --include-untracked --quiet 2>/dev/null || true
    if ! git -c http.proxy= -c https.proxy= pull --rebase origin main >> "$LOG" 2>&1; then
      echo "[$TIMESTAMP] git pull failed" >> "$LOG"
      git stash pop --quiet 2>/dev/null || true
      exit 1
    fi
    git stash pop --quiet 2>/dev/null || true

# 2) 重新生成 digest
    if ! node scrapers/build-digest.js >> "$LOG" 2>&1; then
      echo "[$TIMESTAMP] build-digest failed" >> "$LOG"
      exit 1
    fi

DIGEST_SIZE=$(stat -c '%s' data/digest.html 2>/dev/null || echo 0)
LATEST_COMMIT=$(git log -1 --pretty='%h %s' 2>/dev/null || echo "(无)")
echo "[$TIMESTAMP] OK  digest=${DIGEST_SIZE}B  latest=${LATEST_COMMIT}" >> "$LOG"