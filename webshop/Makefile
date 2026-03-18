# ═══════════════════════════════════════════════
# WEBSHOP — Makefile
# Convenience commands for dev and production
# ═══════════════════════════════════════════════

.PHONY: help install build clean start dev \
        db-generate db-migrate db-push db-studio db-seed \
        docker-build docker-up docker-down docker-prod docker-logs \
        test typecheck lint lint-fix \
        ssl-dirs

# ── Default ───────────────────────────────────
help:
	@echo ""
	@echo "  🛍️  WEBSHOP — Available Commands"
	@echo "  ─────────────────────────────────────"
	@echo "  DEVELOPMENT"
	@echo "  make install        Install all dependencies"
	@echo "  make dev            Start development server (ts-node watch)"
	@echo "  make typecheck      TypeScript type check (no emit)"
	@echo "  make lint           ESLint check"
	@echo "  make lint-fix       ESLint auto-fix"
	@echo ""
	@echo "  BUILD"
	@echo "  make build          Compile TypeScript → dist/"
	@echo "  make clean          Remove dist/"
	@echo "  make start          Run compiled server (production mode)"
	@echo ""
	@echo "  DATABASE"
	@echo "  make db-generate    Generate Prisma client"
	@echo "  make db-migrate     Run pending migrations (production)"
	@echo "  make db-push        Push schema directly (dev only)"
	@echo "  make db-studio      Open Prisma Studio"
	@echo "  make db-seed        Seed initial data"
	@echo ""
	@echo "  DOCKER"
	@echo "  make docker-build   Build Docker image"
	@echo "  make docker-up      Start development stack"
	@echo "  make docker-down    Stop all services"
	@echo "  make docker-prod    Start production stack"
	@echo "  make docker-logs    Follow API service logs"
	@echo ""

# ── Development ───────────────────────────────
install:
	npm ci
	npm run db:generate

dev:
	NODE_ENV=development npx nodemon \
		--exec "ts-node --project tsconfig.json" \
		--ext ts \
		--watch backend \
		backend/server.ts

typecheck:
	npx tsc --noEmit

lint:
	npx eslint backend --ext .ts

lint-fix:
	npx eslint backend --ext .ts --fix

# ── Build ─────────────────────────────────────
clean:
	rm -rf dist

build: clean db-generate
	npx tsc --project tsconfig.json
	@echo "✅ Build complete → dist/backend/server.js"

start: build
	NODE_ENV=production node dist/backend/server.js

# ── Database ──────────────────────────────────
db-generate:
	npx prisma generate

db-migrate:
	npx prisma migrate deploy

db-push:
	npx prisma db push

db-studio:
	npx prisma studio

db-seed:
	npx ts-node backend/data-platform/database/seed.ts

# ── Docker ────────────────────────────────────
docker-build:
	docker build -t webshop:latest .

docker-up:
	docker-compose up -d
	@echo "✅ Services: API http://localhost:4000  PgAdmin http://localhost:5050"

docker-down:
	docker-compose down

docker-prod:
	docker-compose \
		-f docker-compose.yml \
		-f docker-compose.prod.yml \
		up -d --build

docker-logs:
	docker-compose logs -f webshop-api

# ── SSL ───────────────────────────────────────
ssl-dirs:
	mkdir -p ssl
	@echo "Place fullchain.pem and privkey.pem in ./ssl/"
