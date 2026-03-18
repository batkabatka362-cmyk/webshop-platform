#!/bin/bash
# ═══════════════════════════════════════════════════════
# WEBSHOP — Railway Deploy Script
# Энэ скриптийг өөрийн компьютер дээр ажиллуулна
# ═══════════════════════════════════════════════════════
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   🛍️  WEBSHOP Railway Deploy          ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# 1. GitHub repo шаардлагатай эсэхийг шалгах
if ! command -v gh &>/dev/null; then
  echo -e "${YELLOW}→ GitHub CLI суулгаж байна...${NC}"
  echo "  https://cli.github.com дээрээс татаж суулгана уу"
  echo "  эсвэл: brew install gh"
  exit 1
fi

if ! command -v railway &>/dev/null; then
  echo -e "${YELLOW}→ Railway CLI суулгаж байна...${NC}"
  npm install -g @railway/cli
fi

echo -e "${GREEN}✅ Бүх tool бэлэн${NC}"
echo ""

# 2. GitHub-д push
echo -e "${YELLOW}→ GitHub repo үүсгэж push хийж байна...${NC}"
gh auth login 2>/dev/null || true
gh repo create webshop-platform --public --push --source=. --remote=origin || \
  git push -u origin main

echo -e "${GREEN}✅ GitHub push амжилттай${NC}"
echo ""

# 3. Railway login + deploy
echo -e "${YELLOW}→ Railway-д нэвтэрч байна...${NC}"
railway login

echo -e "${YELLOW}→ Railway project үүсгэж байна...${NC}"
railway init --name webshop-platform

echo -e "${YELLOW}→ PostgreSQL нэмж байна...${NC}"
railway add --database postgresql

echo -e "${YELLOW}→ Redis нэмж байна...${NC}"
railway add --database redis

# 4. Environment variables
echo ""
echo -e "${YELLOW}═══ Environment variables тавих ═══${NC}"
echo "Дараах утгуудыг оруулна уу:"
echo ""

read -p "ACCESS_JWT_SECRET (enter = auto-generate): " JWT
JWT=${JWT:-$(openssl rand -hex 32)}
railway variables set ACCESS_JWT_SECRET="$JWT"

read -p "REFRESH_JWT_SECRET (enter = auto-generate): " RJWT
RJWT=${RJWT:-$(openssl rand -hex 32)}
railway variables set REFRESH_JWT_SECRET="$RJWT"

SITOKEN=$(openssl rand -hex 32)
railway variables set SYSTEM_INTERNAL_TOKEN="$SITOKEN"
railway variables set NODE_ENV="production"
railway variables set PORT="4000"

read -p "QPAY_USERNAME (QPay merchant ID, enter-г орхиж болно): " QUSER
[ -n "$QUSER" ] && railway variables set QPAY_USERNAME="$QUSER"

read -p "QPAY_PASSWORD (enter-г орхиж болно): " QPASS
[ -n "$QPASS" ] && railway variables set QPAY_PASSWORD="$QPASS"

echo ""
echo -e "${YELLOW}→ Deploy хийж байна... (~5 минут)${NC}"
railway up --detach

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ WEBSHOP deploy амжилттай!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
DOMAIN=$(railway domain 2>/dev/null || echo "railway dashboard-аас URL авна уу")
echo "  🌐 URL: https://$DOMAIN"
echo "  🏥 Health: https://$DOMAIN/health"
echo ""
echo "  Дараагийн алхам:"
echo "  1. railway logs  ← log харах"
echo "  2. railway open  ← browser-д нээх"
echo ""
